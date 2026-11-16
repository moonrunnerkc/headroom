# Implementation notes

Consequential decisions and the sources they rest on. Verified on 2026-11-15 against the installed packages listed below.

## Pinned toolchain

| Component                                    | Version                                 | Why                                                                                                    |
| -------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Node.js                                      | 24.15.0 (`.nvmrc`)                      | LTS; the SDK README recommends Node 24 LTS                                                             |
| Electron                                     | 45.3.2 (embeds Node 24.22.2)            | Current stable; SDK requires Electron ≥ 28                                                             |
| `@smartspectra/node-sdk`                     | 3.5.0 (+ `node-sdk-darwin-arm64` 3.5.0) | Required live integration                                                                              |
| TypeScript                                   | 6.0.3                                   | typescript-eslint 8.72 supports `<6.1`; TS 7 is not yet supported by it                                |
| React / React DOM                            | 19.3.1                                  | UI                                                                                                     |
| Vite / electron-vite                         | 8.3.8 / 6.0.0                           | Builds main, preload, renderer                                                                         |
| electron-builder                             | 26.18.0                                 | The one packaging integration                                                                          |
| zod                                          | 4.6.7                                   | One schema per boundary: IPC (both directions), stored drafts, Ollama responses, SDK packets, evidence |
| Vitest / Playwright                          | 5.1.0 / 1.65.1                          | Unit+UI tests / Electron E2E                                                                           |
| ESLint / typescript-eslint / knip / Prettier | 10.15.0 / 8.72.2 / 6.45.1 / 3.10.1      | Enforced conventions                                                                                   |
| Ollama (runtime on target Mac)               | 0.32.14                                 | Local generation                                                                                       |

## Sources consulted

- SDK package source and types: `node_modules/@smartspectra/node-sdk/js/*.js`, `index.d.ts`, `renderer/index.d.ts`, `messages/generated.d.ts`, `docs/device-readiness.md`, `README.md` (version 3.5.0).
- Docs: <https://smartspectra.presagetech.com/docs/nodejs>, `/nodejs/api-reference`, `/nodejs/metrics`, `/nodejs/device-readiness`, `/model-cards-and-limitations/`, `/telemetry-and-privacy`, `/llm-insights.md`, `/measurement-quality.md`, <https://vandv.presagetech.com/arterial_pressure_model_card.html>. The fetched pages were not versioned; where they disagree with the installed package, the installed package was followed.
- Official Electron sample: <https://github.com/Presage-Security/SmartSpectra/tree/main/nodejs/samples/electron-quickstart> (README, `main.js`, `renderer.js`, `package.json`).
- Electron security checklist: <https://www.electronjs.org/docs/latest/tutorial/security>.
- Ollama: <https://docs.ollama.com/api/generate>, <https://docs.ollama.com/capabilities/structured-outputs>, plus observed `/api/tags`, `/api/show`, `/api/ps`, `/api/generate` responses from the local 0.32.14 runtime.
- Lesson facts: RFC 9111 and RFC 9110 (rfc-editor.org), MDN HTTP caching.
- Challenge: <https://dev.to/challenges/presage-2026-11-04>.

## Presage integration decisions

**Capture path: main-process native camera.** The official sample uses the renderer bridge (`@smartspectra/node-sdk/renderer` + `useMediaStream`, frames posted to main as custom input). Headroom instead uses `SmartSpectraSDK.useCamera(CameraSelection.byId(id), {1280×720, 30 fps})` in the main process because:

1. `checkDeviceReadiness()` exists only on the main-process class and returns `inconclusive` (`unsupported_input`) for custom-frame input (`smartspectra.js` `_runDeviceReadiness`). Readiness is only meaningful for the camera path.
2. The renderer bridge requires the API key in the renderer (`new SmartSpectraSDK({apiKey})` there); the sample even hard-codes it. The native path keeps the key in the main process.
3. No 3.6 MB frames cross IPC 30 times a second, and the renderer needs no media permission at all (all permission requests are denied).

The README notes the main-process camera "captures in THIS process — for Electron, prefer the renderer SDK". This is a recommendation, not a restriction; the 3.5.0 native camera path and camera discovery work under Electron 45 on this Mac (`availableCameras()` returned the MacBook Pro Camera). Live capture through this path is **not yet verified** (needs a key and a person; see `verification.md`).

**Metrics: `PULSE_RATE` only.** Presage documents that auto-fired LLM Insights ("one the first time pulse rate has a stable reading … then one every 60 seconds") require breathing and cardio to both be active, and that insights send buffered metric values off-device. Omitting `requestedMetrics` defaults to breathing, so Headroom passes exactly `[MetricType.PULSE_RATE]`. The docs do not state that this prevents insights, so the app counts any `insight` event, treats one as a violation, and stops sensing. Breathing and HRV are not exposed (not needed for the rule, and requesting breathing would risk insights).

**Telemetry off before anything else.** `enableTelemetry: false` is passed to every SDK instance, including the one used only for readiness. With telemetry on, readiness reports carry free text, paths, and account-correlated diagnostics.

