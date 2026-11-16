# Headroom

Headroom is a macOS desktop app that changes how much a screen shows at once, while keeping your task, its information, and your decisions intact. It has two workspaces, a project-brief form and a reading/learning workspace, that share one layout control and one queue for optional help.

You can use it entirely by hand: switch between **Standard** and **One thing at a time** whenever you like. If you opt in, it can also use the Presage SmartSpectra SDK to read your pulse from the Mac's camera and _suggest_ showing one thing at a time when the reading stays above the range measured at the start of the session.

It is an experiment in adaptive accessibility. Whether sensing helps anyone is an open question (see [`docs/pilot.md`](docs/pilot.md)). It does not measure stress, focus, comprehension, or health, and it is not a medical device.

## Status

- **Works and is tested in software:** both workspaces, lossless layout switching, drafts and export, the shared queue, local AI explanations (also checked live against Ollama on the target Mac), the full sensing lifecycle and policy with synthetic data, security boundaries, accessibility checks, and a packaged macOS arm64 app.
- **Not yet verified live:** the Presage camera stream, readiness, calibration, and any real signal-derived suggestion. These need a Presage API key and a person at the Mac. Automatic mode stays disabled until the signal freshness gate is measured on a real device.

Details and evidence: [`docs/verification.md`](docs/verification.md).

## Requirements

- Apple Silicon Mac, macOS (tested on 26.6.2). Other platforms are not supported in this release.
- Node.js 24.15 (see `.nvmrc`) and npm.
- Optional: a [Presage developer API key](https://physiology.presagetech.com/auth/login) for sensing.
- Optional: [Ollama](https://ollama.com) running locally with a text model (for example `gemma4:e4b-it-q8_0`) for explanations. Cloud-proxied Ollama models are ignored.

## Setup and run

```bash
npm ci          # downloads the SDK runtime for every platform (several hundred MB)
npm run dev     # development build with hot reload
```

Package a local app:

```bash
npm run package:mac   # release/mac-arm64/Headroom.app and a zip
```

The package is ad-hoc signed and not notarized. It is for local testing, not public distribution.

## Using it

- **Project brief:** fill in the fields; drafts save automatically. Review shows everything; mark complete, then export JSON or Markdown to a file you choose. Nothing is submitted anywhere.
- **Learning:** start with the bundled HTTP caching lesson, paste text, or open a `.txt`/`.md` file (up to 20,000 characters). Choose a local model and use **Explain this section**; explanations are labeled as AI-generated and the source text is never changed.
- **Layouts:** **One thing at a time** shows the current step or section, its help, and the next action. Every other step stays one click away, and validation errors are always listed.
- **Queue:** optional tips and finished explanations wait here instead of interrupting.
- **Sensing (optional):** open **Sensing off** in the top bar, read the disclosure, give consent, enter your key (kept in memory only), choose a camera, allow macOS access, run the readiness check, then start. Set **Adaptation** to **Suggest** to receive suggestions. **Stop sensing** is always in the top bar.
- **Data:** preview and save a privacy-safe evidence file, or delete all drafts and preferences.

## Commands

| Command                 | Runs                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `npm run dev`           | electron-vite dev server and app                                          |
| `npm run format:check`  | Prettier                                                                  |
| `npm run lint`          | ESLint (strict, type-checked) and knip                                    |
| `npm run typecheck`     | `tsc` for main/preload, renderer, and tests/configs                       |
| `npm test`              | Vitest unit and jsdom UI tests                                            |
| `npm run build`         | Production bundles in `out/`                                              |
| `npm run check`         | All of the above except dev                                               |
| `npm run test:e2e`      | Build, then Playwright against the Electron app                           |
| `npm run package:mac`   | Build and package for macOS arm64                                         |
| `npm run test:packaged` | Smoke test of the packaged `.app`                                         |
| `npm run test:live-ai`  | Live Ollama check (`HEADROOM_LIVE_MODEL=<model>`); target Mac only        |
| `npm run test:live-sdk` | Live Presage probe (`PRESAGE_API_KEY`, person at camera); target Mac only |

## Privacy in brief

Telemetry for the Presage SDK is turned off, Presage LLM Insights are not used, and Headroom itself sends no camera frames or pulse values anywhere. The SDK contacts Presage to validate the key. Only brief drafts and three preferences are saved, unencrypted, on this Mac. Full details: [`docs/privacy.md`](docs/privacy.md).

## Limitations

- Pulse estimates come from a camera model with documented limits (stillness, steady lighting, one face, about 40–110 BPM). Outside those limits Headroom reports the reading as unavailable and makes no decisions.
- The suggestion thresholds are untested interaction heuristics, not clinical values.
- If your starting pulse is high, the rule cannot fire within the SDK's range and is marked unavailable for that session.
- Learning documents, notes, and answers are not saved between sessions.

## Documentation

[`docs/implementation-notes.md`](docs/implementation-notes.md) · [`docs/privacy.md`](docs/privacy.md) · [`docs/verification.md`](docs/verification.md) · [`docs/pilot.md`](docs/pilot.md) · [`docs/demo.md`](docs/demo.md) · [`docs/submission-draft.md`](docs/submission-draft.md)

## Credits

Uses the Presage SmartSpectra Node SDK (proprietary license; see `node_modules/@smartspectra/node-sdk/LICENSE`), Electron, React, zod, and Ollama. Lesson facts follow RFC 9111. No project license has been chosen yet.
