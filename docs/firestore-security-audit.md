# Firestore security audit and migration plan

Audit date: 2026-10-16
Branch: `feat/qr-feedback-mvp`
Status: initial repository-level audit; deployment IAM and live behavior not verified.

## Findings

### 1. Current rules are not production-safe

`firestore.rules` grants unconditional client read/write access to:
- `reservation_requests`
- `reservation_items`
- `analytics_visitors`
- `analytics_sessions`
- `analytics_events`
- `media_assets`
- `media_chunks`
- `products`
- `deleted_records`
- `guests`
- `guest_access_tokens`
- `guest_messages`
- `healthcheck`

The feedback collection has an explicit deny rule. No broad catch-all currently exists, but the unconditional rules above remain equivalent to public access for those collections. Collections not listed in the rules fail closed for direct client SDK access.

### 2. Server access paths

The server imports `server/lib/firestore.ts`, which currently uses the Firebase **client** SDK. API routes using its helpers are therefore subject to Firestore security rules and are not privileged server access:
- `server/routes/reservation.ts`: reservation requests/items, guests, guest sessions, guest tokens/messages, trip data; also performs a direct client-SDK batch write.
- `server/routes/session.ts`: guest sessions, trip plans/items, products and rooms.
- `server/routes/catalog.ts`: products, operators, media assets, categories, packages and rooms.
- `server/routes/analytics.ts`: visitor/session/event analytics and reservation records.
- `server/routes/media.ts`: direct client-SDK writes/deletes for media assets/chunks plus helper-based queries.
- `server/routes/feedback.ts`: dedicated Firebase Admin SDK store for `heritage_feedback_responses`.

The client-side Firebase SDK usage found by this first-pass audit is not yet exhaustive. The repository should be searched again before changing rules.

### 3. Admin SDK runtime configuration

The project config points to Firebase project `fluid-analyzer-m9v0l` and Firestore database `ai-studio-syntucexplorer-8297878a-e0e6-49a9-aecf-fcb4bb4e0a46`. The feedback store initializes a named Firebase Admin app with Application Default Credentials and this database ID.

Repository inspection cannot prove that the deployed runtime has Application Default Credentials or IAM access. The read-only diagnostic script `npm run diagnose:firebase-admin` must be run in the target runtime or a preview environment configured with the intended service identity. It checks project/database identity and attempts a read-only list-collections request; it does not print credentials.

## Safe migration plan

1. Run `npm run diagnose:firebase-admin` in a preview/deployed runtime with the intended service identity. Record only pass/fail and the project/database IDs.
2. Migrate server data access to Firebase Admin SDK behind a server-only repository abstraction. Preserve query semantics, batching, transaction behavior, cache/tombstone behavior and error propagation; do not change Firestore rules first.
3. Replace direct Firebase client-SDK operations in reservation and media routes, including reservation batch writes and media chunk operations.
4. Add server-side authentication/authorization to every API route that reads or mutates sensitive collections. Public endpoints should expose only intentionally public, filtered catalogue data and bounded analytics intake.
5. Add emulator or isolated-project integration tests for unauthenticated direct reads/writes, public catalogue reads, reservation submission, guest token/message isolation, admin-only analytics/media operations and feedback access.
6. Replace unconditional rules with least-privilege rules: deny direct client access to private collections; allow only the exact public read paths needed by the guest UI. Server Admin SDK requests bypass Firestore rules, so API authorization becomes mandatory.
7. Run the full test suite and regression checklist in preview; only then merge and deploy rules with rollback instructions.

## Do not do

- Do not simply change all existing `allow read, write: if true` rules to `false` before server migration and regression tests. Existing server routes currently use the client SDK and would likely fail.
- Do not enable real guest feedback collection until deployed Admin credentials/IAM and feedback authorization/persistence have been tested.
- Do not treat a successful TypeScript build as proof of database connectivity or security.

## Additional authentication finding

The staff-token signing secret previously had a predictable hard-coded fallback. The feature branch now fails closed in production when neither `STAFF_AUTH_SECRET` nor `SESSION_SECRET` is configured: token creation throws, and verification rejects tokens. A unit test verifies that the former predictable fallback signature is rejected. Before deploying, configure a strong random `STAFF_AUTH_SECRET` in the server environment and verify that existing staff login/token issuance uses the same configured secret. Rotating this secret invalidates previously issued tokens; coordinate rollout accordingly.

## Current implementation boundary

This branch adds the audit, a read-only Firebase Admin connectivity diagnostic, and a production auth-secret guard. It does **not** yet migrate all server data-access helpers/routes to the Admin SDK, and it does not yet tighten the public rules for other collections. Those changes must be implemented and tested before the rules can safely be locked down. The diagnostic has not been run in the target deployed runtime from this workspace.

## Implementation status — 16 October 2026

The feature branch now:

- Uses Firebase Admin SDK for the shared server Firestore adapter, including reservation batch writes and media operations that previously used the client SDK.
- Denies all direct browser/client SDK reads and writes in `firestore.rules`. Repository frontend services inspected for this change call the server API rather than importing the Firestore client SDK.
- Removes hard-coded fallback user credentials from the server helper and refuses stale in-memory fallback reads for server data access. Tombstone read/write failures now fail closed.
- Verifies the configured Firestore database with a read-only `listCollections()` request before the server begins listening. This verifies ADC/IAM at startup; it has not yet been run in the target deployed runtime from this workspace.
- Requires a configured production `STAFF_AUTH_SECRET` (or `SESSION_SECRET`) and documents the secret in `.env.example` without including a real value.
- Adds automated smoke tests for feedback API authentication/input handling, staff-secret behavior, and the deny-all Firestore rules.

### Runtime requirements before accepting real guest data

1. Configure a strong random `STAFF_AUTH_SECRET` in the deployment secret manager. Do not use the placeholder in `.env.example`. Existing staff sessions/tokens signed with the old fallback will be invalid; verify staff login/token issuance in preview.
2. Ensure the deployed server identity has Firestore IAM access to project/database configured in `firebase-applet-config.json`. Startup now fails closed if it cannot perform a read-only database request.
3. Deploy to preview and verify coordinator login, public catalogue, guest session/trip, reservation creation, guest reservation link/messages, coordinator operations, media upload/edit, analytics, and feedback persistence/read authorization.
4. Test a real feedback submission using synthetic data only, verify the response exists in Firestore and is visible only to an authorized administrator, then delete the test record.
5. Confirm rollback plan before production deployment.

Admin SDK requests bypass Firestore rules. Consequently, API route authorization is the security boundary. Sensitive coordinator/media/analytics endpoints must remain protected by `requireCoordinatorAuth`; guest session and reservation endpoints must validate session secrets or high-entropy guest tokens. The public catalogue and analytics intake endpoints are intentionally public but must return only approved public data and never private records.

The code and CI checks can validate structural behavior, but they cannot prove the actual Cloud Run/AI Studio service identity has been granted IAM permissions. The runtime check and end-to-end preview regression are deployment-gated and must not be represented as completed until run.

