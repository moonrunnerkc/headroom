# Headroom: complete build prompt

Prepared November 15, 2026. Put this file and `CLAUDE.md` in a new `headroom` project directory. Give the coding agent the entire prompt below, or ask it to read this file and execute it. This document specifies work to perform; it is not evidence that the product has been built or validated.

## Assignment

Build Headroom, a desktop application that helps a person continue a demanding digital task by adjusting how much information and how many requests the interface presents simultaneously. Implement the complete, bounded release described here, including real Presage SmartSpectra integration, two useful workspaces, local AI assistance, tests, packaging, and evidence. Continue through implementation and verification rather than stopping after scaffolding or a plan.

The central promise is: **change presentation and pace while preserving the task, its information, and the user's authority.**

The intended product category is adaptive digital accessibility. Its potential benefit is a hypothesis to test. Do not claim to measure cognitive capacity, diagnose stress, detect confusion, improve health, prove comprehension, or guarantee a competition win. Never describe the concept as unprecedented without defensible evidence.

The primary target is Brad's Apple Silicon MacBook with 64 GB unified memory and its built-in webcam. No wearable or dedicated sensor is required. Hardware compatibility and usable measurements must still be established on the actual machine. Support macOS arm64 for this release. Do not claim other platforms are tested merely because dependencies support them.

## 1. Working standard

Read `CLAUDE.md`, applicable `AGENTS.md` files, and the existing directory before editing. Preserve unrelated work. If an implementation already exists, assess it against this specification before replacing anything.

Treat "no technical debt" as a release discipline: no known unfinished implementation, unexplained workarounds, misleading claims, avoidable duplication, dead code, or unsupported behavior shipped as complete. No prompt can guarantee the absence of future debt or defects. Disclose actual upstream limitations and unresolved verification instead of hiding them behind that phrase.

Use the smallest maintainable implementation that fulfills every release requirement. Make routine engineering decisions yourself and record only consequential decisions. Do not ask for approval between ordinary implementation steps. Ask only for a genuinely missing prerequisite or a decision that materially changes product scope. Never fabricate credentials, live readings, measurements, reviews, or user-study results.

Do not publish a repository, upload a recording, send a message, deploy, purchase, or submit the entry without an explicit instruction to do so. Prepare reviewable deliverables locally. Do not delete or rewrite an existing repository's history.

## 2. Read the current sources first

Inspect official documentation and the installed package source/types before using an API. Record the actual dependency versions and source URLs in `docs/implementation-notes.md`. If documentation and installed behavior disagree, investigate the discrepancy and state which version was verified. Do not copy unsafe typing shortcuts from examples.

- Challenge: https://dev.to/challenges/presage-2026-11-04
- Node/Electron SDK: https://smartspectra.presagetech.com/docs/nodejs
- API and lifecycle: https://smartspectra.presagetech.com/docs/nodejs/api-reference
- Requested metrics: https://smartspectra.presagetech.com/docs/nodejs/metrics
- Device readiness: https://smartspectra.presagetech.com/docs/nodejs/device-readiness
- Model limitations: https://smartspectra.presagetech.com/docs/model-cards-and-limitations/
- Telemetry: https://smartspectra.presagetech.com/docs/telemetry-and-privacy
- Official examples: https://github.com/Presage-Security/SmartSpectra
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Local generation: https://docs.ollama.com/api/generate
- Structured output: https://docs.ollama.com/capabilities/structured-outputs

As checked on November 15, the challenge deadline is November 22, 2026 at 11:59 p.m. Pacific. A valid entry requires a functional live Presage integration, public source, setup instructions, a demo video, and the required consent/data-handling explanation. The organizer requires a newly developed project. Recheck the rules before preparing the submission. Existing libraries and credited starter code may be used; do not retrofit an older product and call it a new entry.

## 3. Release scope

Deliver one Electron desktop application with:

1. Explicit camera consent, device setup, signal-quality feedback, calibration, and a visible stop control.
2. A shared presentation controller used by both workspaces.
3. A complete project-brief form with local draft saving and export.
4. A reading/learning workspace with actual local AI explanations and preserved source material.
5. Manual, suggested, and explicitly enabled automatic presentation modes.
6. A bounded queue coordinating optional requests from the two workspaces.
7. Transparent local evidence export, meaningful automated checks, a real-device verification procedure, and a macOS arm64 package.

