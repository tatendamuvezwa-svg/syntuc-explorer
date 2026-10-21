import { Router, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireCoordinatorAuth, AuthenticatedStaffRequest } from '../middleware/auth.ts';
import {
  getFirestoreDb,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocById,
  setDocById,
  updateDocById,
  deleteDocById,
  getCollectionDocs,
  where,
  getTombstones,
  recordTombstone,
} from '../lib/firestore.ts';

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

const CHUNK_SIZE = 350 * 1024;

async function persistMediaToFirestore(mediaAsset: any) {
  const fdb = getFirestoreDb();
  const rawUrl = mediaAsset.url || '';
  const isLarge = rawUrl.length > CHUNK_SIZE;

  if (isLarge) {
    const totalChunks = Math.ceil(rawUrl.length / CHUNK_SIZE);
    const chunkPromises = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkData = rawUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      chunkPromises.push(
        setDoc(doc(fdb, 'media_chunks', `${mediaAsset.id}_chunk_${i}`), {
          mediaAssetId: mediaAsset.id,
          chunkIndex: i,
          totalChunks,
          data: chunkData,
          createdAt: new Date().toISOString(),
        })
      );
    }
    await Promise.all(chunkPromises);

    const thumb = mediaAsset.thumbnailUrl && mediaAsset.thumbnailUrl.length < CHUNK_SIZE
      ? mediaAsset.thumbnailUrl
      : `__CHUNKED__:${mediaAsset.id}`;

    await setDoc(doc(fdb, 'media_assets', mediaAsset.id), {
      ...mediaAsset,
      url: `__CHUNKED__:${mediaAsset.id}`,
      thumbnailUrl: thumb,
      isChunked: true,
      totalChunks,
      rawLength: rawUrl.length,
      createdAt: mediaAsset.createdAt || new Date().toISOString(),
      cloudPersistedAt: new Date().toISOString(),
    });
  } else {
    await setDoc(doc(fdb, 'media_assets', mediaAsset.id), {
      ...mediaAsset,
      isChunked: false,
      createdAt: mediaAsset.createdAt || new Date().toISOString(),
      cloudPersistedAt: new Date().toISOString(),
    });
  }
}

async function removeMediaFromFirestore(mediaId: string) {
  const fdb = getFirestoreDb();
  const assetRef = doc(fdb, 'media_assets', mediaId);
  const snap = await getDoc(assetRef);
  if (snap.exists()) {
    const data = snap.data();
    if (data.isChunked && data.totalChunks) {
      const deletePromises = [];
      for (let i = 0; i < data.totalChunks; i++) {
        deletePromises.push(deleteDoc(doc(fdb, 'media_chunks', `${mediaId}_chunk_${i}`)));
      }
      await Promise.all(deletePromises);
    }
    await deleteDoc(assetRef);
  }
}

// GET /api/media/product - Safe fallback if no productId provided
router.get('/product', (req, res: Response) => {
  res.json([]);
});

// GET /api/media/product/:productId - Get all media for a product directly from Firestore
router.get('/product/:productId', async (req, res: Response) => {
  try {
    const { productId } = req.params;
    if (!productId || productId === 'undefined' || productId === 'null' || productId.trim() === '') {
      res.json([]);
      return;
    }
    const tombstones = await getTombstones();
    const allMedia = await getCollectionDocs<any>('media_assets', where('ownerId', '==', productId.trim()));
    const activeMedia = allMedia
      .filter((m) => !tombstones.has(`media_assets_${m.id}`))
      .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0))
      .map((m) => {
        let url = m.url;
        if (url && url.startsWith('__CHUNKED__:')) {
          url = `/api/media/render/${m.id}`;
        }
        let thumb = m.thumbnailUrl;
        if (!thumb || thumb.startsWith('__CHUNKED__:')) {
          thumb = url;
        }
        return {
          ...m,
          url,
          thumbnailUrl: thumb,
        };
      });

    res.json(activeMedia);
  } catch (error) {
    console.error('Error fetching product media from Firestore:', error);
    res.status(500).json({ error: 'FAILED_TO_LOAD_MEDIA' });
  }
});

