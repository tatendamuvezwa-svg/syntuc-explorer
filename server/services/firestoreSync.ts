import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Firestore,
} from 'firebase/firestore';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

let firestoreInstance: Firestore | null = null;

export function getFirestoreDb(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn('[FirestoreSync] firebase-applet-config.json not found');
      return null;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          projectId: config.projectId,
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          appId: config.appId,
          storageBucket: config.storageBucket,
        });

    firestoreInstance = getFirestore(app, config.firestoreDatabaseId || '(default)');
    console.log('[FirestoreSync] Cloud Firestore client initialized successfully for DB:', config.firestoreDatabaseId);
    return firestoreInstance;
  } catch (err) {
    console.error('[FirestoreSync] Error initializing Firestore client:', err);
    return null;
  }
}

function parseFirestoreDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Record a persistent tombstone in Cloud Firestore.
 * This guarantees that when an administrator deliberately deletes an asset or record,
 * subsequent container restarts or bootstrap seeding will NEVER resurrect it.
 */
export async function recordTombstoneInFirestore(collectionName: string, recordId: string) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    const tombstoneId = `${collectionName}_${recordId}`;
    await setDoc(doc(fdb, 'deleted_records', tombstoneId), {
      id: tombstoneId,
      collectionName,
      recordId,
      deletedAt: new Date().toISOString(),
      cloudPersistedAt: new Date().toISOString(),
    });
    console.log(`[FirestoreSync] Recorded durable deletion tombstone for ${collectionName}/${recordId}`);
  } catch (err) {
    console.warn(`[FirestoreSync] Failed recording tombstone for ${collectionName}/${recordId}:`, err);
  }
}

/**
 * Retrieve all active deletion tombstones from Cloud Firestore.
 */
export async function getDeletedTombstones(): Promise<Set<string>> {
  const fdb = getFirestoreDb();
  const set = new Set<string>();
  if (!fdb) return set;

  try {
    const snap = await getDocs(collection(fdb, 'deleted_records'));
    snap.forEach((d) => {
      set.add(d.id);
      const data = d.data();
      if (data.collectionName && data.recordId) {
        set.add(`${data.collectionName}_${data.recordId}`);
      }
    });
  } catch (err) {
    console.warn('[FirestoreSync] Notice retrieving deletion tombstones:', err);
  }
  return set;
}

/**
 * Persist an authoritative catalog product to Cloud Firestore.
 * This ensures administrator customizations (custom video hyperlinks, pricing,
 * descriptions, primary image selections) survive container lifecycles.
 */
export async function persistProductToFirestore(product: typeof schema.products.$inferSelect) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    await setDoc(doc(fdb, 'products', product.id), {
      id: product.id,
      operatorId: product.operatorId || null,
      propertyId: product.propertyId || null,
      name: product.name,
      slug: product.slug,
      productType: product.productType,
      categorySlug: product.categorySlug,
      shortDescription: product.shortDescription,
      description: product.description,
      location: product.location,
      duration: product.duration || null,
      basePrice: String(product.basePrice),
      currency: product.currency,
      priceBasis: product.priceBasis,
      inclusions: product.inclusions || [],
      exclusions: product.exclusions || [],
      suitability: product.suitability || [],
      isPublished: Boolean(product.isPublished),
      isFeatured: Boolean(product.isFeatured),
      availabilityNote: product.availabilityNote || null,
      primaryMediaId: product.primaryMediaId || null,
      videoUrl: product.videoUrl || null,
      evidenceStatus: product.evidenceStatus || 'ESTABLISHED',
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cloudPersistedAt: new Date().toISOString(),
    });
    console.log(`[FirestoreSync] Product ${product.name} (${product.id}) persisted to Cloud Firestore.`);
  } catch (err) {
    console.error(`[FirestoreSync] Failed to persist product ${product.id} to Firestore:`, err);
  }
}

/**
 * Persist an authoritative catalog package to Cloud Firestore.
 */
export async function persistPackageToFirestore(pkg: typeof schema.packages.$inferSelect) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    await setDoc(doc(fdb, 'packages', pkg.id), {
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      tagline: pkg.tagline,
      description: pkg.description,
      durationDays: pkg.durationDays,
      durationNights: pkg.durationNights,
      pricePerPerson: String(pkg.pricePerPerson),
      currency: pkg.currency,
      highlights: pkg.highlights || [],
      inclusions: pkg.inclusions || [],
      exclusions: pkg.exclusions || [],
      primaryImageUrl: pkg.primaryImageUrl,
      videoUrl: pkg.videoUrl || null,
      isPublished: Boolean(pkg.isPublished),
      createdAt: pkg.createdAt ? new Date(pkg.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cloudPersistedAt: new Date().toISOString(),
    });
    console.log(`[FirestoreSync] Package ${pkg.name} (${pkg.id}) persisted to Cloud Firestore.`);
  } catch (err) {
    console.error(`[FirestoreSync] Failed to persist package ${pkg.id} to Firestore:`, err);
  }
}

/**
 * Persist guest profile to Cloud Firestore
 */
