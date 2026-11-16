# Demo procedure

Status: **not recorded.** A live demonstration needs a Presage API key and a person at the target Mac. Nothing here is evidence until it has actually been captured.

## What the video must show honestly

- A genuine live SDK session (Developer diagnostics open: provenance `presage-smartspectra-live-native-camera`, SDK 3.5.0, policy `pulse-policy-1`, gate status, packet counter increasing).
- A real signal-derived policy event and its UI consequence — the Suggest banner appearing — with the settings visible. Clicking a manual layout button is **not** this evidence.
- No induced distress, no edited spikes, no replayed or stitched sessions, no changed thresholds. If no qualifying rise occurs naturally, show the calibrated, armed state and say that no suggestion occurred; mark the live-event gate incomplete in `verification.md`.

## Setup

1. `npm ci && npm run build`, then `npm run dev` (or open `release/mac-arm64/Headroom.app`).
2. Good, even front lighting; laptop on a stable surface; one face in frame; avoid a bright window behind you.
3. Close other apps using the camera. Optional: start Ollama with a local model for the learning segment.

## Script (about 4 minutes)

1. **Manual first (0:00–0:45).** Open the app: it starts in the project brief without any camera use. Fill two fields, switch to **One thing at a time** and back to show values and focus are kept. Open **Queue** to show the waiting tip.
2. **Consent and setup (0:45–1:45).** Open **Sensing off** → read the disclosure aloud briefly. Check consent, paste the key (field clears), choose the MacBook Pro Camera, allow macOS access, run **Check readiness** and show the verdict text.
3. **Live sensing (1:45–3:00).** Start sensing. Expand **Developer diagnostics**. Show warm-up, validation hints (lean out of frame briefly to show "No face" handling and that calibration restarts), and calibration progress. Set **Adaptation → Suggest**.
4. **Policy event (if it happens naturally).** Show the banner text "Your pulse reading has stayed above this session's starting range. Show one thing at a time?", accept it, then use **Undo**. If no event occurs, say so on camera.
5. **Stop (3:00–3:20).** Press **Stop sensing** in the top bar; show the indicator returns to "Sensing off" and the camera light goes out.
6. **Learning (3:20–4:00).** Switch to Learning, pick a local model, **Explain this section**, point out the "AI-generated supplementary explanation" label and the unchanged source.

## After recording

- Save an evidence export from **Data** and keep it with the video (it contains no pulse values).
- Record the date, machine, lighting, whether a real policy event occurred, and any failures in `verification.md`.
- Do not upload or publish the video without explicit approval.
