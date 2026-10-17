import assert from 'node:assert/strict';
import express from 'express';
import feedbackRoutes, { isFeedbackAdministrator } from '../routes/feedback.ts';

assert.equal(isFeedbackAdministrator('admin'), true, 'admin role must be allowed to read feedback responses');
assert.equal(isFeedbackAdministrator('reservations_coordinator'), false, 'coordinator role must not read feedback responses');
assert.equal(isFeedbackAdministrator(undefined), false, 'missing role must not read feedback responses');

const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRoutes);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Test server failed to bind.');
const base = `http://127.0.0.1:${address.port}/api/feedback`;

try {
  const noAuth = await fetch(`${base}/responses`);
  assert.equal(noAuth.status, 401, 'feedback responses must require staff authentication');

  const fakeAuth = await fetch(`${base}/responses`, {
    headers: { authorization: 'Bearer not-a-valid-staff-token' },
  });
  assert.equal(fakeAuth.status, 401, 'invalid staff tokens must not read feedback responses');

  const missingRatings = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ratings: {},
      overallExperience: 'Test submission',
      recommendation: 'Yes',
    }),
  });
  assert.equal(missingRatings.status, 400, 'invalid public submissions must be rejected before storage');

  const honeypot = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ website: 'automated-spam' }),
  });
  assert.equal(honeypot.status, 202, 'honeypot submissions should be silently accepted without storage');

  console.log('Feedback API auth/input smoke tests passed.');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
