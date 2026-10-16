import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';

function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) throw new Error('firebase-applet-config.json not found');
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
    projectId: string;
    firestoreDatabaseId?: string;
  };
}

async function main() {
  const config = loadConfig();
  if (!config.projectId || !config.firestoreDatabaseId) {
    throw new Error('Firebase projectId and firestoreDatabaseId must both be configured.');
  }

  const appName = 'syntuc-admin-diagnostic';
  const app = getApps().find((candidate) => candidate.name === appName)
    || initializeApp({ credential: applicationDefault(), projectId: config.projectId }, appName);
  const db = getFirestore(app, config.firestoreDatabaseId);

  // Read-only permission/connectivity check. No documents are created or modified.
  await db.listCollections();
  console.log(JSON.stringify({
    status: 'ok',
    check: 'firebase-admin-read-only-connectivity',
    projectId: config.projectId,
    firestoreDatabaseId: config.firestoreDatabaseId,
    credentials: 'Application Default Credentials accepted',
    permission: 'Firestore list-collections request succeeded',
    writesPerformed: false,
  }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown diagnostic error';
  console.error(JSON.stringify({
    status: 'failed',
    check: 'firebase-admin-read-only-connectivity',
    message,
    hint: 'Run in the target runtime with Application Default Credentials and IAM access to the configured Firestore database.',
    writesPerformed: false,
  }, null, 2));
  process.exitCode = 1;
});
