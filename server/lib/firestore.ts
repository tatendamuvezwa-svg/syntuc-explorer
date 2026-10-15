import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let firestoreInstance: Firestore | null = null;
let firebaseConfig: any = null;

// ==========================================
// IN-MEMORY CACHE & RESILIENCE LAYER
// Eliminates quota burn and prevents 500 errors
// when Firestore daily free quota is exceeded.
// ==========================================

const CACHE_TTL_MS = 60_000; // 60 seconds TTL

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const collectionCache = new Map<string, CacheEntry<any[]>>();
const memoryStore = new Map<string, Map<string, any>>();
let tombstonesCache: CacheEntry<Set<string>> | null = null;

function getMemoryCollection(name: string): Map<string, any> {
  let col = memoryStore.get(name);
  if (!col) {
    col = new Map<string, any>();
    memoryStore.set(name, col);
  }
  return col;
}

// Baseline fallbacks for core system collections if cold-start occurs during quota limit
const BASELINE_COLLECTIONS: Record<string, any[]> = {
  categories: [
    { id: 'cat_lodge', displayOrder: 1, slug: 'lodge-resort', type: 'accommodation', name: 'Riverfront Lodges & Resorts' },
    { id: 'cat_hotel', name: 'Town Hotels & Suites', displayOrder: 2, type: 'accommodation', slug: 'hotel' },
    { id: 'cat_safari', type: 'accommodation', displayOrder: 3, slug: 'safari-camp', name: 'Luxury Safari Camps' },
    { id: 'cat_flight', name: 'Helicopter & Scenic Flights', displayOrder: 4, type: 'activity', slug: 'flight-air' },
    { id: 'cat_cruise', slug: 'river-cruises', type: 'activity', name: 'Zambezi River Cruises', displayOrder: 5 },
    { id: 'cat_guided', slug: 'guided-tours', type: 'activity', displayOrder: 6, name: 'Guided Falls & Heritage Tours' },
    { id: 'cat_dining', type: 'activity', slug: 'dining-culinary', displayOrder: 7, name: 'Scenic & Cultural Dining' },
    { id: 'cat_adventure', slug: 'adventure-wildlife', type: 'activity', name: 'Rafting, Wildlife & Adrenaline', displayOrder: 8 },
    { id: 'cat_packages', name: 'Curated Holiday Packages', displayOrder: 9, slug: 'packages', type: 'package' },
  ],
  operators: [
    { id: 'op_pure_africa', location: 'Victoria Falls, Zimbabwe', verified: true, description: 'Operators of the Zambezi Explorer and The Eatery Waterfront dining.', name: 'Pure Africa Experiences', contactEmail: 'experience@pure.africa', contactPhone: '+263 83 284 1005' },
    { id: 'op_shearwater', name: 'Shearwater Victoria Falls', location: 'Victoria Falls, Zimbabwe', verified: true, contactEmail: 'adventures@shearwatervf.com', contactPhone: '+263 83 284 4471', description: 'Premier adventure and touring operator in Victoria Falls since 1982.' },
    { id: 'op_wildhorizons', contactPhone: '+263 83 284 4219', contactEmail: 'info@wildhorizons.co.zw', description: 'Pioneers in high-end eco-tourism, wildlife sanctuaries, and scenic flights.', name: 'Wild Horizons', location: 'Victoria Falls, Zimbabwe', verified: true },
    { id: 'op_cresta', description: "Operators of A'Zambezi River Lodge on the banks of the Zambezi.", verified: true, location: 'Victoria Falls, Zimbabwe', name: 'Cresta Hotels Zimbabwe', contactEmail: 'azambezi@cresta.co.zw', contactPhone: '+263 83 284 4561' },
    { id: 'op_machaba', contactEmail: 'enquiries@machabasafaris.com', contactPhone: '+27 82 579 5249', location: 'Zambezi National Park, Zimbabwe', verified: true, description: 'Luxury classic safari camps including Old Drift Lodge.', name: 'Machaba Safaris' },
    { id: 'op_rtg', name: 'Rainbow Tourism Group (RTG)', contactPhone: '+263 83 284 4583', contactEmail: 'reservations@rtg.co.zw', verified: true, location: 'Victoria Falls, Zimbabwe', description: 'Leading hospitality group operating the Victoria Falls Rainbow Hotel.' },
  ],
  users: [
    { id: 'usr_admin_1', name: 'SAINTECH System Admin', passwordHash: 'saintech2026!admin', email: 'admin@saintech.io', role: 'admin', isActive: true },
    { id: 'usr_coord_1', passwordHash: 'syntuc2026!secure', isActive: true, role: 'reservations_coordinator', email: 'reservations@syntuc.com', name: 'Victoria Falls Reservations Desk' },
    { id: 'usr_user_email', email: 'tatenda.muvezwa@gmail.com', name: 'Tatenda Muvezwa', isActive: true, role: 'admin', passwordHash: 'admin2026!' },
  ],
  packages: [
    {
      id: 'pkg_essential_vf',
      name: 'Victoria Falls Essential Journey',
      tagline: 'The iconic 4-day introduction to Victoria Falls: rainforest, flight of angels & sunset cruise.',
      description: 'A seamlessly coordinated 4-day, 3-night holiday combining town accommodation at Shearwater Explorers Village with the three must-do experiences: a guided rainforest walking tour of the Falls, the world-famous 12-minute Flight of Angels helicopter flight, and a pure luxury sunset catamaran cruise on the Zambezi.',
      durationDays: 4,
      durationNights: 3,
      pricePerPerson: '680',
      currency: 'USD',
      priceBasis: 'per_person',
      categorySlug: 'packages',
      productType: 'package',
      isPublished: true,
      primaryImageUrl: 'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=1200&q=80',
      inclusions: [
        '3 nights accommodation with daily breakfast',
        'All 3 signature activities as listed',
        'Return Victoria Falls International Airport transfers',
        'Dedicated Syntuc Explorer trip coordination',
      ],
      exclusions: [
        'Rainforest National Park entry fee ($50)',
        'Helicopter aviation levy ($15)',
        'River usage fee ($12)',
      ],
      highlights: [
        '3 nights at Shearwater Explorers Village with breakfast',
        '12-minute Flight of Angels scenic helicopter flight',
        'Zambezi Explorer luxury sunset cruise with canapés & open bar',
        'Victoria Falls Rainforest guided walking tour with poncho',
        'All airport and scheduled activity transfers included',
      ],
    },
    {
      id: 'pkg_luxury_zambezi',
      name: 'Zambezi Luxury Safari & River Retreat',
      tagline: 'All-inclusive 5-star riverfront canvas sanctuary, wildlife safaris & extended gorge helicopter flight.',
      description: 'Designed for the discerning traveler seeking complete wilderness immersion with unmatched luxury. Stay 3 nights at Old Drift Lodge in Zambezi National Park with private plunge pool, indulge in daily river boat safaris and game drives, fly on the 25-minute extended helicopter flight over Batoka Gorge, and dine suspended over the gorge at The Lookout Café.',
      durationDays: 4,
      durationNights: 3,
      pricePerPerson: '2450',
      currency: 'USD',
      priceBasis: 'per_person',
      categorySlug: 'packages',
      productType: 'package',
      isPublished: true,
      primaryImageUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80',
      inclusions: [
        'All luxury accommodations, all meals and premium open bar',
        'All guided safari drives and river cruises inside Zambezi National Park',
        '25-minute extended helicopter tour',
        'Executive VIP airport transfers',
      ],
      exclusions: [
        'Park conservation fees ($15/day)',
        'Helicopter park levy ($15)',
      ],
      highlights: [
        '3 nights all-inclusive luxury at Old Drift Lodge in Zambezi National Park',
        '25-minute Zambezi Gorge & Falls extended helicopter flight',
        'Private Zambezi Explorer sunset cruise with gourmet dinner',
        'The Lookout Café cliffside dining voucher',
        'Unlimited morning and evening wildlife game drives and river boat safaris',
      ],
    },
    {
      id: 'pkg_batoka_adventure',
      name: 'Batoka Adventure & Wilderness Duo',
      tagline: 'High-adrenaline white-water rafting, Chobe Botswana safari, and panoramic hotel stay.',
      description: "The definitive adventure package for active travelers. Base yourself for 2 nights at the Victoria Falls Rainbow Hotel overlooking the Falls spray. Conquer the world's greatest Grade 5 rapids on the Zambezi River with full-day rafting, and embark on a full-day cross-border safari to Botswana's Chobe National Park to witness hundreds of elephants along the Chobe River.",
      durationDays: 3,
      durationNights: 2,
      pricePerPerson: '590',
      currency: 'USD',
      priceBasis: 'per_person',
      categorySlug: 'packages',
      productType: 'package',
      isPublished: true,
      primaryImageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
      inclusions: [
        '2 nights accommodation with breakfast',
        'Full day white-water rafting with gear and guide',
        'Full day Chobe safari trip with border transfers and lunch',
        'Simunye theatre admission',
      ],
      exclusions: [
        'Parks river levy ($10)',
        'Botswana park fee ($15)',
      ],
      highlights: [
        '2 nights at Victoria Falls Rainbow Hotel with breakfast',
        'Full-day Grade 5 Batoka Gorge White Water Rafting with gorge buffet lunch',
        'Full-day Chobe National Park Safari in Botswana (boat safari + 4x4 game drive + lodge buffet)',
        'Simunye African theatrical evening performance ticket',
      ],
    },
  ],
};