This release coordinates the two shipped workspaces. It does not control arbitrary websites, macOS notifications, other applications, or system-wide accessibility settings. Do not imply otherwise. A future integration can reuse the small controller; do not build a plugin marketplace, public protocol, generic workflow engine, browser extension, microservice fleet, account system, cloud dashboard, or multi-agent platform now.

There must be no decorative controls, unimplemented settings, fake AI responses, or success messages without an actual completed operation.

## 4. Product experience

### First run and controls

Open directly to a usable workspace. Camera use is optional. Explain in plain language what sensing does, what it cannot infer, what leaves the device, what is retained, and how to stop. Offer a fully functional manual path without camera permission or a Presage key.

Sensing begins only after an explicit action. OS camera permission alone is not app consent. Automatic adaptation requires a separate opt-in describing exactly what may change. Never start capture at launch, restore it silently after a crash, or resume it after sleep without a new user action.

Provide camera selection, a framing preview during setup, actionable readiness feedback, calibration progress, and separate states for permission denial, unavailable device, invalid key, exhausted credits, bad capture conditions, and SDK failure. Do not collapse these into an endless loading spinner. If readiness assessment accesses the camera, obtain consent before invoking it.

Keep the primary workspace calm: a small persistent status/control strip, a clear task title, one obvious next action, and a visible queued-item count. Detailed signal diagnostics belong in an expandable developer view. Preserve stable layout, keyboard focus, input composition, scroll context, and screen-reader position during adaptation. Respect reduced motion, sufficient contrast, keyboard navigation, and 200% zoom. Do not use color alone to convey state.

Use three policies:

- **Manual:** the user selects Standard or One thing at a time. No sensing is required.
- **Suggest:** a qualifying signal change can offer the user's chosen presentation adjustment. Nothing changes until accepted.
- **Automatic:** after explicit opt-in, the same rule can apply only approved presentation changes at a safe interaction boundary. A visible reason and undo remain available.

Standard view is already well designed. Do not create an intentionally terrible interface merely to make adaptation look beneficial. One thing at a time reduces concurrent material while maintaining access to everything. A user can always open the full source, requirements, queue, or standard view.

### Project-brief workspace

Implement a useful form for planning a project: title, objective, intended audience, scope, constraints, target date, budget and currency, required resources, deliverables, and success criteria. Use sensible validation, accessible error association, edit/review navigation, and a final complete summary. A blank form is legitimate user input, not an implementation placeholder.

Support local drafts, restoration, deletion, and explicit export to JSON and Markdown. This is local document preparation; never pretend it submits an application to an external organization. Clearly label any bundled example as sample content.

Standard and focused layouts render the same canonical data and validation rules. Focused mode presents the current field or coherent field group, relevant instructions, progress, and the next action. Do not hide active validation errors, required commitments, or information needed to decide. All other fields remain reachable. Applying or reversing a layout change must preserve values, cursor position where feasible, validation state, and completion status.

### Learning workspace

Support pasted text and local UTF-8 `.txt` or `.md` files, bounded to 20,000 characters for the first release. Ship one complete, original introductory lesson on HTTP caching with a small fixed comprehension check and answer rationale. Cite its technical reference sources. User documents need no automatic quiz in this release.

Split source text deterministically into stable blocks without dropping or rewriting text. Both layouts use those same blocks. Preserve all source characters, block order, reading position, annotations, and answers. Rendering may normalize whitespace visually; the stored and exported source must remain intact.

Provide an **Explain this section** action backed by a real local Ollama request. The response contains a concise explanation and supporting source-block identifiers. Mark it as AI-generated supplementary material. Validate structure and referenced identifiers, but do not claim structural validation proves factual accuracy. Original text is always available, and AI output never replaces source material or rewrites a task requirement.

The focused layout shows one source block and its requested explanation. Additional suggestions wait in the shared queue. Do not generate a new explanation when the layout toggles. If AI is unavailable, preserve reading, navigation, and annotations while explaining why generation cannot run. Do not substitute a canned answer and label it AI.

## 5. Live Presage integration

