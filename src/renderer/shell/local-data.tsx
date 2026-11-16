import { useState } from 'react';
import { bridge } from '../bridge';

/** Honest storage disclosure and the single reset control for data Headroom itself saved. */
export function LocalData({ onDeleted }: { readonly onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section aria-labelledby="local-data-heading">
      <h2 id="local-data-heading">Local data</h2>
      <p>
        Headroom saves brief drafts and three preferences (layout, adaptation mode, AI model) as
        unencrypted files in its app data folder on this Mac. Pasted learning text, notes, answers,
        AI explanations, camera frames, and pulse readings are never saved. Your Presage key is kept
        in memory only.
      </p>
      <p className="muted">
        Deleting removes the files Headroom wrote. It cannot erase backups (such as Time Machine) or
        files you exported elsewhere, and it does not guarantee forensic erasure. The Presage SDK
        keeps its own device-key cache in ~/Library/Caches/SmartSpectraSDK, which this does not
        remove.
      </p>
      {confirming ? (
        <div className="alert" role="alert">
          <p>Delete every saved draft and reset preferences?</p>
          <div className="toolbar">
            <button
              type="button"
              className="danger"
              onClick={() => {
                setConfirming(false);
                void bridge()
                  .deleteLocalData()
                  .then((result) => {
                    if (result.status === 'ok') {
                      onDeleted();
                      setMessage('Saved drafts and preferences were deleted.');
                    } else setMessage(`Deletion failed: ${result.message}`);
                  });
              }}
            >
              Delete all
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Keep my data
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
          }}
        >
          Delete all drafts and preferences…
        </button>
      )}
      {message !== null && <p role="status">{message}</p>}
    </section>
  );
}