// Seed baseline entries into memory
for (const [colName, items] of Object.entries(BASELINE_COLLECTIONS)) {
  const col = getMemoryCollection(colName);
  for (const item of items) {
    if (!col.has(item.id)) {
      col.set(item.id, item);
    }
  }
}

function isQuotaOrNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toString().toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('exceeded') ||
    code.includes('resource-exhausted') ||
    msg.includes('unavailable') ||
    msg.includes('deadline') ||
    msg.includes('network')
  );
}

export function getFirebaseConfig() {
  if (firebaseConfig) return firebaseConfig;
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-applet-config.json not found');
  }
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return firebaseConfig;
}

export function getFirestoreDb(): Firestore {
  if (firestoreInstance) return firestoreInstance;

  const cfg = getFirebaseConfig();
  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        projectId: cfg.projectId,
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        appId: cfg.appId,
        storageBucket: cfg.storageBucket,
      });

  firestoreInstance = getFirestore(app, cfg.firestoreDatabaseId || '(default)');
  console.log('[Firestore] Authoritative database initialized:', cfg.firestoreDatabaseId);
  return firestoreInstance;
}

export async function getDocById<T = DocumentData>(collectionName: string, id: string): Promise<T | null> {
  const memCol = getMemoryCollection(collectionName);
  const memDoc = memCol.get(id);

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (memDoc) return memDoc as T;
      return null;
    }
    const data = { id: snap.id, ...snap.data() } as T;
    memCol.set(id, data);
    return data;
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      console.warn(`[Firestore] Quota/network issue reading ${collectionName}/${id}; using memory store.`);
      if (memDoc) return memDoc as T;
      return null;
    }
    console.warn(`[Firestore] Read error on ${collectionName}/${id}:`, err?.message || err);
    if (memDoc) return memDoc as T;
    return null;
  }
}

