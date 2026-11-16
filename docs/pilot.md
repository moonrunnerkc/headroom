# Pilot protocol

Purpose: find out whether sensor-assisted suggestions add anything over a manual layout control, and surface problems. A small pilot cannot establish general efficacy. Lower pulse is **not** a success measure.

Status: **not run.** No participants have been recruited. Run only if the project owner arranges participation with consenting adults.

## Participants and consent

- Adults (18+) who volunteer and give written informed consent covering camera use, what is measured, what is recorded (see below), and the right to stop at any time without explanation.
- Exclude anyone who prefers not to use a camera; they may still try the manual conditions.
- Do not induce stress, apply time pressure, or deceive participants about the purpose.
- Record no names in study files; use participant codes (P01, P02…).

## Design

Within-subjects, three conditions, each with an equivalent task:

| Condition           | Layout control                                                                | Sensing          |
| ------------------- | ----------------------------------------------------------------------------- | ---------------- |
| S – Standard        | Standard layout, participant may switch                                       | Off              |
| M – Manual focus    | Participant chooses Standard or One thing at a time freely                    | Off              |
| A – Sensor-assisted | Suggest mode: may offer One thing at a time; participant accepts or dismisses | On (after setup) |

- **Practice first:** a short practice brief (sample content) in Standard layout, not analyzed.
- **Equivalent tasks:** three project-brief scenario cards of matched length and difficulty (prepare them before the pilot; each fills the same 11 fields). Assign cards so each appears equally often in each condition.
- **Counterbalancing:** rotate the six possible condition orders (SMA, SAM, MSA, MAS, ASM, AMS) across participants; with fewer than six participants, report which orders were used.
- **Constant design quality:** use the same build, window size, and theme for every condition. Do not alter Standard layout to make it worse.

## Session script (per participant, about 45 minutes)

1. Consent; explain that the app is being tested, not the person.
2. Practice task (5 min).
3. For condition A only: sensing setup (consent checkbox, key entered by the facilitator, readiness check, start, wait for calibration). Record setup time and any failure state shown.
4. Per condition: complete one brief (up to 10 minutes). In one condition only, also read the bundled HTTP caching lesson and answer its four fixed questions. The app has a single fixed comprehension check, so comprehension can be compared only between participants: rotate which condition includes the lesson so each condition gets it equally often.
5. After each condition: two questions on a 1–7 scale — "How manageable did the screen feel?" and "How much did the app interrupt you?"
6. End: ranking of the three conditions by preference, and open comments; ask specifically about any unwanted change.

## Measures

| Measure                                                    | Source                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Task completion (brief marked complete within 10 min)      | App state / observer                                                                                           |
| Validation mistakes (errors shown at completion attempt)   | Error summary count, observer                                                                                  |
| Comprehension score                                        | Fixed questions                                                                                                |
| Suggestions offered / accepted / dismissed / expired       | Evidence export (`suggestion-*` events)                                                                        |
| Unwanted changes                                           | Participant report + `layout-changed` events with cause `accepted-suggestion` that the participant later undid |
| Missing or unusable signal time, rule unavailable sessions | Evidence export (`signal-quality`, `baseline` events)                                                          |
| Setup burden (minutes, failures)                           | Observer timing                                                                                                |
| Preference ranking, ratings                                | Questionnaire                                                                                                  |

Export evidence after each session with **Data → Preview export → Save this file…**. The default export contains no pulse values or text.

## Analysis and reporting

- Report the actual number of participants, orders used, and every session, including failures and dropouts.
- Describe results per condition with counts and medians; do not run significance tests on a handful of participants.
- Report how often the sensor rule was unavailable (baseline too high) or the signal unusable.
- If the sensor-assisted condition shows no advantage over Manual focus, say so directly.
- Do not select the most favorable run for promotion.
