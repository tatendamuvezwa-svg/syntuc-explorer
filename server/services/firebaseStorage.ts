import { getApps } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseConfig, getFirestoreDb } from '../lib/firestore.ts';

let storageInstance: any = null;

export function getStorageInstance() {
  if (storageInstance) return storageInstance;
  const cfg = getFirebaseConfig();
  // Ensure Firebase App is initialized
  getFirestoreDb();
  const app = getApps()[0];
  const bucketUri = cfg.storageBucket.startsWith('gs://') ? cfg.storageBucket : `gs://${cfg.storageBucket}`;
  storageInstance = getStorage(app, bucketUri);
  return storageInstance;
}

/**
 * Upload binary file to Firebase Storage.
 * Returns public/authorized download URL.
 */
export async function uploadBinaryToStorage(
  buffer: Buffer,
  storagePath: string,
  contentType: string
): Promise<{ url: string; storagePath: string }> {
  const cfg = getFirebaseConfig();
  try {
    const storage = getStorageInstance();
    const fileRef = ref(storage, storagePath);
    const snap = await uploadBytes(fileRef, buffer, {
      contentType,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
      },
    });
    const url = await getDownloadURL(snap.ref);
    return { url, storagePath };
  } catch (err: any) {
    console.error(`[Firebase Storage] Upload failed for ${storagePath}:`, err.message);
    const detailedMessage =
      `FIREBASE_STORAGE_ERROR: Failed to upload file to ${cfg.storageBucket} at path ${storagePath}. ` +
      `Original error: ${err.message || err.code || 'Unknown error'}. ` +
      `Ensure that the Firebase Storage bucket (${cfg.storageBucket}) is provisioned and storage security rules permit writes.`;
    throw new Error(detailedMessage);
  }
}

/**
 * Delete a binary object from Firebase Storage.
 */
export async function deleteBinaryFromStorage(storagePath: string): Promise<void> {
  try {
    const storage = getStorageInstance();
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
  } catch (err: any) {
    console.warn(`[Firebase Storage] Notice deleting ${storagePath}:`, err.message);
  }
}