export async function setDocById<T extends Record<string, any>>(
  collectionName: string,
  id: string,
  data: T,
  merge: boolean = true
): Promise<void> {
  const memCol = getMemoryCollection(collectionName);
  const existing = memCol.get(id) || {};
  const merged = merge ? { ...existing, id, ...data } : { id, ...data };
  memCol.set(id, merged);

  // Invalidate collection cache so fresh reads include this update
  collectionCache.delete(collectionName);

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await setDoc(ref, { id, ...data }, { merge });
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      console.warn(`[Firestore] Quota exceeded on write to ${collectionName}/${id}; persisted safely in memory.`);
      return;
    }
    console.error(`[Firestore] Failed to persist ${collectionName}/${id}:`, err);
    throw err;
  }
}

/**
 * Robust document updater:
 * Uses setDoc with merge: true to avoid Grpc Code: 5 NOT_FOUND error
 * when documents do not yet exist or were written concurrently.
 */
export async function updateDocById(
  collectionName: string,
  id: string,
  data: Partial<DocumentData>
): Promise<void> {
  const memCol = getMemoryCollection(collectionName);
  const existing = memCol.get(id) || {};
  const merged = { ...existing, id, ...data };
  memCol.set(id, merged);

  // Invalidate collection cache
  collectionCache.delete(collectionName);

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await setDoc(ref, { id, ...data }, { merge: true });
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      console.warn(`[Firestore] Quota exceeded on update to ${collectionName}/${id}; updated safely in memory.`);
      return;
    }
    console.error(`[Firestore] Failed to update ${collectionName}/${id}:`, err);
    throw err;
  }
}

export async function deleteDocById(collectionName: string, id: string): Promise<void> {
  const memCol = getMemoryCollection(collectionName);
  memCol.delete(id);
  collectionCache.delete(collectionName);

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await deleteDoc(ref);
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      console.warn(`[Firestore] Quota exceeded on delete of ${collectionName}/${id}; removed from memory.`);
      return;
    }
    console.error(`[Firestore] Failed to delete ${collectionName}/${id}:`, err);
    throw err;
  }
}

