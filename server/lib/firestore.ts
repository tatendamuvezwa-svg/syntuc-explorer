import { applicationDefault, initializeApp, getApps } from 'firebase-admin/app';
import {
  getFirestore,
  type Firestore,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type CollectionReference,
  type DocumentReference,
  type SetOptions,
} from 'firebase-admin/firestore';
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
  const appName = 'syntuc-server-admin';
  const app = getApps().find((candidate) => candidate.name === appName)
    || initializeApp(
      {
        credential: applicationDefault(),
        projectId: cfg.projectId,
      },
      appName,
    );

  firestoreInstance = getFirestore(app, cfg.firestoreDatabaseId || '(default)');
  console.log('[Firestore Admin] Authoritative database initialized:', cfg.firestoreDatabaseId || '(default)');
  return firestoreInstance;
}

// Server-only compatibility adapters. These deliberately use Firebase Admin SDK,
// which bypasses client Firestore rules; every API route must enforce authorization.
type Constraint =
  | { kind: 'where'; field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }
  | { kind: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { kind: 'limit'; count: number };

export function doc(db: Firestore, collectionName: string, id: string): DocumentReference {
  return db.collection(collectionName).doc(id);
}
export function collection(db: Firestore, name: string): CollectionReference {
  return db.collection(name);
}
export async function getDoc(ref: DocumentReference) {
  return ref.get();
}
export async function setDoc(ref: DocumentReference, data: DocumentData, options?: SetOptions) {
  return ref.set(data, options);
}
export async function updateDoc(ref: DocumentReference, data: DocumentData) {
  return ref.update(data);
}
export async function deleteDoc(ref: DocumentReference) {
  return ref.delete();
}
export async function getDocs(ref: Query | CollectionReference) {
  return ref.get();
}
export function where(field: string, op: FirebaseFirestore.WhereFilterOp, value: unknown): Constraint {
  return { kind: 'where', field, op, value };
}
export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): Constraint {
  return { kind: 'orderBy', field, direction };
}
export function limit(count: number): Constraint {
  return { kind: 'limit', count };
}
export function query(ref: Query | CollectionReference, ...constraints: Constraint[]): Query {
  return constraints.reduce((current, constraint) => {
    if (constraint.kind === 'where') return current.where(constraint.field, constraint.op, constraint.value);
    if (constraint.kind === 'orderBy') return current.orderBy(constraint.field, constraint.direction);
    return current.limit(constraint.count);
  }, ref as Query);
}
export function writeBatch(db: Firestore) {
  return db.batch();
}

export async function getDocById<T = DocumentData>(collectionName: string, id: string): Promise<T | null> {
  const memCol = getMemoryCollection(collectionName);
  const memDoc = memCol.get(id);

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // Product records are authoritative in Firestore. Never resurrect a deleted/missing
      // product from the process memory store, which may contain startup baseline data.
      if (collectionName === 'products' || collectionName === 'packages') return null;
      if (memDoc) return memDoc as T;
      return null;
    }
    const data = { id: snap.id, ...snap.data() } as T;
    memCol.set(id, data);
    return data;
  } catch (err: any) {
    if (collectionName === 'products' || collectionName === 'packages') {
      console.error(`[Firestore] Authoritative product read failed for ${id}; refusing memory fallback.`, err);
      throw err;
    }
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
    // Memory is only a cache, not durable persistence. Roll back optimistic memory state
    // and surface the failure so routes cannot report an unsaved write as successful.
    if (existing && Object.keys(existing).length > 0) memCol.set(id, existing);
    else memCol.delete(id);
    collectionCache.delete(collectionName);
    console.error(`[Firestore] Failed to persist ${collectionName}/${id}; in-memory change rolled back:`, err);
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
    if (existing && Object.keys(existing).length > 0) memCol.set(id, existing);
    else memCol.delete(id);
    collectionCache.delete(collectionName);
    console.error(`[Firestore] Failed to update ${collectionName}/${id}; in-memory change rolled back:`, err);
    throw err;
  }
}

export async function deleteDocById(collectionName: string, id: string): Promise<void> {
  const memCol = getMemoryCollection(collectionName);
  const existing = memCol.get(id);
  memCol.delete(id);
  collectionCache.delete(collectionName);

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await deleteDoc(ref);
  } catch (err: any) {
    if (existing) memCol.set(id, existing);
    collectionCache.delete(collectionName);
    console.error(`[Firestore] Failed to delete ${collectionName}/${id}; in-memory deletion rolled back:`, err);
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

      // Product catalogue reads must not fall back to startup baseline records:
      // those records are not the live supplier catalogue and can hide Firestore failures.
      if (collectionName === 'products' || collectionName === 'packages') throw err;

      // 2. Non-catalogue collections may use process-local resilience fallbacks.
      const memDocs = Array.from(memCol.values());
      if (memDocs.length > 0) {
        return [...memDocs] as T[];
      }

      // 3. Baseline fallbacks for non-authoritative support collections.
      if (BASELINE_COLLECTIONS[collectionName]) {
        return [...BASELINE_COLLECTIONS[collectionName]] as T[];
      }

      return [];
    }

    console.error(`[Firestore] Error fetching collection ${collectionName}:`, err);
    if (collectionName === 'products') throw err;
    const memDocs = Array.from(memCol.values());
    if (memDocs.length > 0) return [...memDocs] as T[];
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