Use `@smartspectra/node-sdk` through a small boundary owning configuration, lifecycle, decoding, and quality conversion. Verify the official Electron example and installed bridge implementation before selecting the capture path. Keep raw SDK objects out of the presentation policy.

Pulse-driven adaptation is required. Breathing rate and HRV are optional diagnostics only if fully supported and verified on the pinned version. Unavailable optional metrics must not have unfinished UI or masquerade as measurements. Do not request every SDK bundle by default. Do not use expression labels to infer mood or competence.

Current documented windows are a 12-second pulse average, 30-second breathing window, and 60-second HRV window. These are not independent instantaneous measurements. Motion, illumination, talking, and framing restrictions differ by metric. High confidence alone does not make a poor capture valid. Apply the current per-metric operating ranges and validation signals; outside them, report measurement unavailable rather than diagnosing the person.

Run the documented readiness check for the selected configuration. Interpret its verdict explicitly, including limited, blocked, and inconclusive results. Never use truthiness as readiness. Follow the installed SDK's supported lifecycle and await teardown before creating a replacement session. User-owned camera streams must be explicitly released by their owner. Handle stopped sessions and low-frame-rate failures without automatic restart loops.

Normalize valid measurements to a small typed app record with value, unit, source timestamp, receive time, provenance, and quality status. Preserve the distinction between SDK timestamps and a monotonic application clock. Establish the actual cadence, confidence scale, stability fields, and validation meanings from documentation and runtime observations. Reject malformed, repeated, out-of-order, stale, nonfinite, or out-of-range readings. Deduplicate accumulated packets if encountered.

When no new data arrives, a separate monotonic watchdog must detect staleness. A validity check that runs only when another sample arrives is insufficient. Bound all sample buffers. No unbounded waveform or frame history.

## 6. Deterministic adaptation policy

Keep sensing state separate from presentation state. A lost signal stops sensor-driven decisions but does not erase work or abruptly undo the user's chosen layout.

Implement the controller as ordinary typed functions with explicit state and a supplied monotonic time. No LLM, learned classifier, reinforcement learning, or opaque health score belongs in this decision path.

Use these initial engineering defaults, centrally configured and documented as **unvalidated interaction heuristics, not clinical thresholds**:

| Parameter | Initial behavior |
| --- | --- |
| Session baseline | Median pulse across 60 consecutive seconds of usable observations after SDK startup/warm-up. |
| Qualifying increase | Current pulse exceeds baseline by the greater of 10 BPM or 20% of baseline. |
| Required persistence | Increase persists for 20 consecutive usable seconds. |
| Suggestion interval | At most one automatic suggestion in 120 seconds; no duplicate pending suggestion. |
| Rearming | At least 60 usable seconds below half the qualifying increase, or explicit recalibration. |
| Baseline lifetime | Current session only; no rolling update that silently follows the trigger. |

Do not treat overlapping measurement windows as independent statistical evidence. Calibration is an interface reference, not a validated estimate of autonomic state. If a valid stable baseline cannot be obtained, stay manual and explain why.

If the qualifying threshold falls outside the SDK's usable measurement range for this baseline, mark the sensor rule unavailable for that session. Do not silently lower the threshold or accept invalid readings to force an event. Document how often this occurs during real testing.

Determine and document freshness and confidence gates from the pinned SDK and observed update cadence before enabling live adaptation. Do not guess a confidence threshold or assume a 1 Hz output. Unresolved quality semantics block automatic sensing behavior, not the manual workspace. Hardware validation must record the actual gate values.

An invalid or stale interval clears the pending persistence timer and expires an unaccepted sensor suggestion. A new session, device change, sleep/resume, or 30-second capture interruption invalidates the baseline. Short interruptions require a new uninterrupted persistence interval. Calibration itself restarts after any invalid interval.

Use neutral explanations such as "Your pulse reading has stayed above this session's starting range. Show one thing at a time?" Never say the system knows the user is overwhelmed. The user can dismiss, mute suggestions for the session, stop sensing, recalibrate, or choose either layout directly.

Automatic mode may reduce simultaneous content only at a safe boundary. It must not move controls under a pointer, interrupt typing or composition, steal focus, submit forms, answer questions, authorize actions, or change saved data. If there is no safe boundary, wait. Never automatically increase density after recovery. User choices take precedence, and undoing a sensor-applied change mutes further sensor changes for that session unless explicitly re-enabled.

