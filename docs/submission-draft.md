---
title: 'Headroom: a screen that can show less at once, with your consent'
published: false
tags: devchallenge, presagechallenge
---

<!--
DRAFT ONLY. Not published or submitted. Before submitting:
- Recheck the rules at https://dev.to/challenges/presage-2026-11-04 (entries close November 22, 2026, 11:59 PM PST).
- Complete the live checks in docs/verification.md and replace every [PENDING] marker with observed facts, or remove the claim.
- The project owner must approve publication; the video must not be uploaded without approval.
-->

_This is a submission for the [Presage Challenge](https://dev.to/challenges/presage-2026-11-04)._

## What I Built

Headroom is a macOS desktop app with two real workspaces, a project-brief form and a reading/learning workspace, that share one layout control. You can switch any time between **Standard** and **One thing at a time**, which shows the current step or section, its help, and the next action, while keeping every field, error, and source sentence one click away. Switching never loses typing, focus, the caret, or validation state.

Sensing is optional. With your consent, Headroom uses the Presage SmartSpectra SDK to estimate your pulse from the Mac's camera. After a 60-second calibration, if the reading stays clearly above that session's starting range for 20 seconds, it _suggests_ showing one thing at a time. Nothing changes until you accept. It does not claim to detect stress, focus, or comprehension; it is an experiment in adaptive accessibility, and whether it helps is an open question.

The learning workspace includes an original HTTP caching lesson with a short comprehension check, and can explain any section with a local Ollama model. Explanations are labeled as AI-generated and never replace the source.

## Demo

[PENDING: demo video link. See docs/demo.md. The video must show a genuine live SDK session; if no natural signal-derived suggestion occurs, the video will say so.]

## Code

<https://github.com/moonrunnerkc/headroom>

Setup: `npm ci`, then `npm run dev` on an Apple Silicon Mac with Node 24. A Presage API key is needed only for sensing; everything else works without it.

## How It Responds to Human Signals

- **Signal:** `PULSE_RATE` from `@smartspectra/node-sdk` 3.5.0, captured natively in the Electron main process so the SDK's device-readiness check applies and the API key never enters the web page.
- **Quality first:** a reading counts only if the SDK marks it `stable` (confidence ≥ 40, the SDK's ±3 BPM standard), its validation status is OK, it is within the documented 40–110 BPM range, it is fresh, and the 12-second averaging warm-up has passed. A separate watchdog notices when readings stop.
- **Policy:** median of 60 uninterrupted usable seconds sets the session's starting range; a rise of at least 10 BPM or 20 % that lasts 20 seconds can produce one suggestion, at most every 2 minutes, and it re-arms only after a minute back near baseline. If the starting pulse is so high that the rule could only fire outside the SDK's valid range, the rule is shown as unavailable instead of being loosened.
- **Your authority:** suggestions wait for acceptance; you can dismiss, mute for the session, recalibrate, stop, or pick either layout yourself. Losing the signal never undoes your layout.
- [PENDING: observed live cadence, readiness verdict, and whether a real suggestion occurred during testing.]

## Prize Categories

Best Thoughtful Real-World Use [PENDING: owner to confirm category choice].

## Consent and Data Handling

- **Consent:** the camera is never used at launch. Sensing requires an in-app consent checkbox, a session-only API key, macOS camera permission, a readiness check, and an explicit Start. A **Stop sensing** button stays in the top bar. Errors, sleep, closing the window, or quitting stop capture, and it never restarts by itself.
- **Storage:** no video, images, or pulse history are stored. Only the latest reading and short counters live in memory and are discarded on stop. Brief drafts and three preferences are saved unencrypted on the Mac and can be deleted in the app. The API key is kept in memory only.
- **Sharing:** Headroom sends no camera frames or pulse values anywhere. The SDK contacts Presage to validate the API key and subscription, which can be associated with the Presage account.
- **SDK telemetry:** disabled (`enableTelemetry: false`) before the readiness check and every measurement.
- **AI services:** Presage LLM Insights are not used; Headroom requests only pulse, never calls `requestInsight`, and stops sensing if an insight ever arrives. Section explanations use a local Ollama model on 127.0.0.1 and receive only the selected text and your question, never camera or pulse data.
- **Retention and deletion:** drafts persist until you delete them (individually or with **Delete all drafts and preferences**). The SDK keeps a device-key cache in `~/Library/Caches/SmartSpectraSDK`.
- Not a medical device; no diagnosis or treatment claims.

## Agent Session

[OPTIONAL, PENDING owner decision. If included, review the transcript for keys and personal data before making it public.]
