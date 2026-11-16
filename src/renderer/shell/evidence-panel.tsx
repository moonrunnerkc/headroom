import { useState } from 'react';
import type { EvidenceDocument } from '../../shared/evidence-schema';
import { bridge } from '../bridge';

/** Opt-in, previewable, local evidence export. The preview is exactly what will be written. */
export function EvidencePanel({ build }: { readonly build: () => EvidenceDocument }) {
  const [preview, setPreview] = useState<EvidenceDocument | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section className="panel" aria-labelledby="evidence-heading">
      <h2 id="evidence-heading">Session evidence</h2>
      <p>
        The export contains elapsed-time events (layout, mode, suggestion, signal-quality, and queue
        changes), counts, the policy version, and aggregate timing. It contains no pulse values,
        camera images, document text, form answers, notes, or keys. Nothing is sent anywhere; you
        choose where the file is saved.
      </p>
      <button
        type="button"
        onClick={() => {
          setPreview(build());
          setMessage(null);
        }}
      >
        {preview === null ? 'Preview export' : 'Refresh preview'}
      </button>
      {preview !== null && (
        <>
          <pre className="evidence-preview" tabIndex={0} aria-label="Evidence export preview">
            {JSON.stringify(preview, null, 2)}
          </pre>
          <button
            type="button"
            className="primary"
            onClick={() => {
              void bridge()
                .saveEvidence(preview)
                .then((result) => {
                  setMessage(
                    result.status === 'saved'
                      ? `Saved ${result.fileName}.`
                      : result.status === 'cancelled'
                        ? 'Save cancelled; nothing was written.'
                        : `Save failed: ${result.message}`,
                  );
                });
            }}
          >
            Save this file…
          </button>
        </>
      )}
      {message !== null && <p role="status">{message}</p>}
    </section>
  );
}