These numbers are a reproducible starting policy, not a benefit claim. Adjust them only from documented capture/pilot evidence and rerun affected checks. Never weaken quality gates or tune to a single edited demonstration to manufacture a successful result.

## 7. Shared presentation budget

Both workspaces use one controller and one small request queue. A request carries an ID, originating workspace, task-context version, kind, creation time, and deduplication key. Use simple data structures; do not introduce a general event bus or distributed scheduler.

Focused mode permits one active decision and at most one contextual help item. Background workspace suggestions do not interrupt the active task. User-requested help receives priority over unsolicited suggestions. Permission, saving, and relevant validation failures remain visible and are never postponed as optional content.

Keep at most 20 optional queued items. Deduplicate, remove obsolete items when their task context changes, and discard the oldest optional suggestion when the limit is reached. Do not discard user work or errors. Show an accurate count and let the user inspect, open, or dismiss items. Completing a task must not release a burst of postponed notifications.

## 8. Stack and boundaries

Use TypeScript in strict mode, Electron, React, Vite, npm with a committed lockfile, and one maintained Electron packaging integration. Choose compatible current stable versions after checking the SDK requirements; pin the actual toolchain. Use a Node LTS version supported by the selected SDK. Prefer CSS and native platform capabilities over a large component or animation framework.

Use Vitest for policy and integration tests and Playwright for meaningful Electron/UI flows. Add a small schema-validation dependency only if it removes real boundary duplication. Do not add an ORM, database server, global state framework, or dependency injection container without a demonstrated need.

Keep logical ownership clear:

- Main process: privileged lifecycle, SDK boundary as supported, file operations, credentials, and local model requests.
- Preload: narrow typed bridge with explicit allowed operations.
- Renderer: task UI, capture if required by the supported integration, and presentation.
- Pure domain code: policy, queue, canonical task state, and lossless presentation transformations.

Prefer a small single-package repository. Organize by these responsibilities and the two real workspaces. Avoid speculative extension interfaces, pass-through services, repositories wrapping JSON files, and a `utils` dumping ground. Do not build a second SDK around the first one.

Keep credentials out of distributed bundles, saved task files, logs, and readback IPC. A user-entered key may pass transiently from a settings field to its owner process; clear the field afterward. Session-only storage is the default. If secure persistence is included, use verified OS-backed storage and refuse a plaintext fallback. Inspect the official bridge's credential handling rather than assuming its example meets these requirements.

Use isolated, sandboxed rendering, restrictive content policy, validated IPC senders and payloads, bounded file operations, and controlled navigation. Render imported/AI text as inert content. Do not expose generic filesystem, shell, arbitrary-URL, or raw Electron access to the renderer. Never disable security protections to make an integration work. Document a real incompatibility if one exists.

## 9. Local AI, storage, and privacy

Use an installed local Ollama model selected from the actual available models. Do not assume a model exists, download one silently, invoke a cloud-backed model, or send biometrics to a model. Restrict requests to a verified loopback endpoint, disallow redirects, and verify that the selected model executes locally. The only AI inputs are the source blocks and the user's explicit learning request.

Use schema-constrained output, runtime validation, a 20,000-character source limit, and a bounded response. Permit one generation at a time with cancellation and a finite timeout. Start with a 90-second timeout and a 1,024-token output limit where supported, then verify behavior with the chosen model. On malformed output, show a recoverable error and preserve the source. No silent retry cascade. A repeated explicit request may reuse an in-session result for the same source hash, block IDs, model, and prompt version.

Local inference and camera processing share machine resources. Measure them together. If inference prevents reliable capture, serialize or defer generation while preserving manual use and explaining the state. Do not solve contention by lowering signal-quality requirements.

Disable Presage telemetry explicitly before readiness checks or measurement. Current documentation includes full readiness reports, which can contain technical paths and account-correlated diagnostics. Telemetry off does not prove the SDK is offline: verify and disclose authentication and other required requests. Leave Presage LLM Insights disabled. Do not claim anonymous or fully local processing without evidence covering the actual configuration.

Never record camera frames, screenshots, physiological history, or detailed SDK payloads by default. Hold only the bounded measurements needed for the live session and clear them when sensing ends. Do not log secrets, document content, form answers, or vitals. Suppress/redact sensitive SDK logs without hiding actionable error categories.

