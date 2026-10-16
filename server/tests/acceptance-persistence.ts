import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getFirestoreDb } from '../lib/firestore.ts';

/**
 * Opt-in live Firebase Admin SDK integration check.
 * Run only against a non-production preview/test database:
 * RUN_FIRESTORE_INTEGRATION_TESTS=true npm run test:firestore-admin-integration
 *
 * Creates one synthetic document in a dedicated test collection and deletes it
 * in finally. It does not read or modify guest, reservation, catalogue or media data.
 */
if (process.env.RUN_FIRESTORE_INTEGRATION_TESTS !== 'true') {
  console.log('Skipped live Firestore integration test. Set RUN_FIRESTORE_INTEGRATION_TESTS=true in a safe preview environment.');
} else {
  const db = getFirestoreDb();
  const id = `test_${crypto.randomUUID()}`;
  const ref = db.collection('syntuc_integration_tests').doc(id);
  const payload = {
    id,
    purpose: 'syntuc-admin-sdk-integration-check',
    createdAt: new Date().toISOString(),
  };

  try {
    await ref.create(payload);
    const snapshot = await ref.get();
    assert.equal(snapshot.exists, true, 'Admin SDK must read the document it just created');
    assert.equal(snapshot.get('purpose'), payload.purpose, 'Stored data must match the synthetic payload');
    console.log('Firebase Admin SDK create/read integration check passed.');
  } finally {
    await ref.delete().catch((error) => {
      console.error('Could not clean up synthetic integration document:', error);
      throw error;
    });
  }
}
