import { applicationDefault, initializeApp, getApps } from 'firebase-admin/app';
import {
  getFirestore,
  type Firestore,
  type DocumentData,
  type Query,
  type CollectionReference,
  type DocumentReference,
  type SetOptions,
  type WhereFilterOp,
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
const CACHEABLE_COLLECTIONS = new Set(['categories', 'operators', 'products', 'packages', 'properties', 'rooms', 'media_assets']);
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
  | { kind: 'where'; field: string; op: WhereFilterOp; value: unknown }
  | { kind: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { kind: 'limit'; count: number };

export function doc(db: Firestore, collectionName: string, id: string): DocumentReference {
  return db.collection(collectionName).doc(id);
}
export function collection(db: Firestore, name: string): CollectionReference {
  return db.collection(name);
}
export async function getDoc(ref: DocumentReference) {
  const snapshot = await ref.get();
  // Preserve the existing server adapter contract (exists() method) while using Admin SDK.
  return {
    id: snapshot.id,
    exists: () => snapshot.exists,
    data: () => snapshot.data() as DocumentData,
    get: (field: string) => snapshot.get(field),
  };
}
export async function setDoc(ref: DocumentReference, data: DocumentData, options?: SetOptions) {
  return options ? ref.set(data, options) : ref.set(data);
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
export function where(field: string, op: WhereFilterOp, value: unknown): Constraint {
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

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = { id: snap.id, ...snap.data() } as T;
    memCol.set(id, data);
    return data;
  } catch (err: any) {
    console.error(`[Firestore Admin] Read failed for ${collectionName}/${id}; refusing memory fallback.`, err);
    throw err;
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
  ...constraints: Constraint[]
): Promise<T[]> {
  const hasConstraints = constraints.length > 0;
  const now = Date.now();

  // If no constraints, check collection cache
  if (!hasConstraints && CACHEABLE_COLLECTIONS.has(collectionName)) {
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

    if (!hasConstraints && CACHEABLE_COLLECTIONS.has(collectionName)) {
      collectionCache.set(collectionName, { timestamp: now, data: docs });
    }

    return docs;
  } catch (err: any) {
    console.error(`[Firestore Admin] Query failed for ${collectionName}; refusing stale/private memory fallback.`, err);
    throw err;
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
      console.error(`[Firestore Admin] Could not persist tombstone ${tombstoneId}; refusing to report deletion as durable.`);
      throw err;
    }
    console.error(`[Firestore Admin] Error recording tombstone:`, err);
    throw err;
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
    console.error('[Firestore Admin] Tombstone verification failed; refusing to assume the record is active.', err);
    throw err;
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
    console.error('[Firestore Admin] Tombstone query failed; refusing incomplete deletion filtering.', err);
    throw err;
  }

  return set;
}

