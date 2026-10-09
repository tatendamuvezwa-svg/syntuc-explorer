import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq, and, asc } from 'drizzle-orm';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireCoordinatorAuth, AuthenticatedStaffRequest } from '../middleware/auth.ts';
import {
  persistMediaAssetToFirestore,
  deleteMediaAssetFromFirestore,
  recordTombstoneInFirestore,
  updateMediaPrimaryStatusInFirestore,
  persistProductToFirestore,
  persistPackageToFirestore,
} from '../services/firestoreSync.ts';

const router = Router();

// Ensure persistent uploads directory exists
const uploadsDir = path.resolve(process.cwd(), 'data/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration with validation against path traversal and MIME spoofing
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = 'med_' + crypto.randomBytes(12).toString('hex') + ext;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_MIME_TYPE: Only JPEG, PNG, WEBP, and AVIF images are permitted'));
    }
  },
});

// GET /api/media/product - Safe fallback if no productId provided
router.get('/product', (req, res: Response) => {
  res.json([]);
});

// GET /api/media/product/:productId - Get all media for a product
router.get('/product/:productId', async (req, res: Response) => {
  try {
    const { productId } = req.params;
    if (!productId || productId === 'undefined' || productId === 'null' || productId.trim() === '') {
      res.json([]);
      return;
    }
    const media = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.ownerId, productId.trim()))
      .orderBy(asc(schema.mediaAssets.displayOrder));

    res.json(media);
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_MEDIA' });
  }
});

// POST /api/media/upload - Upload file or register verified external URL
router.post(
  '/upload',
  requireCoordinatorAuth,
  upload.single('file'),
  async (req: AuthenticatedStaffRequest, res: Response) => {
    try {
      const {
        ownerType = 'product',
        ownerId,
        externalUrl,
        mediaType = 'IMAGE',
        caption,
        altText,
        sourceName = 'Coordinator Upload',
        isPrimary,
        displayOrder = 0,
      } = req.body;

      if (!ownerId) {
        res.status(400).json({ error: 'OWNER_ID_REQUIRED' });
        return;
      }

      let assetUrl = externalUrl;

      if (req.file) {
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          // Store durable Data URI directly in database so media survives container recycling
          assetUrl = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
          // Clean up temp upload file
          try {
            fs.unlinkSync(req.file.path);
          } catch (_) {}
        } catch (readErr) {
          console.warn('[Media] Failed to convert uploaded file to durable Data URI, falling back to path:', readErr);
          assetUrl = `/uploads/${req.file.filename}`;
        }
      }

      if (!assetUrl) {
        res.status(400).json({ error: 'FILE_OR_URL_REQUIRED', message: 'Please provide either an uploaded file or external image URL' });
        return;
      }

      const mediaId = 'med_' + crypto.randomBytes(12).toString('hex');
      const shouldBePrimary = isPrimary === 'true' || isPrimary === true;

      // If marked as primary, unset any existing primary media for this product first
      if (shouldBePrimary) {
        await db
          .update(schema.mediaAssets)
          .set({ isPrimary: false })
          .where(
            and(
              eq(schema.mediaAssets.ownerType, ownerType),
              eq(schema.mediaAssets.ownerId, ownerId)
            )
          );
      }

      // Insert media record
      const mediaRecord = {
        id: mediaId,
        ownerType,
        ownerId,
        mediaType,
        url: assetUrl,
        thumbnailUrl: assetUrl,
        isPrimary: shouldBePrimary,
        displayOrder: Number(displayOrder) || 0,
        caption: caption || null,
        altText: altText || null,
        sourceName: sourceName || 'Coordinator Upload',
        verificationState: 'ESTABLISHED',
      };
      await db.insert(schema.mediaAssets).values(mediaRecord);

      // Persist to Cloud Firestore for durable container lifecycle survival
      try {
        await persistMediaAssetToFirestore(mediaRecord as any);
      } catch (fsErr) {
        console.warn('[Media] Cloud Firestore persistence notice:', fsErr);
      }

      // If primary, also update primaryMediaId on the product
      if (shouldBePrimary && ownerType === 'product') {
        await db
          .update(schema.products)
          .set({ primaryMediaId: mediaId })
          .where(eq(schema.products.id, ownerId));

        // Sync primary media flags in Firestore and update product document
        try {
          await updateMediaPrimaryStatusInFirestore(ownerType, ownerId, mediaId);
          const updatedProd = (await db.select().from(schema.products).where(eq(schema.products.id, ownerId)))[0];
          if (updatedProd) await persistProductToFirestore(updatedProd);
        } catch (_) {}
      }

      res.json({
        success: true,
        mediaId,
        url: assetUrl,
        isPrimary: shouldBePrimary,
        message: 'Media asset successfully registered',
      });
    } catch (error: any) {
      console.error('Media upload error:', error);
      res.status(500).json({ error: 'MEDIA_UPLOAD_FAILED', message: error.message });
    }
  }
);

