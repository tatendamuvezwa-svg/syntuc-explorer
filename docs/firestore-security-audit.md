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
