import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
delete process.env.STAFF_AUTH_SECRET;
delete process.env.SESSION_SECRET;

const { createStaffAuthToken, verifyStaffAuthToken } = await import('../middleware/auth.ts');

assert.throws(
  () => createStaffAuthToken('usr_admin_1'),
  /STAFF_AUTH_SECRET must be configured in production/,
  'production must not mint tokens with a fallback secret',
);

const payload = Buffer.from(JSON.stringify({
  userId: 'usr_admin_1',
  expiresAt: Date.now() + 60_000,
})).toString('base64url');
const oldFallback = 'syntuc_staff_token_secret_auth_v2_f8e9a1b2c3d4e5f6';
const signature = (await import('node:crypto')).createHmac('sha256', oldFallback).update(payload).digest('hex');
assert.deepEqual(
  verifyStaffAuthToken(`stafftok.${payload}.${signature}`),
  { valid: false, userId: null },
  'legacy predictable fallback signatures must be rejected when production secret is absent',
);

console.log('Production staff-token secret fail-closed tests passed.');