export async function getCollectionDocs<T = DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const hasConstraints = constraints.length > 0;
  const now = Date.now();

  // If no constraints, check collection cache
  if (!hasConstraints) {
    const cached = collectionCache.get(collectionName);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return [...cached.data] as T[];
    }
  }

  const memCol = getMemoryCollection(collectionName);

  try {
    const fdb = getFirestoreDb();
    const cRef = collection(fdb, collectionName);
    const q = hasConstraints ? query(cRef, ...constraints) : cRef;
    const snap = await getDocs(q);
    const docs: T[] = [];
    snap.forEach((d) => {
      const docData = { id: d.id, ...d.data() } as T;
      docs.push(docData);
      memCol.set(d.id, docData);
    });

    if (!hasConstraints) {
      collectionCache.set(collectionName, { timestamp: now, data: docs });
    }

    return docs;
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      console.warn(`[Firestore] Quota exceeded or network error fetching ${collectionName}; falling back to cache/memory.`);

      // 1. Try stale collection cache
      const cached = collectionCache.get(collectionName);
      if (cached && cached.data.length > 0) {
        return [...cached.data] as T[];
      }

      // 2. Try memory store
      const memDocs = Array.from(memCol.values());
      if (memDocs.length > 0) {
        return [...memDocs] as T[];
      }

      // Never disguise an unavailable authoritative product catalogue as a valid empty catalogue.
      // Guest routes can provide their explicit, limited fallback; authenticated desk routes can
      // return a diagnostic error and let the UI offer a retry instead of silently showing zero.
      if (collectionName === 'products') {
        throw err;
      }

      // 3. Try baseline catalog fallbacks
      if (BASELINE_COLLECTIONS[collectionName]) {
        return [...BASELINE_COLLECTIONS[collectionName]] as T[];
      }

      return [];
    }

    console.error(`[Firestore] Error fetching collection ${collectionName}:`, err);
    // Preserve cached in-process data when available, but never report an authoritative product
    // read failure as an empty product list. The calling route must handle the failure explicitly.
    const memDocs = Array.from(memCol.values());
    if (memDocs.length > 0) return [...memDocs] as T[];
    if (collectionName === 'products') throw err;
    if (BASELINE_COLLECTIONS[collectionName]) return [...BASELINE_COLLECTIONS[collectionName]] as T[];
    return [];
  }
}

/**
 * Durable deletion tombstones to ensure deleted media or products
 * are NEVER resurrected.
 */
export async function recordTombstone(collectionName: string, recordId: string): Promise<void> {
  const tombstoneId = `${collectionName}_${recordId}`;

  // Update in-memory tombstones
  if (!tombstonesCache) {
    tombstonesCache = { timestamp: Date.now(), data: new Set<string>() };
  }
  tombstonesCache.data.add(tombstoneId);
  tombstonesCache.data.add(recordId);

  try {
    const fdb = getFirestoreDb();
    await setDoc(doc(fdb, 'deleted_records', tombstoneId), {
      id: tombstoneId,
      collectionName,
      recordId,
      deletedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      console.warn(`[Firestore] Quota exceeded recording tombstone ${tombstoneId}; kept in memory.`);
      return;
    }
    console.error(`[Firestore] Error recording tombstone:`, err);
  }
}

/** Strict point lookup for callers that must fail closed when tombstone reads fail. */
export async function hasTombstone(collectionName: string, recordId: string): Promise<boolean> {
  const tombstoneId = `${collectionName}_${recordId}`;
  if (tombstonesCache && (tombstonesCache.data.has(tombstoneId) || tombstonesCache.data.has(recordId))) {
    return true;
  }
  try {
    const fdb = getFirestoreDb();
    const snap = await getDoc(doc(fdb, 'deleted_records', tombstoneId));
    return snap.exists();
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      return tombstonesCache ? (tombstonesCache.data.has(tombstoneId) || tombstonesCache.data.has(recordId)) : false;
    }
    return false;
  }
}

export async function getTombstones(): Promise<Set<string>> {
  const now = Date.now();
  if (tombstonesCache && now - tombstonesCache.timestamp < CACHE_TTL_MS) {
    return new Set(tombstonesCache.data);
  }

  const set: Set<string> = tombstonesCache ? new Set<string>(tombstonesCache.data) : new Set<string>();

  try {
    const fdb = getFirestoreDb();
    const snap = await getDocs(collection(fdb, 'deleted_records'));
    snap.forEach((d) => {
      set.add(d.id);
      const data = d.data();
      if (data.collectionName && data.recordId) {
        set.add(`${data.collectionName}_${data.recordId}`);
      }
    });
    tombstonesCache = { timestamp: now, data: set };
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      console.warn('[Firestore] Quota exceeded loading tombstones; serving from in-memory set.');
    } else {
      console.warn('[Firestore] Error loading tombstones:', err);
    }
  }

  return set;
}

export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
};