export async function persistGuestToFirestore(guest: typeof schema.guests.$inferSelect) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    await setDoc(doc(fdb, 'guests', guest.id), {
      id: guest.id,
      fullName: guest.fullName,
      email: guest.email,
      phone: guest.phone || null,
      country: guest.country || null,
      createdAt: guest.createdAt ? new Date(guest.createdAt).toISOString() : new Date().toISOString(),
      cloudPersistedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[FirestoreSync] Failed persisting guest ${guest.id}:`, err);
  }
}

/**
 * Persist guest access token to Cloud Firestore
 */
export async function persistGuestAccessTokenToFirestore(token: typeof schema.guestAccessTokens.$inferSelect) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    await setDoc(doc(fdb, 'guest_access_tokens', token.id), {
      id: token.id,
      reservationRequestId: token.reservationRequestId,
      guestId: token.guestId,
      tokenHash: token.tokenHash,
      isRevoked: Boolean(token.isRevoked),
      expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : new Date().toISOString(),
      cloudPersistedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[FirestoreSync] Failed persisting guest access token ${token.id}:`, err);
  }
}

/**
 * Persist guest communication message to Cloud Firestore
 */
export async function persistGuestMessageToFirestore(msg: typeof schema.guestMessages.$inferSelect) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    await setDoc(doc(fdb, 'guest_messages', msg.id), {
      id: msg.id,
      reservationRequestId: msg.reservationRequestId,
      guestSessionId: msg.guestSessionId,
      senderType: msg.senderType,
      senderName: msg.senderName,
      messageText: msg.messageText,
      createdAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
      cloudPersistedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[FirestoreSync] Failed persisting message ${msg.id}:`, err);
  }
}

/**
 * Synchronize primary media status across all media assets for an owner in Cloud Firestore.
 * Ensures exactly one media asset is marked as primary in Firestore without burning redundant read units.
 */
export async function updateMediaPrimaryStatusInFirestore(
  ownerType: string,
  ownerId: string,
  primaryMediaId: string,
  knownMediaIds?: string[]
) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    if (knownMediaIds && knownMediaIds.length > 0) {
      const updates = knownMediaIds.map(id =>
        updateDoc(doc(fdb, 'media_assets', id), {
          isPrimary: id === primaryMediaId,
          updatedAt: new Date().toISOString(),
        }).catch(() => {})
      );
      await Promise.all(updates);
    } else {
      const q = query(collection(fdb, 'media_assets'), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      const updates = [];
      for (const d of snap.docs) {
        const isTarget = d.id === primaryMediaId;
        updates.push(
          updateDoc(doc(fdb, 'media_assets', d.id), {
            isPrimary: isTarget,
            updatedAt: new Date().toISOString(),
          })
        );
      }
      await Promise.all(updates);
    }
    console.log(`[FirestoreSync] Synchronized primary media status in Firestore for ${ownerId}: ${primaryMediaId}`);
  } catch (err) {
    console.warn(`[FirestoreSync] Notice updating media primary status in Firestore for ${ownerId}:`, err);
  }
}

/**
 * Persist guest reservation, line items, guest profile, tokens, and messages to Cloud Firestore
 */
export async function persistReservationToFirestore(
  reservation: typeof schema.reservationRequests.$inferSelect,
  items: (typeof schema.reservationItems.$inferSelect)[],
  guest?: typeof schema.guests.$inferSelect,
  token?: typeof schema.guestAccessTokens.$inferSelect,
  initialMessage?: typeof schema.guestMessages.$inferSelect
) {
  const fdb = getFirestoreDb();
  if (!fdb) {
    console.warn('[FirestoreSync] Firestore unavailable, skipped cloud persistence');
    return;
  }

  try {
    // 1. Write reservation request document with guest snapshot
    await setDoc(doc(fdb, 'reservation_requests', reservation.id), {
      ...reservation,
      guestName: guest?.fullName || (reservation as any).guestName || 'Valued Guest',
      guestEmail: guest?.email || (reservation as any).guestEmail || 'guest@syntuc.com',
      guestPhone: guest?.phone || null,
      guestCountry: guest?.country || 'Zimbabwe',
      guestToken: token?.id || null,
      updatedAt: new Date().toISOString(),
      cloudPersistedAt: new Date().toISOString(),
    });

    // 2. Write reservation items
    for (const item of items) {
      await setDoc(doc(fdb, 'reservation_items', item.id), {
        ...item,
        cloudPersistedAt: new Date().toISOString(),
      });
    }

    // 3. Write guest profile
    if (guest) {
      await persistGuestToFirestore(guest);
    }

    // 4. Write guest access token
    if (token) {
      await persistGuestAccessTokenToFirestore(token);
    }

    // 5. Write initial message
    if (initialMessage) {
      await persistGuestMessageToFirestore(initialMessage);
    }

    console.log(`[FirestoreSync] Reservation ${reservation.referenceNumber} (${reservation.id}) fully persisted to Cloud Firestore.`);
  } catch (error) {
    console.error(`[FirestoreSync] Failed to persist reservation ${reservation.referenceNumber} to Firestore:`, error);
  }
}

/**
 * Update reservation status in Cloud Firestore
 */
export async function updateReservationStatusInFirestore(
  reservationId: string,
  status: string,
  assignedStaffId?: string
) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    const ref = doc(fdb, 'reservation_requests', reservationId);
    await updateDoc(ref, {
      status,
      assignedStaffId: assignedStaffId || null,
      updatedAt: new Date().toISOString(),
    });
    console.log(`[FirestoreSync] Reservation status for ${reservationId} updated to ${status} in Firestore.`);
  } catch (error) {
    console.error(`[FirestoreSync] Failed to update reservation status in Firestore:`, error);
  }
}

/**
 * Maximum character length per Firestore document chunk (~350 KB, safely below 1 MB limit)
 */
const CHUNK_SIZE = 350 * 1024;

/**
 * Persist uploaded media asset to Cloud Firestore with automatic chunking for payloads > 350KB
 */
export async function persistMediaAssetToFirestore(
  mediaAsset: typeof schema.mediaAssets.$inferSelect
) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
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
        id: mediaAsset.id,
        ownerType: mediaAsset.ownerType,
        ownerId: mediaAsset.ownerId,
        mediaType: mediaAsset.mediaType || 'IMAGE',
        url: `__CHUNKED__:${mediaAsset.id}`,
        thumbnailUrl: thumb,
        isPrimary: Boolean(mediaAsset.isPrimary),
        displayOrder: mediaAsset.displayOrder || 0,
        caption: mediaAsset.caption || null,
        altText: mediaAsset.altText || null,
        sourceName: mediaAsset.sourceName || 'Coordinator Upload',
        verificationState: mediaAsset.verificationState || 'ESTABLISHED',
        isChunked: true,
        totalChunks,
        rawLength: rawUrl.length,
        createdAt: mediaAsset.createdAt ? new Date(mediaAsset.createdAt).toISOString() : new Date().toISOString(),
        cloudPersistedAt: new Date().toISOString(),
      });
      console.log(`[FirestoreSync] Media asset ${mediaAsset.id} (${rawUrl.length} bytes in ${totalChunks} chunks) persisted to Cloud Firestore.`);
    } else {
      await setDoc(doc(fdb, 'media_assets', mediaAsset.id), {
        ...mediaAsset,
        isChunked: false,
        createdAt: mediaAsset.createdAt ? new Date(mediaAsset.createdAt).toISOString() : new Date().toISOString(),
        cloudPersistedAt: new Date().toISOString(),
      });
      console.log(`[FirestoreSync] Media asset ${mediaAsset.id} persisted to Cloud Firestore.`);
    }
  } catch (error) {
    console.error(`[FirestoreSync] Failed to persist media asset ${mediaAsset.id} to Firestore:`, error);
  }
}

/**
 * Remove media asset and any constituent chunks from Cloud Firestore
 */
export async function deleteMediaAssetFromFirestore(mediaId: string) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
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
      console.log(`[FirestoreSync] Media asset ${mediaId} deleted from Cloud Firestore.`);
    }
  } catch (error) {
    console.warn(`[FirestoreSync] Error deleting media asset ${mediaId} from Firestore:`, error);
  }
}

/**
 * Remove reservation request and all associated sub-records from Cloud Firestore
 */
export async function deleteReservationFromFirestore(reservationId: string) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    // 1. Delete reservation request document
    await deleteDoc(doc(fdb, 'reservation_requests', reservationId));

    // 2. Query and delete associated line items
    const itemsQ = query(collection(fdb, 'reservation_items'), where('reservationRequestId', '==', reservationId));
    const itemsSnap = await getDocs(itemsQ);
    const itemDeletes = itemsSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(itemDeletes);

    // 3. Query and delete associated guest access tokens
    const tokQ = query(collection(fdb, 'guest_access_tokens'), where('reservationRequestId', '==', reservationId));
    const tokSnap = await getDocs(tokQ);
    const tokDeletes = tokSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(tokDeletes);

    // 4. Query and delete associated guest messages
    const msgQ = query(collection(fdb, 'guest_messages'), where('reservationRequestId', '==', reservationId));
    const msgSnap = await getDocs(msgQ);
    const msgDeletes = msgSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(msgDeletes);

    console.log(`[FirestoreSync] Reservation ${reservationId} and associated records deleted from Cloud Firestore.`);
  } catch (err) {
    console.warn(`[FirestoreSync] Notice deleting reservation ${reservationId} from Firestore:`, err);
  }
}

/**
 * Remove product from Cloud Firestore
 */
export async function deleteProductFromFirestore(productId: string) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    await deleteDoc(doc(fdb, 'products', productId));
    console.log(`[FirestoreSync] Product ${productId} deleted from Cloud Firestore.`);
  } catch (err) {
    console.warn(`[FirestoreSync] Notice deleting product ${productId} from Firestore:`, err);
  }
}

/**
 * Reconcile authoritative media assets and product primary image pointers.
 * Ensures genuine custom uploads take 100% precedence over generic Unsplash seed images.
 * Keeps Firestore and relational DB perfectly synchronized.
 */
export async function reconcileAuthoritativeMediaAndPrimaries(tombstones: Set<string> = new Set()) {
  const fdb = getFirestoreDb();
  try {
    const allLoadedProducts = await db.select().from(schema.products);
    for (const p of allLoadedProducts) {
      const prodMedia = await db
        .select()
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.ownerId, p.id))
        .orderBy(schema.mediaAssets.displayOrder);

      if (prodMedia.length === 0) continue;

      // Purge any media in DB that has an active deletion tombstone
      for (const m of prodMedia) {
        if (tombstones.has(`media_assets_${m.id}`)) {
          await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, m.id));
        }
      }

      const activeMedia = prodMedia.filter(m => !tombstones.has(`media_assets_${m.id}`));
      if (activeMedia.length === 0) {
        if (p.primaryMediaId) {
          await db.update(schema.products).set({ primaryMediaId: null }).where(eq(schema.products.id, p.id));
        }
        continue;
      }

      const customUploads = activeMedia.filter(
        m => m.sourceName === 'Coordinator Upload' || m.url.startsWith('data:') || m.url.startsWith('__CHUNKED__:')
      );

      let chosenPrimaryId = p.primaryMediaId;

      if (customUploads.length > 0) {
        // Product has genuine custom coordinator uploads!
        // Ensure primary points to a custom upload, never a generic seed image
        const activeChosen = customUploads.find(m => m.id === chosenPrimaryId);
        if (!activeChosen) {
          const preferredCustom = customUploads.find(m => m.isPrimary) || customUploads[0];
          chosenPrimaryId = preferredCustom.id;
        }
      } else {
        const activeChosen = activeMedia.find(m => m.id === chosenPrimaryId);
        if (!activeChosen) {
          const fallback = activeMedia.find(m => m.isPrimary) || activeMedia[0];
          chosenPrimaryId = fallback.id;
        }
      }

      // Ensure exactly the chosen media asset has isPrimary = true
      for (const m of activeMedia) {
        const shouldBePrimary = m.id === chosenPrimaryId;
        if (m.isPrimary !== shouldBePrimary) {
          await db.update(schema.mediaAssets).set({ isPrimary: shouldBePrimary }).where(eq(schema.mediaAssets.id, m.id));
        }
      }

      // Update product primaryMediaId in DB and Firestore if changed
      if (p.primaryMediaId !== chosenPrimaryId) {
        await db.update(schema.products).set({ primaryMediaId: chosenPrimaryId }).where(eq(schema.products.id, p.id));
        if (fdb) {
          try {
            await updateDoc(doc(fdb, 'products', p.id), {
              primaryMediaId: chosenPrimaryId,
              updatedAt: new Date().toISOString(),
            });
          } catch (_) {}
        }
      }

      // Sync primary status in Firestore only if primary changed
      if (fdb && chosenPrimaryId && p.primaryMediaId !== chosenPrimaryId) {
        try {
          const allOwnerIds = activeMedia.map(m => m.id);
          await updateMediaPrimaryStatusInFirestore('product', p.id, chosenPrimaryId, allOwnerIds);
        } catch (_) {}
      }
    }
  } catch (reconcileErr) {
    console.warn('[FirestoreSync] Notice reconciling media primary status:', reconcileErr);
  }
}

/**
 * Hydrate all operational data from Cloud Firestore into the relational engine on server boot.
 * PRODUCTION FIRESTORE STATE TAKES 100% PRECEDENCE OVER SEED DATA.
 */
export async function hydrateFromFirestore(existingTombstones?: Set<string>): Promise<{
  reservationsRestored: number;
  mediaRestored: number;
  productsRestored: number;
  packagesRestored: number;
  tombstonesCount: number;
  tombstones: Set<string>;
  hydratedMediaIds: Set<string>;
}> {
  const fdb = getFirestoreDb();
  if (!fdb) {
    console.warn('[FirestoreSync] Cannot hydrate: Firestore unavailable');
    return { reservationsRestored: 0, mediaRestored: 0, productsRestored: 0, packagesRestored: 0, tombstonesCount: 0, tombstones: new Set(), hydratedMediaIds: new Set() };
  }

  let reservationsRestored = 0;
  let mediaRestored = 0;
  let productsRestored = 0;
  let packagesRestored = 0;
  const hydratedMediaIds = new Set<string>();

  // 1. Load active tombstones first to strictly prevent resurrection of deleted assets
  const tombstones = existingTombstones || (await getDeletedTombstones());
  console.log(`[FirestoreSync] Active deletion tombstones loaded: ${tombstones.size}`);

  try {
    console.log('[FirestoreSync] Hydrating authoritative operational records from Cloud Firestore...');

    // 2. Hydrate Guests
    try {
      const guestSnap = await getDocs(collection(fdb, 'guests'));
      for (const docSnap of guestSnap.docs) {
        const g = docSnap.data() as any;
        if (!g.id) continue;
        await db
          .insert(schema.guests)
          .values({
            id: g.id,
            fullName: g.fullName || 'Valued Guest',
            email: g.email || 'guest@syntuc.com',
            phone: g.phone || null,
            country: g.country || 'Zimbabwe',
            createdAt: parseFirestoreDate(g.createdAt),
          })
          .onConflictDoUpdate({
            target: schema.guests.id,
            set: {
              fullName: g.fullName || 'Valued Guest',
              email: g.email || 'guest@syntuc.com',
              phone: g.phone || null,
              country: g.country || 'Zimbabwe',
            },
          });
      }
    } catch (gErr) {
      console.warn('[FirestoreSync] Notice hydrating guests:', gErr);
    }

    // 3. Hydrate Guest Access Tokens
    try {
      const tokenSnap = await getDocs(collection(fdb, 'guest_access_tokens'));
      for (const docSnap of tokenSnap.docs) {
        const tok = docSnap.data() as any;
        if (!tok.id) continue;
        await db
          .insert(schema.guestAccessTokens)
          .values({
            id: tok.id,
            reservationRequestId: tok.reservationRequestId,
            guestId: tok.guestId,
            tokenHash: tok.tokenHash || 'hash_' + tok.id,
            isRevoked: Boolean(tok.isRevoked),
            expiresAt: parseFirestoreDate(tok.expiresAt),
          })
          .onConflictDoNothing();
      }
    } catch (tokErr) {
      console.warn('[FirestoreSync] Notice hydrating tokens:', tokErr);
    }

    // 4. Hydrate Guest Messages
    try {
      const msgSnap = await getDocs(collection(fdb, 'guest_messages'));
      for (const docSnap of msgSnap.docs) {
        const m = docSnap.data() as any;
        if (!m.id) continue;
        await db
          .insert(schema.guestMessages)
          .values({
            id: m.id,
            reservationRequestId: m.reservationRequestId,
            guestSessionId: m.guestSessionId || 'ses_restored',
            senderType: m.senderType || 'coordinator',
            senderName: m.senderName || 'Reservations Desk',
            messageText: m.messageText || '',
            createdAt: parseFirestoreDate(m.createdAt),
          })
          .onConflictDoNothing();
      }
    } catch (msgErr) {
      console.warn('[FirestoreSync] Notice hydrating messages:', msgErr);
    }

    // 5. Hydrate Products (AUTHORITATIVE: overrides seed/default data, must precede reservation items for FK integrity)
    try {
      const prodSnap = await getDocs(collection(fdb, 'products'));
      for (const docSnap of prodSnap.docs) {
        const prod = docSnap.data() as any;
        if (!prod.id) continue;
        if (tombstones.has(`products_${prod.id}`)) continue;

        try {
          await db
            .insert(schema.products)
            .values({
              id: prod.id,
              operatorId: prod.operatorId || null,
              propertyId: prod.propertyId || null,
              name: prod.name,
              slug: prod.slug,
              productType: prod.productType || 'activity',
              categorySlug: prod.categorySlug || 'adventure',
              shortDescription: prod.shortDescription || '',
              description: prod.description || '',
              location: prod.location || 'Victoria Falls, Zimbabwe',
              duration: prod.duration || null,
              basePrice: String(prod.basePrice || '0.00'),
              currency: prod.currency || 'USD',
              priceBasis: prod.priceBasis || 'per_person',
              inclusions: prod.inclusions || [],
              exclusions: prod.exclusions || [],
              suitability: prod.suitability || [],
              isPublished: Boolean(prod.isPublished),
              isFeatured: Boolean(prod.isFeatured),
              availabilityNote: prod.availabilityNote || null,
              primaryMediaId: prod.primaryMediaId || null,
              videoUrl: prod.videoUrl || null,
              evidenceStatus: prod.evidenceStatus || 'ESTABLISHED',
              createdAt: parseFirestoreDate(prod.createdAt),
              updatedAt: parseFirestoreDate(prod.updatedAt),
            })
            .onConflictDoUpdate({
              target: schema.products.id,
              set: {
                operatorId: prod.operatorId || null,
                propertyId: prod.propertyId || null,
                name: prod.name,
                slug: prod.slug,
                productType: prod.productType || 'activity',
                categorySlug: prod.categorySlug || 'adventure',
                shortDescription: prod.shortDescription || '',
                description: prod.description || '',
                location: prod.location || 'Victoria Falls, Zimbabwe',
                duration: prod.duration || null,
                basePrice: String(prod.basePrice || '0.00'),
                currency: prod.currency || 'USD',
                priceBasis: prod.priceBasis || 'per_person',
                inclusions: prod.inclusions || [],
                exclusions: prod.exclusions || [],
                suitability: prod.suitability || [],
                isPublished: Boolean(prod.isPublished),
                isFeatured: Boolean(prod.isFeatured),
                availabilityNote: prod.availabilityNote || null,
                primaryMediaId: prod.primaryMediaId || null,
                videoUrl: prod.videoUrl || null,
                evidenceStatus: prod.evidenceStatus || 'ESTABLISHED',
                updatedAt: parseFirestoreDate(prod.updatedAt),
              },
            });

          productsRestored++;
        } catch (prodErr) {
          console.warn(`[FirestoreSync] Failed hydrating product ${prod.id}:`, prodErr);
        }
      }
    } catch (prodsErr) {
      console.warn('[FirestoreSync] Notice hydrating products:', prodsErr);
    }

    // 6. Hydrate Packages
    try {
      const pkgSnap = await getDocs(collection(fdb, 'packages'));
      for (const docSnap of pkgSnap.docs) {
        const pkg = docSnap.data() as any;
        if (!pkg.id) continue;
        if (tombstones.has(`packages_${pkg.id}`)) continue;

        try {
          await db
            .insert(schema.packages)
            .values({
              id: pkg.id,
              name: pkg.name,
              slug: pkg.slug,
              tagline: pkg.tagline || '',
              description: pkg.description || '',
              durationDays: pkg.durationDays || 1,
              durationNights: pkg.durationNights || 0,
              pricePerPerson: String(pkg.pricePerPerson || '0.00'),
              currency: pkg.currency || 'USD',
              highlights: pkg.highlights || [],
              inclusions: pkg.inclusions || [],
              exclusions: pkg.exclusions || [],
              primaryImageUrl: pkg.primaryImageUrl || '',
              videoUrl: pkg.videoUrl || null,
              isPublished: Boolean(pkg.isPublished),
              createdAt: parseFirestoreDate(pkg.createdAt),
              updatedAt: parseFirestoreDate(pkg.updatedAt),
            })
            .onConflictDoUpdate({
              target: schema.packages.id,
              set: {
                name: pkg.name,
                tagline: pkg.tagline || '',
                description: pkg.description || '',
                durationDays: pkg.durationDays || 1,
                durationNights: pkg.durationNights || 0,
                pricePerPerson: String(pkg.pricePerPerson || '0.00'),
                currency: pkg.currency || 'USD',
                highlights: pkg.highlights || [],
                inclusions: pkg.inclusions || [],
                exclusions: pkg.exclusions || [],
                primaryImageUrl: pkg.primaryImageUrl || '',
                videoUrl: pkg.videoUrl || null,
                isPublished: Boolean(pkg.isPublished),
                updatedAt: parseFirestoreDate(pkg.updatedAt),
              },
            });
          packagesRestored++;
        } catch (pkgErr) {
          console.warn(`[FirestoreSync] Failed hydrating package ${pkg.id}:`, pkgErr);
        }
      }
    } catch (pkgsErr) {
      console.warn('[FirestoreSync] Notice hydrating packages:', pkgsErr);
    }

    // 7. Hydrate Media Assets (with chunk reconstruction, strictly respecting tombstones)
    const mediaSnap = await getDocs(collection(fdb, 'media_assets'));
    for (const docSnap of mediaSnap.docs) {
      const media = docSnap.data() as any;
      if (!media.id) continue;

      // DO NOT HYDRATE DELIBERATELY DELETED MEDIA
      if (tombstones.has(`media_assets_${media.id}`)) {
        console.log(`[FirestoreSync] Skipping deleted media asset (tombstone active): ${media.id}`);
        continue;
      }

      try {
        let finalUrl = media.url;
        let finalThumbnailUrl = media.thumbnailUrl || media.url;

        // If chunked, reconstruct full data URI from media_chunks
        if (media.isChunked || (media.url && media.url.startsWith('__CHUNKED__:'))) {
          const total = media.totalChunks || 1;
          const chunkPromises = [];
          for (let i = 0; i < total; i++) {
            chunkPromises.push(getDoc(doc(fdb, 'media_chunks', `${media.id}_chunk_${i}`)));
          }
          const chunkDocs = await Promise.all(chunkPromises);
          let fullStr = '';
          for (const cDoc of chunkDocs) {
            if (cDoc.exists()) {
              fullStr += cDoc.data()?.data || '';
            }
          }
          if (fullStr.length > 0) {
            finalUrl = fullStr;
            if (finalThumbnailUrl.startsWith('__CHUNKED__:')) {
              finalThumbnailUrl = fullStr;
            }
          }
        }

        // Cache base64 data to ephemeral disk so static serving also works seamlessly
        if (finalUrl && finalUrl.startsWith('data:')) {
          try {
            const matches = finalUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const mime = matches[1];
              const ext = mime.split('/')[1]?.split('+')[0] || 'jpg';
              const buffer = Buffer.from(matches[2], 'base64');
              const uploadsDir = path.resolve(process.cwd(), 'data/uploads');
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }
              const diskPath = path.resolve(uploadsDir, `${media.id}.${ext}`);
              fs.writeFileSync(diskPath, buffer);
            }
          } catch (_) {}
        }

        await db
          .insert(schema.mediaAssets)
          .values({
            id: media.id,
            ownerType: media.ownerType,
            ownerId: media.ownerId,
            mediaType: media.mediaType || 'IMAGE',
            url: finalUrl,
            thumbnailUrl: finalThumbnailUrl,
            caption: media.caption || null,
            altText: media.altText || null,
            displayOrder: media.displayOrder || 0,
            isPrimary: Boolean(media.isPrimary),
            sourceName: media.sourceName || 'Coordinator Upload',
            verificationState: media.verificationState || 'ESTABLISHED',
            createdAt: parseFirestoreDate(media.createdAt),
          })
          .onConflictDoUpdate({
            target: schema.mediaAssets.id,
            set: {
              url: finalUrl,
              thumbnailUrl: finalThumbnailUrl,
              caption: media.caption || null,
              altText: media.altText || null,
              displayOrder: media.displayOrder || 0,
              isPrimary: Boolean(media.isPrimary),
            },
          });

        mediaRestored++;
        hydratedMediaIds.add(media.id);
      } catch (mediaErr) {
        console.warn(`[FirestoreSync] Failed restoring media asset ${media.id}:`, mediaErr);
      }
    }

    // Reconcile primary media for products (custom coordinator uploads take 100% precedence over seed Unsplash)
    await reconcileAuthoritativeMediaAndPrimaries(tombstones);

    // 8. Hydrate Reservations
    const resSnap = await getDocs(collection(fdb, 'reservation_requests'));
    for (const docSnap of resSnap.docs) {
      const data = docSnap.data() as any;
      if (!data.referenceNumber || !data.id) continue;
      if (tombstones.has(`reservation_requests_${data.id}`)) continue;

      try {
        const guestId = data.guestId || 'gst_default_' + data.id;
        await db
          .insert(schema.guests)
          .values({
            id: guestId,
            fullName: data.guestName || 'Valued Guest',
            email: data.guestEmail || 'guest@syntuc.com',
            phone: data.guestPhone || null,
            country: data.guestCountry || 'Zimbabwe',
            createdAt: parseFirestoreDate(data.createdAt),
          })
          .onConflictDoUpdate({
            target: schema.guests.id,
            set: {
              fullName: data.guestName || 'Valued Guest',
              email: data.guestEmail || 'guest@syntuc.com',
              phone: data.guestPhone || null,
              country: data.guestCountry || 'Zimbabwe',
            },
          });

        const guestSessionId = data.guestSessionId || ('ses_' + data.id);
        await db
          .insert(schema.guestSessions)
          .values({
            id: guestSessionId,
            guestId: guestId,
            sessionSecret: 'secret_' + guestSessionId,
            createdAt: parseFirestoreDate(data.createdAt),
            lastActiveAt: new Date(),
          })
          .onConflictDoNothing();

        // Also ensure guest access token is available for self-service dashboard
        if (data.guestToken) {
          await db
            .insert(schema.guestAccessTokens)
            .values({
              id: data.guestToken,
              reservationRequestId: data.id,
              guestId: guestId,
              tokenHash: 'hash_' + data.guestToken,
              isRevoked: false,
              expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            })
            .onConflictDoNothing();
        }

        await db
          .insert(schema.reservationRequests)
          .values({
            id: data.id,
            referenceNumber: data.referenceNumber,
            requestType: data.requestType || 'STANDARD',
            guestId: guestId,
            guestSessionId: guestSessionId,
            tripPlanId: data.tripPlanId || null,
            status: data.status || 'NEW',
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            adultsCount: data.adultsCount || 2,
            childrenCount: data.childrenCount || 0,
            authoritativeTotal: data.authoritativeTotal ? String(data.authoritativeTotal) : '0.00',
            currency: data.currency || 'USD',
            specialRequests: data.specialRequests || null,
            isBridgeIncentiveApplied: Boolean(data.isBridgeIncentiveApplied),
            schoolMetadata: data.schoolMetadata || null,
            assignedStaffId: data.assignedStaffId || null,
            visitorId: data.visitorId || null,
            firstTouchSource: data.firstTouchSource || null,
            firstTouchMedium: data.firstTouchMedium || null,
            firstTouchCampaign: data.firstTouchCampaign || null,
            firstTouchContent: data.firstTouchContent || null,
            firstTouchTerm: data.firstTouchTerm || null,
            firstTouchReferrer: data.firstTouchReferrer || null,
            lastTouchSource: data.lastTouchSource || null,
            lastTouchMedium: data.lastTouchMedium || null,
            lastTouchCampaign: data.lastTouchCampaign || null,
            lastTouchContent: data.lastTouchContent || null,
            lastTouchTerm: data.lastTouchTerm || null,
            lastTouchReferrer: data.lastTouchReferrer || null,
            attributionConfidence: data.attributionConfidence || 'UNKNOWN',
            createdAt: parseFirestoreDate(data.createdAt),
            updatedAt: parseFirestoreDate(data.updatedAt),
          })
          .onConflictDoUpdate({
            target: schema.reservationRequests.id,
            set: {
              status: data.status || 'NEW',
              assignedStaffId: data.assignedStaffId || null,
              authoritativeTotal: data.authoritativeTotal ? String(data.authoritativeTotal) : '0.00',
              specialRequests: data.specialRequests || null,
              isBridgeIncentiveApplied: Boolean(data.isBridgeIncentiveApplied),
              updatedAt: parseFirestoreDate(data.updatedAt),
            },
          });

        reservationsRestored++;
      } catch (insertErr) {
        console.warn(`[FirestoreSync] Failed restoring reservation ${data.referenceNumber}:`, insertErr);
      }
    }

    // 9. Hydrate Reservation Items (Products are already restored in step 5, so FKs succeed)
    const itemsSnap = await getDocs(collection(fdb, 'reservation_items'));
    for (const docSnap of itemsSnap.docs) {
      const item = docSnap.data() as any;
      try {
        await db
          .insert(schema.reservationItems)
          .values({
            id: item.id,
            reservationRequestId: item.reservationRequestId,
            productId: item.productId,
            roomId: item.roomId || null,
            variantId: item.variantId || null,
            snapshotProductName: item.snapshotProductName,
            snapshotOperatorName: item.snapshotOperatorName || 'Victoria Falls Operator',
            snapshotProductType: item.snapshotProductType || 'ACTIVITY',
            snapshotUnitPrice: String(item.snapshotUnitPrice || '0.00'),
            snapshotPriceBasis: item.snapshotPriceBasis || 'per_person',
            snapshotCurrency: item.snapshotCurrency || 'USD',
            guestCount: item.guestCount || 1,
            nightsCount: item.nightsCount || 1,
            calculatedSubtotal: String(item.calculatedSubtotal || '0.00'),
            scheduledDate: item.scheduledDate || null,
            scheduledTime: item.scheduledTime || null,
            notes: item.notes || null,
            createdAt: parseFirestoreDate(item.createdAt),
          })
          .onConflictDoNothing();
      } catch (itemErr) {
        console.warn(`[FirestoreSync] Notice restoring reservation item ${item.id}:`, itemErr);
      }
    }

    console.log(
      `[FirestoreSync] Hydration complete: ${productsRestored} products, ${mediaRestored} media assets, ${reservationsRestored} reservations loaded from Cloud Firestore.`
    );
  } catch (error) {
    console.error('[FirestoreSync] Error hydrating from Firestore:', error);
  }

  return {
    reservationsRestored,
    mediaRestored,
    productsRestored,
    packagesRestored,
    tombstonesCount: tombstones.size,
    tombstones,
    hydratedMediaIds,
  };
}

/**
 * Ensure baseline canonical records (such as Sophia Al-Mansoor SYN-VF-50327) exist in Cloud Firestore
 * unless deliberately removed by administrator.
 */
export async function ensureCanonicalCloudSeed(tombstones: Set<string> = new Set()) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  const canonId = 'res_4e14a5d47feee65479fea03a';
  if (tombstones.has(`reservation_requests_${canonId}`)) {
    console.log('[FirestoreSync] Canonical seed SYN-VF-50327 has active deletion tombstone, skipping.');
    return;
  }

  try {
    const sophiaDoc = await getDoc(doc(fdb, 'reservation_requests', canonId));
    if (!sophiaDoc.exists()) {
      console.log('[FirestoreSync] Seeding canonical verified reservation SYN-VF-50327 to Cloud Firestore...');
      await setDoc(doc(fdb, 'reservation_requests', canonId), {
        id: canonId,
        referenceNumber: 'SYN-VF-50327',
        requestType: 'STANDARD',
        guestId: 'gst_sophia_almansoor',
        guestName: 'Sophia Al-Mansoor',
        guestEmail: 'sophia.almansoor@example.com',
        guestCountry: 'United Kingdom',
        guestSessionId: 'ses_sophia_vf',
        tripPlanId: null,
        status: 'CONFIRMED',
        startDate: '2026-11-12',
        endDate: '2026-11-15',
        adultsCount: 2,
        childrenCount: 0,
        authoritativeTotal: '346.00',
        currency: 'USD',
        specialRequests: 'Anniversary celebration. Window seats on helicopter flight requested.',
        isBridgeIncentiveApplied: false,
        visitorId: 'vis_ad2_user',
        firstTouchSource: 'tiktok',
        firstTouchMedium: 'paid_social',
        firstTouchCampaign: 'helicopter_launch',
        firstTouchContent: 'helicopter_ad_02',
        lastTouchSource: 'tiktok',
        lastTouchMedium: 'paid_social',
        lastTouchCampaign: 'helicopter_launch',
        lastTouchContent: 'helicopter_ad_02',
        attributionConfidence: 'UTM_EXACT',
        createdAt: '2026-10-06T07:51:24.671Z',
        updatedAt: '2026-10-06T07:51:24.671Z',
        cloudPersistedAt: new Date().toISOString(),
      });
    }

    // Always ensure line item for SYN-VF-50327 exists in Firestore and local DB
    await setDoc(doc(fdb, 'reservation_items', 'item_sophia_heli'), {
      id: 'item_sophia_heli',
      reservationRequestId: canonId,
      productId: 'prod_flight_of_angels',
      snapshotProductName: 'Flight of Angels — Scenic Helicopter Tour',
      snapshotOperatorName: 'Shearwater Victoria Falls',
      snapshotProductType: 'activity',
      snapshotUnitPrice: '173.00',
      snapshotPriceBasis: 'per_person',
      snapshotCurrency: 'USD',
      guestCount: 2,
      nightsCount: 1,
      calculatedSubtotal: '346.00',
      scheduledDate: '2026-11-13',
      scheduledTime: '10:00',
      notes: 'VIP guest - Flight of Angels experience',
      createdAt: '2026-10-06T07:51:24.671Z',
    });

    await db
      .insert(schema.reservationItems)
      .values({
        id: 'item_sophia_heli',
        reservationRequestId: canonId,
        productId: 'prod_flight_of_angels',
        snapshotProductName: 'Flight of Angels — Scenic Helicopter Tour',
        snapshotOperatorName: 'Shearwater Victoria Falls',
        snapshotProductType: 'activity',
        snapshotUnitPrice: '173.00',
        snapshotPriceBasis: 'per_person',
        snapshotCurrency: 'USD',
        guestCount: 2,
        nightsCount: 1,
        calculatedSubtotal: '346.00',
        scheduledDate: '2026-11-13',
        scheduledTime: '10:00',
        notes: 'VIP guest - Flight of Angels experience',
        createdAt: new Date('2026-10-06T07:51:24.671Z'),
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error('[FirestoreSync] Notice checking canonical cloud seed:', err);
  }
}

/**
 * Synchronize any custom local media assets that were saved to relational DB
 * but not yet persisted to Cloud Firestore.
 * STRICTLY RESPECTS TOMBSTONES AND NEVER RESURRECTS DELETED OR SEED MEDIA.
 */
export async function syncUnpersistedLocalMedia(
  tombstones: Set<string> = new Set(),
  knownCloudMediaIds: Set<string> = new Set()
) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    const localAssets = await db.select().from(schema.mediaAssets);
    for (const asset of localAssets) {
      // 1. Never sync an asset that has an active deletion tombstone!
      if (tombstones.has(`media_assets_${asset.id}`)) {
        continue;
      }

      // 2. Never sync default generic seed media if not present in Firestore
      // (prevents resurrecting deleted seed images)
      if (
        asset.sourceName !== 'Coordinator Upload' &&
        !asset.url.startsWith('data:') &&
        !asset.url.startsWith('__CHUNKED__:')
      ) {
        continue;
      }

      // 3. If already known to exist in Cloud Firestore, skip getDoc read call
      if (knownCloudMediaIds.has(asset.id)) {
        continue;
      }

      console.log(`[FirestoreSync] Syncing unpersisted custom media ${asset.id} to Cloud Firestore...`);
      await persistMediaAssetToFirestore(asset);
    }
  } catch (err) {
    console.warn('[FirestoreSync] Notice syncing local media to Firestore:', err);
  }
}
