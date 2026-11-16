import { useEffect, useState } from 'react';
import { DEFAULT_PREFERENCES, type Preferences } from '../shared/draft-schema';
import { bridge } from './bridge';
import { HeadroomApp } from './headroom-app';

type Loaded =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly preferences: Preferences }
  | { readonly kind: 'unreadable'; readonly message: string };

/** Loads saved preferences first so the initial layout is the user's, without a visible switch. */
export function App() {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  useEffect(() => {
    void bridge()
      .loadPreferences()
      .then((result) => {
        setLoaded(
          result.status === 'ok'
            ? { kind: 'ready', preferences: result.preferences }
            : { kind: 'unreadable', message: result.message },
        );
      });
  }, []);

  switch (loaded.kind) {
    case 'loading':
      return <p className="loading">Loading Headroom…</p>;
    case 'unreadable':
      return (
        <main className="recovery">
          <h1>Saved preferences could not be read</h1>
          <p>{loaded.message} Drafts are stored separately and are not affected.</p>
          <div className="toolbar">
            <button
              type="button"
              className="primary"
              onClick={() => {
                void bridge()
                  .savePreferences(DEFAULT_PREFERENCES)
                  .then((result) => {
                    setLoaded(
                      result.status === 'saved'
                        ? { kind: 'ready', preferences: DEFAULT_PREFERENCES }
                        : { kind: 'unreadable', message: result.message },
                    );
                  });
              }}
            >
              Reset preferences to defaults
            </button>
            <button
              type="button"
              onClick={() => {
                setLoaded({ kind: 'ready', preferences: DEFAULT_PREFERENCES });
              }}
            >
              Continue with defaults without saving
            </button>
          </div>
        </main>
      );
    case 'ready':
      return <HeadroomApp preferences={loaded.preferences} />;
  }
}