// GET /api/media/render/:mediaId - Safely stream media from disk or re-hydrate from chunks
router.get('/render/:mediaId', async (req, res: Response) => {
  try {
    const { mediaId } = req.params;
    if (!mediaId) {
      res.status(400).send('Invalid media ID');
      return;
    }

    // 1. Check if matching file exists in uploadsDir
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const matchedFile = files.find((f) => f.includes(mediaId));
      if (matchedFile) {
        res.sendFile(path.join(uploadsDir, matchedFile));
        return;
      }
    }

    // 2. Fetch media asset metadata
    const asset = await getDocById<any>('media_assets', mediaId);
    if (!asset) {
      res.status(404).send('Media asset not found');
      return;
    }

    // If external URL, redirect
    if (asset.url && !asset.url.startsWith('__CHUNKED__') && !asset.url.startsWith('/uploads')) {
      res.redirect(asset.url);
      return;
    }

    // 3. Re-hydrate from media_chunks if chunked
    const chunks = await getCollectionDocs<any>(
      'media_chunks',
      where('mediaAssetId', '==', mediaId)
    );
    if (chunks && chunks.length > 0) {
      chunks.sort((a, b) => (Number(a.chunkIndex) || 0) - (Number(b.chunkIndex) || 0));
      const fullData = chunks.map((c) => c.data).join('');
      if (fullData.startsWith('data:')) {
        const matches = fullData.match(/^data:([A-Za-z0-9\/+.-]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const buf = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.send(buf);
          return;
        }
      }
    }

    res.status(404).send('Image unavailable');
  } catch (err: any) {
    console.error('[Media] Error rendering media:', err);
    res.status(500).send('Error rendering image');
  }
});