Save task drafts and non-sensitive preferences locally in a small versioned format with runtime validation and atomic writes. Explain that local draft files may contain the user's entered text and are not automatically encrypted. Report write failures without losing the in-memory draft. Corrupt stored data must produce a recoverable error rather than silent replacement. Provide delete/reset controls and explicit native save dialogs for exports. Do not promise forensic erasure of backups or user-exported copies.

Evidence export is opt-in, previewable, and local. Default contents are elapsed task events, policy version, mode changes, quality-state changes, counts, and aggregate performance. Exclude raw vitals, document contents, identifying camera metadata, and secrets. Detailed biometric evidence requires separate explicit consent and must never be committed or uploaded automatically.

## 10. Code quality and efficiency

- Use named exports for application code, kebab-case filenames, explicit domain types, and exhaustive handling of meaningful states. A tool-required default export is acceptable only at that tool's configuration boundary.
- Enable strict checking, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Treat external values as `unknown` and validate them. No application `any`, double assertions, non-null assertions hiding uncertainty, or broad suppression of type/lint failures.
- Keep handwritten source files at or below 300 lines by separating real responsibilities. Do not compress code or create dozens of trivial forwarding files to meet a number. Generated/vendor files must be clearly excluded, not relabeled application code.
- Prefer functions and direct composition. Extract repetition when a real shared concept exists, generally by the third occurrence. No single-implementation interface hierarchies, premature generic frameworks, or decorative design patterns.
- Comments explain a necessary invariant, reason, unit, or external constraint briefly. No narrating obvious code, banner comments, redundant JSDoc, or copied essays. Public contracts need documentation only where names and types cannot communicate correct use.
- Handle expected failures at their owning boundary. Preserve context. No blanket try/catch, swallowed exceptions, catch-and-return-success behavior, endless retry, or fake fallback.
- Own every timer, subscription, stream, pending request, and native session. Dispose of it on all relevant lifecycle paths. Reject late callbacks from an old session or task version.
- Never run synchronous disk work or long blocking waits in interaction paths. Do not dispatch every camera frame through React state. Keep UI signal updates to at most 4 Hz while preserving SDK processing requirements. Bound queues, buffers, and result caches.
- Optimize measured bottlenecks. Favor clear code over speculative micro-optimizations. Record startup, input responsiveness, memory behavior, and sensor quality on the target machine without inventing performance promises.
- No TODO/FIXME/stub behavior in required features, unused flags, commented-out implementations, abandoned dependencies, or unsupported configuration surfaces. Remove work that is no longer used.

Enforce mechanically checkable rules through TypeScript, lint configuration, and CI, including unsafe typing, application export conventions, unused code, and the source-file limit. Keep generated/vendor exclusions explicit. Written instructions supplement those checks; they do not replace them. Do not add a custom policy framework where existing tools can enforce the rule.

## 11. Verification and evidence

Create one requirement table in `docs/verification.md`, mapping the release requirements to implementation, checks, observed results, and evidence paths. Use `passed`, `failed`, `blocked`, or `not run`. Never count a skipped or simulated check as a live pass.

Implement real commands for `dev`, `format:check`, `lint`, `typecheck`, `test`, `test:e2e`, `build`, `package:mac`, and `check`. Document what each actually runs. `check` should run formatting, lint, types, unit/integration tests, and build. Run E2E and packaging as additional release gates. CI must not require a developer's camera or paid credentials to run deterministic tests.

Tests must establish behavioral properties, especially:

1. Consent denial, stop, sleep, close, errors, and repeated starts cannot leave capture or stale decisions running.
2. Calibration timing, threshold boundaries, stale timestamps, clock changes, invalid values, quality loss, dropouts, cooldown, rearming, and manual overrides behave as specified.
3. Canonical answers, complete source text, requirement IDs, navigation, and task completion survive both layout directions. Required information remains reachable, including by keyboard and screen reader.
4. Shared queue ordering, deduplication, context invalidation, limits, and cross-workspace behavior are correct.
5. Persistence survives restart and handles malformed files and failed writes without silent data loss.
6. AI cancellation, timeout, malformed JSON, invalid source IDs, model unavailability, and late responses cannot corrupt task state or produce false success.
7. Malicious imported text stays inert; invalid IPC and unauthorized paths/URLs are rejected; sensitive data is excluded from logs and default exports.

