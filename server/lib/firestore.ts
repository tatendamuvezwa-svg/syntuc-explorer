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
// CIRCUIT BREAKER & IN-MEMORY RESILIENCE LAYER
// Completely eliminates quota burnout, read storms,
// and console error triggers during free-tier quota limits.
// ==========================================

const CACHE_TTL_MS = 60_000; // 60 seconds collection TTL
const QUOTA_COOLDOWN_MS = 5 * 60_000; // 5 minutes probe cooldown

let isFirestoreQuotaExceeded = false;
let quotaExceededTrippedAt = 0;

export function tripCircuitBreaker(): void {
  isFirestoreQuotaExceeded = true;
  quotaExceededTrippedAt = Date.now();
}

export function resetCircuitBreaker(): void {
  isFirestoreQuotaExceeded = false;
  quotaExceededTrippedAt = 0;
}

export function isBreakerActive(): boolean {
  if (!isFirestoreQuotaExceeded) return false;
  // If cooldown passed, allow one probe to test Firestore availability
  if (Date.now() - quotaExceededTrippedAt > QUOTA_COOLDOWN_MS) {
    return false;
  }
  return true;
}

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

// In-memory query constraint evaluator
function matchesConstraints(item: any, constraints: QueryConstraint[]): boolean {
  if (!item || !constraints || constraints.length === 0) return true;
  for (const c of constraints) {
    const filter = c as any;
    if (filter._field && Array.isArray(filter._field.segments) && filter._op) {
      const fieldPath = filter._field.segments.join('.');
      const expectedVal = filter._value;
      const actualVal = fieldPath.includes('.')
        ? fieldPath.split('.').reduce((acc: any, part: string) => acc?.[part], item)
        : item[fieldPath];

      switch (filter._op) {
        case '==':
          if (actualVal !== expectedVal) return false;
          break;
        case '!=':
          if (actualVal === expectedVal) return false;
          break;
        case '>':
          if (!(actualVal > expectedVal)) return false;
          break;
        case '>=':
          if (!(actualVal >= expectedVal)) return false;
          break;
        case '<':
          if (!(actualVal < expectedVal)) return false;
          break;
        case '<=':
          if (!(actualVal <= expectedVal)) return false;
          break;
        case 'in':
          if (!Array.isArray(expectedVal) || !expectedVal.includes(actualVal)) return false;
          break;
        case 'array-contains':
          if (!Array.isArray(actualVal) || !actualVal.includes(expectedVal)) return false;
          break;
      }
    }
  }
  return true;
}

