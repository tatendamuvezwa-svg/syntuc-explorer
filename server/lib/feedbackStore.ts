import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseConfig } from './firestore.ts';

const ADMIN_APP_NAME = 'syntuc-feedback-admin';

function getFeedbackFirestore() {
  const config = getFirebaseConfig();
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  const app = existing || initializeApp(
    {
      credential: applicationDefault(),
      projectId: config.projectId,
    },
    ADMIN_APP_NAME,
  );

  // Admin SDK bypasses Firestore client security rules. Access to this collection is
  // therefore mediated exclusively by the server endpoints and their authorization.
  return getFirestore(app, config.firestoreDatabaseId || '(default)');
}

export async function saveFeedbackResponse(
  id: string,
  response: Record<string, unknown>,
): Promise<void> {
  await getFeedbackFirestore().collection('heritage_feedback_responses').doc(id).create(response);
}

export async function listFeedbackResponses(): Promise<Record<string, any>[]> {
  const snapshot = await getFeedbackFirestore()
    .collection('heritage_feedback_responses')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();

  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}
