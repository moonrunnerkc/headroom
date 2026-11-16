/** Plain-language disclosure shown before any camera use. Keep in sync with docs/privacy.md. */
export function SensingExplainer() {
  return (
    <div className="explainer">
      <p>
        Sensing is optional. Every workspace feature works without it. When you turn it on, Headroom
        uses the Presage SmartSpectra SDK to estimate your pulse from the camera image on this Mac,
        and may suggest showing one thing at a time if the reading stays above the range measured at
        the start of this session.
      </p>
      <ul>
        <li>
          <strong>What it cannot tell:</strong> it does not detect stress, confusion, mood, health,
          or ability, and it never submits, answers, or changes your work. A pulse reading is not a
          diagnosis.
        </li>
        <li>
          <strong>What leaves this Mac:</strong> the SDK contacts Presage to validate your API key
          and account. Headroom turns SDK telemetry off, does not request the metrics Presage uses
          for LLM Insights, and itself sends no camera frames or pulse values anywhere. Presage
          documents that its SDK computes metrics on-device; Headroom has not independently audited
          every network request the SDK makes.
        </li>
        <li>
          <strong>What is kept:</strong> only the latest reading and short timing counters, in
          memory, until you stop. Nothing is recorded or saved. Your API key is held in memory for
          this session only.
        </li>
        <li>
          <strong>How to stop:</strong> use Stop sensing in the top bar at any time. Closing the
          app, sleeping the Mac, or an error also stops it, and it never restarts by itself.
        </li>
      </ul>
    </div>
  );
}
