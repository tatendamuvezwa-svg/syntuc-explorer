# Heritage Expedition QR Guest Feedback MVP

## Scope
- Public mobile questionnaire at `/feedback`, for Heritage Expedition's Sunset Cruise.
- Five service ratings: welcome, boat cleanliness, drink variety, snacks, and captain information.
- Overall comment and recommend Yes/No; guest name, email, and experience date are optional.
- Successful-submission confirmation, QR download/print and a public stable URL.
- Persistent records in the isolated `heritage_feedback_responses` Firestore collection.
- Administrator-only response retrieval at `/api/feedback/responses`, via the existing coordinator authentication middleware, and CSV export in the management page at `/feedback-admin`.
- Server-side validation, honeypot and process-local rate limiting.

## Boundaries
No catalogue or reservation changes, no Firestore rules edits, no booking integration, no guest accounts, no ordering/check-in/check-out, no AI analytics, and no merge or deployment as part of this branch.

## Routes
- Guest questionnaire: `/feedback`
- Management page: `/feedback-admin`
- Public submit endpoint: `POST /api/feedback`
- Admin-only read endpoint: `GET /api/feedback/responses`

## Validation commands
```sh
npm run test:feedback-validation
npm run test:feedback-api
npm run lint
npm run build
```

The API auth/input smoke test deliberately avoids writing to Firestore. End-to-end persistence must still be verified in a configured test environment before release. Do not use production guest feedback for test submissions.

## Operational caveats
- Server persistence uses Firebase Admin SDK application-default credentials and requires the runtime identity to have access to the configured Firestore database.
- The rate limiter is per server process; it is a basic MVP abuse control, not a distributed rate limit.
- QR image rendering uses an external QR image service; no private guest data is encoded.
- No Firestore rules or global authentication architecture changes are included.