// POST /api/media/:id/set-primary - Switch primary image for product
router.post('/:id/set-primary', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch the target media
    const targetRecords = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, id));

    if (targetRecords.length === 0) {
      res.status(404).json({ error: 'MEDIA_NOT_FOUND' });
      return;
    }

    const target = targetRecords[0];

    // 1. Unset all existing primary media for this owner
    await db
      .update(schema.mediaAssets)
      .set({ isPrimary: false })
      .where(
        and(
          eq(schema.mediaAssets.ownerType, target.ownerType),
          eq(schema.mediaAssets.ownerId, target.ownerId)
        )
      );

    // 2. Set this media as primary
    await db
      .update(schema.mediaAssets)
      .set({ isPrimary: true })
      .where(eq(schema.mediaAssets.id, id));

    // Ensure target media is durably persisted to Cloud Firestore
    try {
      await persistMediaAssetToFirestore({ ...target, isPrimary: true });
    } catch (fsErr) {
      console.warn('[Media] Firestore persist target media notice:', fsErr);
    }

    // 3. Update product primaryMediaId or package primaryImageUrl
    if (target.ownerType === 'product') {
      await db
        .update(schema.products)
        .set({ primaryMediaId: id, updatedAt: new Date() })
        .where(eq(schema.products.id, target.ownerId));

      try {
        await updateMediaPrimaryStatusInFirestore(target.ownerType, target.ownerId, id);
        const updatedProd = (await db.select().from(schema.products).where(eq(schema.products.id, target.ownerId)))[0];
        if (updatedProd) await persistProductToFirestore(updatedProd);
      } catch (fsErr) {
        console.warn('[Media] Firestore persist product notice:', fsErr);
      }
    } else if (target.ownerType === 'package') {
      await db
        .update(schema.packages)
        .set({ primaryImageUrl: target.url, updatedAt: new Date() })
        .where(eq(schema.packages.id, target.ownerId));

      try {
        await updateMediaPrimaryStatusInFirestore(target.ownerType, target.ownerId, id);
        const updatedPkg = (await db.select().from(schema.packages).where(eq(schema.packages.id, target.ownerId)))[0];
        if (updatedPkg) await persistPackageToFirestore(updatedPkg);
      } catch (fsErr) {
        console.warn('[Media] Firestore persist package notice:', fsErr);
      }
    }

    res.json({
      success: true,
      message: 'Primary image updated successfully. Guest views will immediately reflect this change.',
    });
  } catch (error) {
    console.error('Set primary media error:', error);
    res.status(500).json({ error: 'FAILED_TO_SET_PRIMARY' });
  }
});

// PATCH /api/media/:id - Edit caption, alt text, display order
router.patch('/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { caption, altText, displayOrder, sourceName } = req.body;

    await db
      .update(schema.mediaAssets)
      .set({
        caption: caption !== undefined ? caption : undefined,
        altText: altText !== undefined ? altText : undefined,
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : undefined,
        sourceName: sourceName !== undefined ? sourceName : undefined,
      })
      .where(eq(schema.mediaAssets.id, id));

    const updatedMedia = (await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id)))[0];
    if (updatedMedia) {
      try {
        await persistMediaAssetToFirestore(updatedMedia);
      } catch (_) {}
    }

    res.json({ success: true, message: 'Media metadata updated' });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_MEDIA' });
  }
});

// DELETE /api/media/:id - Delete media asset
router.delete('/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;

    const records = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, id));

    if (records.length === 0) {
      res.status(404).json({ error: 'MEDIA_NOT_FOUND' });
      return;
    }

    const item = records[0];

    // If local file, delete from disk
    if (item.url && item.url.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, path.basename(item.url));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Error removing local file:', e);
        }
      }
    }

    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, id));

    // Remove from Cloud Firestore and record deletion tombstone
    try {
      await recordTombstoneInFirestore('media_assets', id);
      await deleteMediaAssetFromFirestore(id);
    } catch (_) {}

    // If deleted media was primary or referenced by product, update product
    if (item.ownerType === 'product') {
      const remaining = await db
        .select()
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.ownerId, item.ownerId))
        .orderBy(asc(schema.mediaAssets.displayOrder));

      if (remaining.length > 0) {
        const newPrimary = remaining[0];
        await db.update(schema.mediaAssets).set({ isPrimary: true }).where(eq(schema.mediaAssets.id, newPrimary.id));
        await db.update(schema.products).set({ primaryMediaId: newPrimary.id }).where(eq(schema.products.id, item.ownerId));
        try {
          await updateMediaPrimaryStatusInFirestore(item.ownerType, item.ownerId, newPrimary.id);
        } catch (_) {}
      } else {
        await db.update(schema.products).set({ primaryMediaId: null }).where(eq(schema.products.id, item.ownerId));
      }

      try {
        const updatedProd = (await db.select().from(schema.products).where(eq(schema.products.id, item.ownerId)))[0];
        if (updatedProd) await persistProductToFirestore(updatedProd);
      } catch (_) {}
    }

    res.json({ success: true, message: 'Media asset deleted and primary references reconciled' });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_DELETE_MEDIA' });
  }
});

// POST /api/media/reorder - Reorder gallery images
router.post('/reorder', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { items } = req.body; // array of { id: string, displayOrder: number }
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'ITEMS_ARRAY_REQUIRED' });
      return;
    }

    for (const item of items) {
      if (item.id && typeof item.displayOrder === 'number') {
        await db
          .update(schema.mediaAssets)
          .set({ displayOrder: item.displayOrder })
          .where(eq(schema.mediaAssets.id, item.id));
      }
    }

    res.json({ success: true, message: 'Gallery order updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_REORDER_MEDIA' });
  }
});

export default router;