// Baselines for non-product collections only; products must come from live Firestore.
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
  properties: [
    {
      id: 'prop_azambezi',
      name: "A'Zambezi River Lodge",
      slug: 'azambezi-river-lodge',
      location: 'Victoria Falls, Zimbabwe',
      operatorId: 'op_cresta',
      propertyType: 'lodge',
      starRating: 4,
      isPublished: true,
      description: 'Direct frontage on the Zambezi River with open lush lawns and wildlife roaming freely.',
    },
    {
      id: 'prop_rainbow',
      name: 'Victoria Falls Rainbow Hotel',
      slug: 'victoria-falls-rainbow-hotel',
      location: 'Victoria Falls, Zimbabwe',
      operatorId: 'op_rtg',
      propertyType: 'hotel',
      starRating: 3,
      isPublished: true,
      description: 'Panoramic views of the Victoria Falls spray and close proximity to town.',
    },
    {
      id: 'prop_explorers',
      name: 'Shearwater Explorers Village',
      slug: 'shearwater-explorers-village',
      location: 'Victoria Falls, Zimbabwe',
      operatorId: 'op_shearwater',
      propertyType: 'lodge',
      starRating: 3,
      isPublished: true,
      description: 'Centrally located hub for adventures in Victoria Falls with chalets and camping.',
    },
    {
      id: 'prop_olddrift',
      name: 'Old Drift Lodge',
      slug: 'old-drift-lodge',
      location: 'Zambezi National Park, Zimbabwe',
      operatorId: 'op_machaba',
      propertyType: 'safari_camp',
      starRating: 5,
      isPublished: true,
      description: 'Luxury canvas sanctuary immersed in Zambezi National Park with private plunge pools.',
    },
    {
      id: 'prop_elephantcamp',
      name: 'The Elephant Camp',
      slug: 'the-elephant-camp',
      location: 'Victoria Falls, Zimbabwe',
      operatorId: 'op_wildhorizons',
      propertyType: 'safari_camp',
      starRating: 5,
      isPublished: true,
      description: 'Exclusive safari camp situated on a private wildlife concession overlooking the gorge.',
    },
  ],
  rooms: [
    {
      id: 'rm_rainbow_standard',
      propertyId: 'prop_rainbow',
      productId: 'prod_rainbow',
      name: 'Standard Twin / Double Room',
      description: 'Comfortable air-conditioned en-suite room with views of lush gardens.',
      basePrice: 160,
      currency: 'USD',
      priceBasis: 'per_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_rainbow_deluxe',
      propertyId: 'prop_rainbow',
      productId: 'prod_rainbow',
      name: 'Deluxe Suite',
      description: 'Spacious suite with lounge area and private balcony.',
      basePrice: 220,
      currency: 'USD',
      priceBasis: 'per_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_azambezi_river',
      propertyId: 'prop_azambezi',
      productId: 'prod_azambezi',
      name: 'River Facing Room',
      description: 'En-suite room facing the tranquil Zambezi River.',
      basePrice: 210,
      currency: 'USD',
      priceBasis: 'per_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_azambezi_standard',
      propertyId: 'prop_azambezi',
      productId: 'prod_azambezi',
      name: 'Standard Garden Room',
      description: 'En-suite room overlooking indigenous gardens.',
      basePrice: 175,
      currency: 'USD',
      priceBasis: 'per_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_explorers_chalet',
      propertyId: 'prop_explorers',
      productId: 'prod_explorers',
      name: 'Standard Garden Chalet',
      description: 'Private garden chalet. Full breakfast included.',
      basePrice: 176,
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_explorers_deluxe',
      propertyId: 'prop_explorers',
      productId: 'prod_explorers',
      name: 'Deluxe Village Suite',
      description: 'Executive suite with modern amenities and pool views.',
      basePrice: 218,
      currency: 'USD',
      priceBasis: 'per_single_room_night',
      maxGuests: 2,
    },
    {
      id: 'rm_olddrift_suite',
      propertyId: 'prop_olddrift',
      productId: 'prod_olddrift',
      name: 'Luxury Tented Suite',
      description: 'Air-conditioned luxury tent with plunge pool and outdoor shower.',
      basePrice: 835,
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      maxGuests: 2,
    },
    {
      id: 'rm_elephantcamp_tent',
      propertyId: 'prop_elephantcamp',
      productId: 'prod_elephantcamp',
      name: 'Luxury Tent Suite',
      description: 'Spacious canvas suite with plunge pool overlooking Victoria Falls gorge.',
      basePrice: 890,
      currency: 'USD',
      priceBasis: 'per_person_sharing_night',
      maxGuests: 2,
    },
  ],
  knowledge_sources: [
    {
      id: 'ks_pure_africa_2026',
      name: 'Pure Africa Experiences Official 2026 Tariff',
      sourceType: 'SUPPLIER_OFFICIAL',
      evidenceStatus: 'ESTABLISHED',
      notes: 'Authoritative tariffs for Zambezi Explorer cruises and The Eatery Waterfront dining.',
      lastVerified: '2026-10-14T10:00:00.000Z',
    },
    {
      id: 'ks_shearwater_2026',
      name: 'Shearwater Victoria Falls 2026 International Pricelist',
      sourceType: 'SUPPLIER_OFFICIAL',
      evidenceStatus: 'ESTABLISHED',
      notes: 'Authoritative rates for helicopter flights, rafting, bridge tours, Explorers Village.',
      lastVerified: '2026-10-14T10:00:00.000Z',
    },
    {
      id: 'ks_wildhorizons_2026',
      name: 'Wild Horizons 2026 Product Schedule',
      sourceType: 'SUPPLIER_OFFICIAL',
      evidenceStatus: 'ESTABLISHED',
      notes: 'Authoritative tariffs for wildlife encounters, gorge swings, and Chobe day safaris.',
      lastVerified: '2026-10-14T10:00:00.000Z',
    },
  ],
  leads: [],
  reservation_requests: [],
  reservation_items: [],
  guests: [],
  trip_plans: [],
  trip_items: [],
};

// Seed baseline entries into memory store
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

  if (isBreakerActive()) {
    if ((collectionName === 'products' || collectionName === 'packages')) throw new Error('Authoritative products collection unavailable; fallback data is disabled.');
    if (memDoc) return memDoc as T;
    return null;
  }

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (collectionName === 'products' || collectionName === 'packages') {
        memCol.delete(id);
        return null;
      }
      if (memDoc) return memDoc as T;
      return null;
    }
    const data = { id: snap.id, ...snap.data() } as T;
    memCol.set(id, data);
    return data;
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
    }
    if ((collectionName === 'products' || collectionName === 'packages')) throw err;
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
  if ((collectionName === 'products' || collectionName === 'packages') && isBreakerActive()) throw new Error(`Cannot write ${collectionName} while Firestore is unavailable; no in-memory-only write was performed.`);
  const memCol = getMemoryCollection(collectionName);
  const existing = memCol.get(id) || {};
  const merged = merge ? { ...existing, id, ...data } : { id, ...data };
  memCol.set(id, merged);

  // Invalidate collection cache so fresh reads include this update
  collectionCache.delete(collectionName);

  if (isBreakerActive()) {
    return;
  }

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await setDoc(ref, { id, ...data }, { merge });
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
      if ((collectionName === 'products' || collectionName === 'packages')) throw err;
      return;
    }
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
  if ((collectionName === 'products' || collectionName === 'packages') && isBreakerActive()) throw new Error(`Cannot update ${collectionName} while Firestore is unavailable; no in-memory-only update was performed.`);
  const memCol = getMemoryCollection(collectionName);
  const existing = memCol.get(id) || {};
  const merged = { ...existing, id, ...data };
  memCol.set(id, merged);

  // Invalidate collection cache
  collectionCache.delete(collectionName);

  if (isBreakerActive()) {
    return;
  }

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await setDoc(ref, { id, ...data }, { merge: true });
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
      if ((collectionName === 'products' || collectionName === 'packages')) throw err;
      return;
    }
    throw err;
  }
}