Use deterministic fake clocks and clearly synthetic signal fixtures for policy tests. Keep fixtures in tests and exclude injection controls from the production package. These establish software behavior, not measurement accuracy or user benefit. Avoid snapshot-only suites, assertions that mirror implementation, and arbitrary coverage targets that reward trivial tests.

On the actual Mac, verify camera permission, a genuine live SDK stream, framing failures, covering/uncovering the camera, stop/restart, sleep, local AI under capture load, and the packaged `.app`. Inspect network/configuration behavior and record limits of that inspection. Where feasible, use a 15-minute soak to check that memory remains bounded and resources release on stop. Do not claim 15 minutes without running it.

Capture a live demonstration showing a real signal-derived policy event and its UI consequence, with settings and source provenance visible. A click on a manual button is not that evidence. Do not induce distress, fake a spike, stitch a replay into a live session, or hide changed sensitivity settings. If a usable live transition is not observed, document that gate as incomplete.

Missing camera access, credentials, model runtime, or macOS prevents the corresponding verification. Finish independent implementation and checks, provide precise steps for the remaining target-device work, and report the release as blocked. Do not write that the whole system is complete because mock-based tests passed.

## 12. Test the product premise

Write a short, executable pilot protocol in `docs/pilot.md`. Compare Standard, manually chosen focused presentation, and sensor-assisted suggestions using equivalent tasks. Counterbalance condition order and use a separate practice task to reduce learning effects. Keep the same task information and baseline design quality across conditions.

Measure completion, validation mistakes, comprehension for the fixed lesson, accepted/dismissed suggestions, unwanted changes, and participant preference. Record missing signals and setup burden. Recruit consenting adults only if the user arranges participation; do not invent participants or contact anyone independently.

A small pilot can reveal problems but cannot establish general efficacy. Report actual sample size, limitations, and results. Lower pulse is not the success metric. If sensing offers no useful advantage over the manual control, state that directly. Do not manufacture a marketing claim by choosing the most favorable run.

## 13. Build order and deliverables

Work in complete vertical slices, keeping each working before expanding:

1. Inspect the environment and current official integration. Establish SDK loading, consent, capture, valid pulse output, and reliable teardown on the target platform as early as available access permits. Do not spend most of the schedule polishing a UI before establishing feasibility.
2. Implement the pure policy and queue with meaningful tests and the manual controls.
3. Complete the project-brief workspace, persistence, export, and reversible presentation.
4. Complete the learning workspace and real local AI integration using the same controller.
5. Wire quality-gated live suggestions and opt-in automatic changes. Exercise bad-signal and override paths.
6. Run UI/accessibility checks, resource checks, packaging, and a focused human-readable code review of the final implementation. Fix findings; do not merely list them as future work.
7. Prepare evidence, accurate setup documentation, the demo procedure, and a submission draft grounded in observed behavior.

Deliver:

- Complete source, lockfile, strict tooling, and working checks.
- A concise README covering purpose, actual support, setup, manual use, sensing, AI, and honest limitations.
- `CLAUDE.md`, kept concise and synchronized with actual commands and architecture.
- `docs/implementation-notes.md`, `docs/privacy.md`, `docs/verification.md`, `docs/pilot.md`, and `docs/demo.md`.
- A macOS arm64 application package if the environment can build and verify it. State signing/notarization status accurately; do not pretend an unsigned local build is a signed public release.
- `docs/submission-draft.md` using the current challenge template. Mark pending evidence in verification; do not invent repository URLs, video links, efficacy claims, or publication status.

Before your final response, review the whole changed implementation for missing requirements, unnecessary abstractions, weak typing, inaccurate privacy copy, resource leaks, data loss, security exceptions, and misleading evidence. Fix all found defects within the authorized scope and rerun affected checks. A self-review is not an independent human review; label it accurately.

Your final report must state what works, how to run it, exact checks performed, live versus simulated evidence, packaging status, and any concrete blocker. Do not describe code as pristine, debt-free, production-ready, medically validated, or competition-ready unless the narrower claim is actually supported. Begin implementation after a short plan and carry the work through these gates.
