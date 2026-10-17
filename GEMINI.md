# GEMINI.md — Syntuc Explorer Project Context

> **Read this file before editing, repairing, rebuilding, or continuing this project in Google AI Studio.**
> This is an existing production-oriented application. Recover and understand it; do not regenerate it from a short prompt.

## 1. Project identity

- Product: **Syntuc Explorer**
- Product owner/brand: **SAINTECH**
- Tagline: **Explore. Plan. Experience.**
- Repository: `tatendamuvezwa-svg/syntuc-explorer`
- Primary branch: `main`
- Firebase project ID: `fluid-analyzer-m9v0l`
- Product purpose: Victoria Falls travel discovery and booking-request platform, with a guest experience and a staff-only Coordinator Desk.
- The public published website may intentionally lag behind GitHub while Google AI Studio work is in progress. Do not use the published website as the source of truth for whether un-published code exists.

## 2. Operating rule: recover, do not regenerate

When opening this repository or recovering an interrupted AI Studio session:

1. Read this file first.
2. Inspect the actual files and current Git revision before making changes.
3. Preserve the existing project, UI, business logic, configuration, and data. Do not scaffold a replacement app.
4. Do not reset or seed production data, overwrite catalogue records, delete reservations, recreate staff accounts, or alter the Firebase project as a shortcut.
5. Do not replace working features with mockups, static sample data, placeholders, or simplified screens.
6. Do not perform broad refactors while diagnosing a startup or quota-interruption problem.
7. Make the smallest evidence-based change, then run the available checks and report exact results.
8. If the AI Studio quota interrupts work, stop at the last confirmed state. Do not claim that a build, test, synchronization, or deployment succeeded if it did not.
9. Do not publish or deploy without explicit human approval.

## 3. Application architecture

This is a full-stack TypeScript application:

- **Frontend:** React 19 + Vite + TypeScript.
- **Backend:** Express, launched through `server.ts`.
- **Persistence:** Cloud Firestore is the authoritative durable datastore. Firebase Admin SDK is used by server routes.
- **Firebase client/configuration:** `firebase-applet-config.json` identifies the Firebase project/database; it is configuration, not a place to store private server credentials.
- **AI integration:** Google GenAI SDK is a declared dependency.
- **Main guest app:** travel discovery, product/category views, packages, product details, booking-request flow, guest reservation dashboard, school-trip planner, and Syntuc assistant.
- **Coordinator Desk:** staff-facing reservations and operational management, including catalogue/media/analytics/staff features.
- **Guest feedback:** questionnaire route `/feedback`, implemented in `src/components/feedback/FeedbackPages.tsx`.
- **Feedback API:** `POST /api/feedback` accepts public questionnaire submissions; `GET /api/feedback/responses` is protected and restricted to administrators.
- **Server route modules:** catalog, session, reservation, coordinator, media, school trips, assistant, analytics, marketing, and feedback are mounted by `server.ts`.

### Key files

- `src/App.tsx` — top-level client route selection and application composition.
- `src/context/SessionContext.tsx` — guest/session state.
- `src/context/CoordinatorAuthContext.tsx` — Coordinator authentication context.
- `src/components/guest/` — guest-facing application screens.
- `src/components/coordinator/` — staff-facing Desk.
- `src/components/feedback/FeedbackPages.tsx` — public feedback form and feedback administration UI.
- `server.ts` — Express startup, Firestore startup verification, API mounts, and SPA serving.
- `server/lib/firestore.ts` — server-side Firestore adapter and persistence operations.
- `server/lib/feedbackStore.ts` — durable feedback storage functions.
- `server/routes/feedback.ts` — feedback validation, public submission endpoint, and admin-only retrieval.
- `server/middleware/auth.ts` — staff API authorization.
- `firestore.rules` — client-side Firestore security rules.
- `firebase-applet-config.json` — Firebase project/database configuration.
- `package.json` — scripts and dependencies.
- `vite.config.ts` — Vite configuration.
- `docs/qr-feedback-mvp.md` — QR feedback implementation notes.

## 4. Start-up and diagnosis

The normal scripts in `package.json` include:

- `npm run dev` — starts `tsx server.ts` in development.
- `npm run build` — builds the frontend with Vite.
- `npm run lint` — runs TypeScript checking (`tsc --noEmit`).
- `npm run diagnose:firebase-admin` — performs a read-only Firebase Admin / Firestore connectivity check.
- `npm run test:feedback-validation`
- `npm run test:staff-auth-secret`
- `npm run test:feedback-api-auth`
- `npm run test:firestore-rules`

The Express server verifies that Firebase Admin can initialize and that it can call Firestore `listCollections()` before it starts listening. If startup fails, capture the exact error and distinguish among:
- source/dependency/build failure;
- missing or invalid Firebase configuration;
- Application Default Credentials unavailable in the target runtime;
- Firestore IAM/permission/connectivity failure;
- missing required server environment variables;
- AI Studio preview/editor/quota failure.

Do not guess which category applies. Run the read-only diagnostic when the target runtime supports it. Do not bypass startup validation just to make the preview appear to run.

The production staff-token signing secret `STAFF_AUTH_SECRET` must be supplied through the environment. It must be a strong secret and must never be printed, copied into source files, committed, or requested from the user. Never echo environment secrets in logs or diagnostics. Do not change or rotate secrets without explicit authorization.

## 5. Feedback feature acceptance criteria

The QR feedback feature was merged in PR #32, baseline commit `51e3a8402c7b0bf4c2f62138f54e01434a9961bf`.

- Direct route `/feedback` must render the feedback questionnaire without the normal Explorer navbar.
- The public submission endpoint is `POST /api/feedback`.
- The response retrieval endpoint is `GET /api/feedback/responses`; it requires authenticated administrator access.
- Submissions must be saved to authoritative Firestore through Firebase Admin; do not silently report success for memory-only data.
- Validation, honeypot, rate limiting, date validation, and safe CSV export protections must be preserved.
- Do not loosen Firestore rules or make feedback records publicly readable.
- Test using fictional data only until the feature is verified in the target runtime.

## 6. Safe recovery sequence after an interrupted AI Studio session

When the editor returns to the chat-builder interface or a build is interrupted:

1. **Do not create a new application.**
2. Determine whether AI Studio is displaying the repository-backed project or only its builder/chat landing interface.
3. Confirm the repository and branch and synchronize the existing project from GitHub `main`; do not create a new repo.
4. Inspect the current files and compare them with the current GitHub revision.
5. Check that the original `package.json`, `package-lock.json`, `src/`, `server/`, `server.ts`, `vite.config.ts`, and Firebase configuration are present.
6. Install dependencies only if the runtime requires it and quota permits. Do not rewrite the dependency manifest to work around an unexplained failure.
7. Run TypeScript/build checks, then attempt preview startup and record the actual error if it fails.
8. Diagnose Firebase credentials and IAM separately from frontend compilation.
9. Verify the guest homepage, Coordinator Desk, reservation flow, and `/feedback` route without changing real records.
10. Report completed versus unverified checks. Keep the app unpublished until explicitly approved.

If the project cannot be pulled or the editor cannot resume because of a Google AI Studio quota restriction, explain that limitation clearly. Do not simulate a successful restore.

## 7. Data and security invariants

- Firestore is the authoritative durable persistence layer.
- In-memory caches/fallbacks are not proof of durable persistence.
- Do not introduce PostgreSQL, PGlite, a local database, or a second competing source of truth.
- Do not weaken staff authentication, feedback authorization, or Firestore rules.
- Never expose secrets, credentials, guest personal data, or private feedback.
- Never reset, reseed, or bulk-overwrite catalogue/reservation/staff data during recovery.
- Do not run destructive migrations, deletion scripts, production writes, or real feedback submissions without explicit approval.

## 8. Required completion report

After any repair, report:

1. Git revision inspected.
2. Files changed and why.
3. Dependency install, TypeScript check, and frontend build results.
4. Firebase Admin/Firestore connectivity result, or explicitly state not tested.
5. Preview startup result and exact error if it fails.
6. Guest routes, Coordinator Desk, and feedback route checks completed.
7. Whether any data was changed (expected: no for recovery).
8. Whether anything was published (expected: no without explicit approval).

**Instruction to the coding agent:** Continue from the existing source, use repository evidence, make minimal targeted changes, and preserve the product. Do not ask the user to restate this context when this file and repository are available.