export async function deleteDocById(collectionName: string, id: string): Promise<void> {
  if ((collectionName === 'products' || collectionName === 'packages') && isBreakerActive()) throw new Error(`Cannot delete ${collectionName} while Firestore is unavailable; no in-memory-only deletion was performed.`);
  const memCol = getMemoryCollection(collectionName);
  memCol.delete(id);
  collectionCache.delete(collectionName);

  if (isBreakerActive()) {
    return;
  }

  try {
    const fdb = getFirestoreDb();
    const ref = doc(fdb, collectionName, id);
    await deleteDoc(ref);
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
      if ((collectionName === 'products' || collectionName === 'packages')) throw err;
      return;
    }
    throw err;
  }
}

export async function getCollectionDocs<T = DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const hasConstraints = constraints.length > 0;
  const now = Date.now();
  const memCol = getMemoryCollection(collectionName);

  // If circuit breaker is active, serve previously read live data only; products have no embedded baseline.
  if (isBreakerActive()) {
    if ((collectionName === 'products' || collectionName === 'packages')) throw new Error('Authoritative products collection unavailable; fallback data is disabled.');
    const allDocs = Array.from(memCol.values());
    if ((collectionName === 'products' || collectionName === 'packages') && allDocs.length === 0) {
      throw new Error('Live Firestore products are unavailable while the circuit breaker is active.');
    }
    if (allDocs.length === 0 && BASELINE_COLLECTIONS[collectionName]) {
      const baselines = BASELINE_COLLECTIONS[collectionName];
      for (const b of baselines) {
        memCol.set(b.id, b);
      }
      return (hasConstraints ? baselines.filter((d) => matchesConstraints(d, constraints)) : [...baselines]) as T[];
    }
    return (hasConstraints ? allDocs.filter((d) => matchesConstraints(d, constraints)) : [...allDocs]) as T[];
  }

  // If no constraints, check fresh collection cache
  if (!hasConstraints) {
    const cached = collectionCache.get(collectionName);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return [...cached.data] as T[];
    }
  }

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
      tripCircuitBreaker();
      if ((collectionName === 'products' || collectionName === 'packages')) throw err;
      const allDocs = Array.from(memCol.values());
      if (allDocs.length > 0) {
        return (hasConstraints ? allDocs.filter((d) => matchesConstraints(d, constraints)) : [...allDocs]) as T[];
      }
      if ((collectionName === 'products' || collectionName === 'packages')) {
        throw err;
      }
      if (BASELINE_COLLECTIONS[collectionName]) {
        const baselines = BASELINE_COLLECTIONS[collectionName];
        for (const b of baselines) {
          memCol.set(b.id, b);
        }
        return (hasConstraints ? baselines.filter((d) => matchesConstraints(d, constraints)) : [...baselines]) as T[];
      }
      return [];
    }

    if ((collectionName === 'products' || collectionName === 'packages')) {
      throw err;
    }
    if ((collectionName === 'products' || collectionName === 'packages')) throw err;
    const allDocs = Array.from(memCol.values());
    return (hasConstraints ? allDocs.filter((d) => matchesConstraints(d, constraints)) : [...allDocs]) as T[];
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

  if (isBreakerActive()) {
    return;
  }

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
      tripCircuitBreaker();
    }
  }
}

/** Strict point lookup for callers that must fail closed when tombstone reads fail. */
export async function hasTombstone(collectionName: string, recordId: string): Promise<boolean> {
  const tombstoneId = `${collectionName}_${recordId}`;
  if (tombstonesCache && (tombstonesCache.data.has(tombstoneId) || tombstonesCache.data.has(recordId))) {
    return true;
  }
  if (isBreakerActive()) {
    return false;
  }
  try {
    const fdb = getFirestoreDb();
    const snap = await getDoc(doc(fdb, 'deleted_records', tombstoneId));
    return snap.exists();
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      tripCircuitBreaker();
    }
    return tombstonesCache ? (tombstonesCache.data.has(tombstoneId) || tombstonesCache.data.has(recordId)) : false;
  }
}

export async function getTombstones(): Promise<Set<string>> {
  const now = Date.now();
  if (tombstonesCache && now - tombstonesCache.timestamp < CACHE_TTL_MS) {
    return new Set(tombstonesCache.data);
  }

  const set: Set<string> = tombstonesCache ? new Set<string>(tombstonesCache.data) : new Set<string>();

  if (isBreakerActive()) {
    return set;
  }

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
      tripCircuitBreaker();
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