// POST /api/media/upload - Upload file or register verified external URL directly to Firestore
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
        assetUrl = `/uploads/${req.file.filename}`;
      }

      if (!assetUrl) {
        res.status(400).json({
          error: 'FILE_OR_URL_REQUIRED',
          message: 'Please provide either an uploaded file or external image URL',
        });
        return;
      }

      const mediaId = 'med_' + crypto.randomBytes(12).toString('hex');
      const shouldBePrimary = isPrimary === 'true' || isPrimary === true;
      const nowIso = new Date().toISOString();

      // If marked as primary, unset any existing primary media for this owner first
      if (shouldBePrimary) {
        const existingMedia = await getCollectionDocs<any>(
          'media_assets',
          where('ownerId', '==', ownerId)
        );
        for (const m of existingMedia) {
          if (m.isPrimary) {
            await updateDocById('media_assets', m.id, { isPrimary: false, updatedAt: nowIso });
          }
        }
      }

      // Build media record with durable public URL
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
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Persist directly to Cloud Firestore
      await persistMediaToFirestore(mediaRecord);

      // If primary, update product or package in Firestore with both primaryMediaId and primaryImageUrl
      if (shouldBePrimary) {
        if (ownerType === 'product') {
          await updateDocById('products', ownerId, {
            primaryMediaId: mediaId,
            primaryImageUrl: assetUrl,
            updatedAt: nowIso,
          });
        } else if (ownerType === 'package') {
          await updateDocById('packages', ownerId, {
            primaryImageUrl: assetUrl,
            updatedAt: nowIso,
          });
        }
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

// POST /api/media/:id/set-primary - Switch primary image directly in Firestore
router.post('/:id/set-primary', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const target = await getDocById<any>('media_assets', id);

    if (!target) {
      res.status(404).json({ error: 'MEDIA_NOT_FOUND' });
      return;
    }

    const nowIso = new Date().toISOString();

    // 1. Unset all existing primary media for this owner
    const existingMedia = await getCollectionDocs<any>(
      'media_assets',
      where('ownerId', '==', target.ownerId)
    );
    for (const m of existingMedia) {
      const isTarget = m.id === id;
      if (m.isPrimary !== isTarget) {
        await updateDocById('media_assets', m.id, { isPrimary: isTarget, updatedAt: nowIso });
      }
    }

    const resolvedPrimaryUrl = target.url?.startsWith('__CHUNKED__:')
      ? `/api/media/render/${target.id}`
      : target.url;

    // 2. Update product primaryMediaId & primaryImageUrl or package primaryImageUrl in Firestore
    if (target.ownerType === 'product') {
      await updateDocById('products', target.ownerId, {
        primaryMediaId: id,
        primaryImageUrl: resolvedPrimaryUrl,
        updatedAt: nowIso,
      });
    } else if (target.ownerType === 'package') {
      await updateDocById('packages', target.ownerId, {
        primaryImageUrl: resolvedPrimaryUrl,
        updatedAt: nowIso,
      });
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

// PATCH /api/media/:id - Edit caption, alt text, display order in Firestore
router.patch('/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { caption, altText, displayOrder, sourceName } = req.body;

    const updates: any = { updatedAt: new Date().toISOString() };
    if (caption !== undefined) updates.caption = caption;
    if (altText !== undefined) updates.altText = altText;
    if (displayOrder !== undefined) updates.displayOrder = Number(displayOrder);
    if (sourceName !== undefined) updates.sourceName = sourceName;

    await updateDocById('media_assets', id, updates);

    res.json({ success: true, message: 'Media metadata updated' });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_MEDIA' });
  }
});

// DELETE /api/media/:id - Delete media asset from Firestore and record durable tombstone
router.delete('/:id', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { id } = req.params;
    const item = await getDocById<any>('media_assets', id);

    if (!item) {
      res.status(404).json({ error: 'MEDIA_NOT_FOUND' });
      return;
    }

    // If local file exists, remove from disk
    if (item.url && item.url.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, path.basename(item.url));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
    }

    // 1. Record durable deletion tombstone in Cloud Firestore
    await recordTombstone('media_assets', id);

    // 2. Remove document and chunks from Firestore
    await removeMediaFromFirestore(id);

    // 3. Reconcile primary image reference on owner product/package if needed
    if (item.ownerType === 'product') {
      const tombstones = await getTombstones();
      const remainingMedia = (await getCollectionDocs<any>(
        'media_assets',
        where('ownerId', '==', item.ownerId)
      ))
        .filter((m) => m.id !== id && !tombstones.has(`media_assets_${m.id}`))
        .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));

      if (remainingMedia.length > 0) {
        const newPrimary = remainingMedia[0];
        await updateDocById('media_assets', newPrimary.id, { isPrimary: true, updatedAt: new Date().toISOString() });
        await updateDocById('products', item.ownerId, { primaryMediaId: newPrimary.id, updatedAt: new Date().toISOString() });
      } else {
        await updateDocById('products', item.ownerId, { primaryMediaId: null, updatedAt: new Date().toISOString() });
      }
    }

    res.json({ success: true, message: 'Media asset deleted and primary references reconciled' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'FAILED_TO_DELETE_MEDIA' });
  }
});

// POST /api/media/reorder - Reorder gallery images directly in Firestore
router.post('/reorder', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'ITEMS_ARRAY_REQUIRED' });
      return;
    }

    const nowIso = new Date().toISOString();
    for (const item of items) {
      if (item.id && typeof item.displayOrder === 'number') {
        await updateDocById('media_assets', item.id, {
          displayOrder: item.displayOrder,
          updatedAt: nowIso,
        });
      }
    }

    res.json({ success: true, message: 'Gallery order updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'FAILED_TO_REORDER_MEDIA' });
  }
});

export default router;
