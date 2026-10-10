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
  const fdb = getFirestoreDb();
  const ref = doc(fdb, collectionName, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

export async function setDocById<T extends Record<string, any>>(
  collectionName: string,
  id: string,
  data: T,
  merge: boolean = true
): Promise<void> {
  const fdb = getFirestoreDb();
  const ref = doc(fdb, collectionName, id);
  await setDoc(ref, { id, ...data }, { merge });
}

export async function updateDocById(
  collectionName: string,
  id: string,
  data: Partial<DocumentData>
): Promise<void> {
  const fdb = getFirestoreDb();
  const ref = doc(fdb, collectionName, id);
  await updateDoc(ref, data as DocumentData);
}

export async function deleteDocById(collectionName: string, id: string): Promise<void> {
  const fdb = getFirestoreDb();
  const ref = doc(fdb, collectionName, id);
  await deleteDoc(ref);
}

export async function getCollectionDocs<T = DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const fdb = getFirestoreDb();
  const cRef = collection(fdb, collectionName);
  const q = constraints.length > 0 ? query(cRef, ...constraints) : cRef;
  const snap = await getDocs(q);
  const docs: T[] = [];
  snap.forEach((d) => {
    docs.push({ id: d.id, ...d.data() } as T);
  });
  return docs;
}

/**
 * Durable deletion tombstones to ensure deleted media or products
 * are NEVER resurrected.
 */
export async function recordTombstone(collectionName: string, recordId: string): Promise<void> {
  const fdb = getFirestoreDb();
  const tombstoneId = `${collectionName}_${recordId}`;
  await setDoc(doc(fdb, 'deleted_records', tombstoneId), {
    id: tombstoneId,
    collectionName,
    recordId,
    deletedAt: new Date().toISOString(),
  });
}

export async function getTombstones(): Promise<Set<string>> {
  const fdb = getFirestoreDb();
  const set = new Set<string>();
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
    console.warn('[Firestore] Error loading tombstones:', err);
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