**Readiness.** `checkDeviceReadiness()` opens the camera natively (camera-paced reference workload, default 30 s observation, 40 s max wait) after consent and macOS permission. Verdicts are compared explicitly: `ready` and `limited` allow start (limited shows a warning), `blocked` and `inconclusive` do not. The check cannot be cancelled through the 3.5.0 API; Stop waits for it to end and says so.

**Lifecycle.** One SDK instance per session; `stopAsync()` then `destroy()`; a process-wide teardown barrier prevents a new instance before the previous native teardown finishes (native state is process-global). Errors, `kSustainedLowFrameRate`, pipeline idle/error, sleep (`powerMonitor` `suspend`), window close, key change, and quit all stop capture. Nothing restarts automatically.

**Packets.** `cardio.pulseRate` is a repeated `MeasurementWithConfidence`. Packets are decoded with the SDK's own protobuf class (`Metrics.toObject(..., { longs: Number })`) and parsed with zod. Only the newest measurement newer than the last one seen is used; older entries in the same packet are counted as `superseded-in-packet`, so overlapping 12-second windows are never treated as independent samples.

**Timestamps.** The proto comment says measurement timestamps are "microseconds since Linux epoch"; the README troubleshooting table recommends monotonic microseconds for frame input. Headroom uses SDK timestamps only for ordering and duplicate detection, and uses the main process's monotonic `performance.now()` for every duration, freshness, and persistence decision. An SDK timestamp that advances more than 2 s faster than the app clock is rejected. Which epoch the live camera path actually uses is a live-verification item.

**Quality gates.** A reading influences policy only if all hold: finite values; confidence in [0, 100]; SDK timestamp strictly newer and not ahead of the app clock; latest SDK validation status `kOk`; 40 ≤ BPM ≤ 110; `stable === true`; confidence ≥ 40; outside the 12-second warm-up; and less than `staleAfterMs` since the previous usable reading. `stable`/≥ 40 is the SDK's own documented definition ("confidence at or above … ±3 bpm, which corresponds to confidence >= 40"), not a guess.

**Operating range.** The docs and model-card intended-use section disagree (40–110 BPM vs 40–180 BPM). Headroom uses the narrower documented 40–110. A threshold at or above 110 makes the rule unavailable for the session (baseline above ≈ 91.7 BPM), which the UI states.

**Freshness gate is provisional.** Neither the docs nor the package state the pulse output cadence. `staleAfterMs = 3000` is a provisional engineering value until cadence is observed on the target Mac. Because of that, `PULSE_POLICY.gateValidation` is `pending-device-validation`, which disables Automatic mode in this build (Suggest still works because nothing changes without acceptance). After live observation, record the cadence and chosen gate in `verification.md`, then change `gateValidation` and rerun the checks.

## Adaptation policy

Pure, deterministic code in `src/domain/signal-policy.ts` and `pulse-rule.ts`, configured in `pulse-policy-config.ts` (`pulse-policy-1`). It implements the specified defaults exactly: 60 s uninterrupted calibration median, threshold = baseline + max(10 BPM, 20 %), 20 s persistence, ≤ 1 trigger per 120 s, rearm after 60 usable seconds below baseline + half the increase, session-only baseline, baseline invalidated after a 30 s interruption, calibration restarted by any invalid interval, and a timer-driven watchdog (250 ms) that detects silence without new packets. These are unvalidated interaction heuristics, not clinical thresholds.

The presentation controller (`presentation-controller.ts`) is separate: sensor triggers become a pending suggestion (Suggest) or wait for a safe boundary (Automatic, only with separate consent and validated gates). Sensor rules only ever move Standard → One thing at a time. Any user layout choice wins; undoing an automatic change mutes sensor changes for the session; losing the signal expires pending suggestions but never changes the layout.

## Lossless layouts

Both layouts render the same mounted DOM. "One thing at a time" hides other field groups or source blocks with the `hidden` attribute rather than unmounting them, so the focused element, caret, IME composition, values, validation state, and annotations survive in both directions. Navigation to every step stays visible, and the error summary lists errors from hidden groups.

## Packaging finding

The bundler hoists `require("@smartspectra/node-sdk")` above any statement in the entry module, so setting `SMARTSPECTRA_CAPI_PATH` inside the main module ran too late and the packaged app showed a modal "not installed" error (found by the packaged smoke test). `src/main/index.ts` now sets the path and then dynamically imports `app-main.ts`.

## Local AI

Fixed loopback origin `http://127.0.0.1:11434` (`OLLAMA_HOST` is ignored), `redirect: 'error'`, models with `remote_host`/`remote_model` excluded, `completion` capability required, `/api/ps` confirms the model is resident after generation, `think: false` for thinking-capable models, `format` set to the JSON Schema of the output, `num_predict: 1024`, temperature 0.2, 90 s timeout, one request at a time, explicit cancel, ≤ 50 cached results keyed by SHA-256 of prompt version, model, request, and blocks. Input is limited to the target block, its neighbours, and the learner's question.

## Not implemented (by scope)

- Breathing and HRV display: not requested from the SDK (see above).
- Secure key persistence: keys are session-only; there is no plaintext fallback because there is no persistence.
- Detailed biometric evidence export: not offered. The default export carries no physiological values.
- Persisting learning documents, notes, or answers: in-memory only, by privacy choice.
