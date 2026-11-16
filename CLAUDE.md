# Headroom

Headroom adjusts presentation and pace while preserving a user's task, information, and authority. Read `headroom-build-prompt.md` for the full release specification. This file contains standing project rules, not evidence of completed implementation.

## Architecture

- `src/domain/`: pure, deterministic policy, queue, brief, and source-block code. No Electron, Node, React, or SDK imports (enforced by lint).
- `src/shared/`: zod schemas and the typed IPC contract used by main, preload, and renderer.
- `src/main/`: `index.ts` sets the SDK runtime path then loads `app-main.ts`; `sensing/` owns the Presage SDK (native camera in main), `ai/` owns Ollama on loopback, `storage/` owns atomic JSON files, `ipc-handlers.ts` validates every call.
- `src/preload/`: the narrow `window.headroom` bridge; validates responses.
- `src/renderer/`: React UI; both layouts keep the same DOM mounted and toggle `hidden`.
- Policy constants live in `src/domain/pulse-policy-config.ts`; `gateValidation` stays `pending-device-validation` until live cadence is recorded in `docs/verification.md`.

## Product boundaries

- Build one macOS arm64 Electron app with a project-brief form and a learning workspace sharing one presentation controller and optional-request queue.
- Manual operation is complete without a camera. Suggested changes require acceptance. Automatic changes require separate explicit opt-in and always permit undo.
- Sensing changes presentation only. It never submits, answers, authorizes, diagnoses, or determines competence, comprehension, or emotional state.
- Preserve canonical answers, complete source text, requirements, validation, progress, and access to full detail across layout changes.
- This release coordinates its two workspaces, not arbitrary websites, external apps, or operating-system notifications. Do not add speculative infrastructure.

## Workflow

- Read applicable repository instructions and current code before editing. Preserve unrelated work.
- Verify APIs against current official documentation and the pinned dependency's source/types. Never invent SDK methods, fields, events, or supported capabilities.
- Make ordinary implementation decisions without repeated approval requests. Surface real scope conflicts and missing prerequisites promptly while completing independent work.
- Build complete vertical slices. Do not stop at scaffolding, a plan, or passing mocks when required implementation remains.
- Keep decisions and verification in the relevant short documents. Do not duplicate large specifications into this file.
- Do not publish, submit, send messages, spend money, or upload recordings without explicit authorization.

## Code standards

- TypeScript strict mode, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are required. Validate external data from `unknown`.
- No application `any`, double assertions, uncertainty-hiding non-null assertions, blanket error suppression, or fake success paths.
- Named application exports; kebab-case source filenames. Default exports are allowed only where a tool's configuration contract requires them.
- Keep handwritten source files within 300 lines by separating real responsibilities. Never compress code or add forwarding layers to satisfy a metric.
- Prefer direct functions and composition. No speculative abstraction, single-implementation hierarchy, generic event bus, unnecessary container, or duplicate source of truth.
- Extract shared concepts when justified by actual repetition. Keep domain types and canonical task state explicit.
- Comments must briefly explain a necessary reason, invariant, unit, or external constraint. Avoid obvious narration, banners, redundant JSDoc, and commented-out code.
- Handle errors where they can be explained or recovered. No blanket try/catch, swallowed failures, silent fallbacks, endless retries, TODOs, stubs, or unfinished controls in required features.
- Own and dispose of every stream, timer, callback, native session, and request. Ignore late results belonging to obsolete sessions or task versions.
- Bound buffers, queues, and caches. Keep frame processing out of React state; throttle diagnostic rendering without compromising capture. Optimize measured bottlenecks.
- Pin a compatible toolchain and commit the lockfile. Every dependency must have a concrete purpose.
- Enforce mechanical conventions in TypeScript, lint, and CI. Instructions alone do not enforce quality; use existing tools rather than a custom policy framework.

## Signal integrity

- Live Presage pulse integration is required. Optional metrics must be supported and fully implemented if exposed. Do not infer mood from expressions.
- Quality, validation, freshness, operating ranges, and startup windows must all permit a reading before it influences policy. Confidence alone is insufficient.
- Learn timestamp units and actual cadence from the pinned SDK. Reject malformed, duplicated, stale, out-of-order, and invalid values. Detect a silent stream with an independent monotonic watchdog.
- Keep calibration and timing in pure deterministic domain code. The specified thresholds are engineering heuristics, not validated stress or cognitive-load measurements.
- If a trigger cannot occur within the SDK's usable measurement range, mark that rule unavailable. Never relax measurement validity to manufacture an event.
- Invalid data stops sensor decisions. It does not erase work or reverse the user's chosen presentation. Manual override wins.
- No automatic restart after capture failure, sleep, or application restart. Release resources and require an explicit new start.
- Synthetic fixtures belong in tests and must never masquerade as live input. No production injection control or fabricated demo evidence.

## Security and privacy

- Capture only with current, explicit app consent. Provide a persistent stop control. Automatic adaptation requires its own permission.
- Explicitly disable Presage telemetry before readiness checks and measurement. Verify remaining SDK network use; do not equate telemetry-off with offline operation.
- Do not enable Presage LLM Insights. Local AI receives only the user's learning content and request, never camera frames or physiological data.
- Use a verified local Ollama model and loopback endpoint. No cloud model, silent model download, redirect, or hidden remote fallback.
- Keep keys out of bundles, logs, drafts, exports, and readback IPC. Default to session-only credential storage; never fall back to plaintext persistence.
- Isolate privileged operations behind a narrow validated bridge. Preserve Electron isolation, sandboxing, content policy, and navigation restrictions. Imported and generated text is untrusted data.
- No raw video or physiological history saved by default. Clear session measurements on stop. Export diagnostic evidence only through explicit, previewable user action.
- Store task drafts with validated versioned data and atomic writes. Expose save failures and deletion controls. State storage and deletion limits honestly.

## Checks and completion

Implemented scripts (see README for details): `dev`, `format:check`, `lint` (ESLint + knip), `typecheck` (three tsconfigs), `test` (Vitest unit + jsdom UI), `build`, `check` (format, lint, types, tests, build), `test:e2e` (Playwright on the built Electron app), `package:mac` (electron-builder arm64, ad-hoc signed), `test:packaged` (smoke test of the `.app`), and target-device-only `test:live-ai` and `test:live-sdk`.

- `check` must cover formatting, lint, types, unit/integration tests, and build. E2E and packaging are additional release gates.
- Test timing boundaries, invalid signals, teardown, overrides, queue rules, lossless layout changes, persistence failures, AI failures, and privilege boundaries.
- Use deterministic clocks and fixtures for software behavior. Do not treat them as proof of camera accuracy, live integration, or user benefit.
- Run targeted checks as changes are made, then the full applicable release gates. Never weaken checks to obtain green output.
- Record exact outcomes in `docs/verification.md`: passed, failed, blocked, or not run, with evidence paths and environment details.
- Real camera behavior, local AI under capture load, and packaged macOS operation require actual target-device checks. Missing access is a blocker, not a pass.
- Evidence supports only what it demonstrates. No invented performance, user-study results, screenshots, demo runs, independent reviews, or efficacy claims.
- Finish with a focused self-review, fixes, and relevant rechecks. Do not label self-review as human approval.
- Report complete requirements and concrete blockers. No known unfinished work or unexplained workaround may be presented as complete. "Zero debt" and "pristine" are aspirations, not facts established by a passing test suite.
