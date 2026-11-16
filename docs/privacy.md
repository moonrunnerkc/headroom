# Privacy and data handling

This describes what the current build does. Where something has not been verified on a live device, it says so.

## Camera consent

- Nothing touches the camera at launch. Headroom works fully without a camera, a Presage key, or Ollama.
- Sensing starts only after all of: the in-app consent checkbox ("I choose to let Headroom use my camera for pulse readings during this session"), a Presage key entered for the session, macOS camera permission, a readiness check, and **Start sensing**. macOS permission alone is not treated as consent.
- The readiness check itself uses the camera for up to about 40 seconds; it runs only after consent.
- A **Stop sensing** button is always visible in the top bar while the camera is in use. Unchecking consent also stops sensing.
- Capture stops on errors, low frame rate, sleep, window close, quit, or key removal, and never restarts by itself.
- Automatic layout changes need a second, separate opt-in each session, and are disabled in this build until the signal gates are validated on a target Mac.

## What sensing can and cannot tell

Headroom uses only the SDK's pulse-rate estimate. It does not infer stress, mood, confusion, competence, comprehension, or health, does not use facial expressions, and never submits, answers, authorizes, or changes work. A pulse reading above the session's starting range can only lead to a suggestion to show one thing at a time.

## What leaves the Mac

| Data                        | Where it goes                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presage API key             | Passed to the Presage SDK in the main process. Presage documents that the SDK contacts its backend "only … to authenticate the API key and validate the subscription".                            |
| SDK telemetry               | Disabled (`enableTelemetry: false`) for every SDK instance, including readiness. Presage documents that "when disabled, the SDK starts no telemetry session and transmits nothing" for telemetry. |
| Presage LLM Insights        | Not used. Headroom requests only `PULSE_RATE`, never calls `requestInsight`, and stops sensing if an insight packet ever arrives.                                                                 |
| Camera frames, pulse values | Headroom sends them nowhere. Presage documents on-device metric computation.                                                                                                                      |
| Learning text and questions | Sent only to Ollama on `127.0.0.1` when you click **Explain this section**. Remote/cloud Ollama models are excluded and redirects are refused.                                                    |
| Brief content               | Never sent anywhere. Exports are written only to files you choose.                                                                                                                                |

**Limits of these statements:** authentication requests can correlate use with your Presage account and device. Headroom has not captured and audited every network request the SDK makes; "telemetry off" is not proof the SDK is offline. A network inspection on the target Mac is listed as `not run` in `verification.md`.

## What is stored

| Data                                                  | Stored?                                             | Where                                                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Brief drafts                                          | Yes, automatically, unencrypted JSON                | `~/Library/Application Support/Headroom/headroom-data/drafts/`                                                            |
| Preferences (layout, manual/suggest mode, model name) | Yes, unencrypted JSON                               | `…/headroom-data/preferences.json`                                                                                        |
| Presage key                                           | No (memory only, cleared on quit or **Forget key**) | —                                                                                                                         |
| Camera frames, preview images                         | No                                                  | Preview frames are 320-px JPEGs held only as a temporary object URL                                                       |
| Pulse readings                                        | No                                                  | Only the latest reading, a 64-entry interval history, counters, and policy state, in memory, discarded when sensing stops |
| Learning text, notes, answers, explanations           | No (memory only)                                    | —                                                                                                                         |
| SDK device-key cache                                  | Written by the Presage SDK                          | `~/Library/Caches/SmartSpectraSDK`                                                                                        |
| Evidence export                                       | Only when you click **Save this file…**             | A path you choose                                                                                                         |

Writes are atomic (temporary file, fsync, rename). A failed save is shown and your in-memory draft is kept. A corrupt or unreadable file is reported, never silently replaced.

## Deleting data

- **Delete this draft** / **Delete selected** remove one draft file.
- **Data → Delete all drafts and preferences…** removes every file Headroom wrote and starts a fresh blank brief.
- Deletion cannot reach backups (for example Time Machine) or files you exported, and is not forensic erasure. It does not remove the SDK's cache folder; delete `~/Library/Caches/SmartSpectraSDK` manually if you want that gone.

## Evidence export

Opt-in and previewable. The preview shows exactly the JSON that will be written. It contains elapsed-time events (layout, mode, suggestion, signal-quality, baseline, queue, and save events), counts, the policy and gate versions, and aggregate timing (AI request count and median duration, SDK packet count and median interval). The schema accepts only short kebab-case tokens as event details, so it cannot carry document text, answers, notes, keys, camera metadata, or pulse values; the main process validates it again before writing.

## Logging

The app does not log document content, form answers, keys, or vitals. SDK log level is set to errors only. Console output is limited to warnings and errors in the main process.
