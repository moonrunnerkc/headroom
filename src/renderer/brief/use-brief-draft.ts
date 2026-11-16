import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY_BRIEF,
  validateBrief,
  type BriefFieldId,
  type BriefFields,
  type FieldErrors,
} from '../../domain/brief';
import type { DraftListEntry, StoredDraft } from '../../shared/draft-schema';
import type { HeadroomApi } from '../../shared/headroom-api';
import { bridge } from '../bridge';
import type { EvidenceRecorder } from '../evidence-log';
import { SAMPLE_BRIEF } from './sample-brief';

const AUTOSAVE_DELAY_MS = 800;

export type SaveState =
  | { readonly kind: 'unsaved' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly at: string }
  | { readonly kind: 'failed'; readonly message: string };

function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

function newDraft(fields: BriefFields, sample: boolean): StoredDraft {
  const now = new Date().toISOString();
  return {
    formatVersion: 1,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    complete: false,
    sample,
    fields,
  };
}

/** Canonical brief state shared by both layouts, with debounced atomic autosave. */
export function useBriefDraft(recorder: EvidenceRecorder) {
  const [draft, setDraft] = useState<StoredDraft>(() => newDraft(EMPTY_BRIEF, false));
  const [touched, setTouched] = useState<ReadonlySet<BriefFieldId>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: 'unsaved' });
  const [drafts, setDrafts] = useState<DraftListEntry[]>([]);
  const [listProblem, setListProblem] = useState<string | null>(null);
  const dirty = useRef(false);
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const errors: FieldErrors = useMemo(
    () => validateBrief(draft.fields, localToday(), CURRENCIES),
    [draft.fields],
  );

  const applyList = useCallback((result: Awaited<ReturnType<HeadroomApi['listDrafts']>>) => {
    if (result.status === 'ok') {
      setDrafts(result.drafts);
      setListProblem(null);
    } else setListProblem(result.message);
  }, []);
  const refreshList = useCallback(async () => {
    applyList(await bridge().listDrafts());
  }, [applyList]);

  const persist = useCallback(async () => {
    const snapshot = latest.current;
    setSave({ kind: 'saving' });
    const result = await bridge().saveDraft(snapshot);
    if (result.status === 'saved') {
      if (latest.current === snapshot) dirty.current = false;
      setSave({ kind: 'saved', at: result.savedAt });
      recorder.record('draft-saved');
      void refreshList();
    } else {
      // The in-memory draft is untouched; the user can retry or export it.
      setSave({ kind: 'failed', message: result.message });
      recorder.record('draft-save-failed');
    }
  }, [recorder, refreshList]);

  useEffect(() => {
    void bridge().listDrafts().then(applyList);
  }, [applyList]);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, persist]);

  const update = useCallback((field: BriefFieldId, value: string) => {
    dirty.current = true;
    setDraft((current) => ({
      ...current,
      complete: false,
      updatedAt: new Date().toISOString(),
      fields: { ...current.fields, [field]: value },
    }));
  }, []);

  const touch = useCallback((field: BriefFieldId) => {
    setTouched((current) => (current.has(field) ? current : new Set([...current, field])));
  }, []);

  /** A blank draft is saved only once edited; sample content is saved immediately. */
  const replace = useCallback((next: StoredDraft, origin: 'blank' | 'sample' | 'stored') => {
    dirty.current = origin === 'sample';
    setDraft(next);
    setTouched(new Set());
    setShowAllErrors(false);
    setSave(origin === 'stored' ? { kind: 'saved', at: next.updatedAt } : { kind: 'unsaved' });
  }, []);

  return {
    draft,
    errors,
    touched,
    showAllErrors,
    save,
    drafts,
    listProblem,
    update,
    touch,
    revealAllErrors: () => {
      setShowAllErrors(true);
    },
    retrySave: () => void persist(),
    markComplete: () => {
      if (Object.keys(errors).length > 0) return false;
      dirty.current = true;
      setDraft((current) => ({ ...current, complete: true, updatedAt: new Date().toISOString() }));
      recorder.record('brief-completed');
      return true;
    },
    startNew: () => {
      replace(newDraft(EMPTY_BRIEF, false), 'blank');
    },
    /** After local data deletion, drop the in-memory draft too so autosave cannot recreate it. */
    forgetAll: () => {
      replace(newDraft(EMPTY_BRIEF, false), 'blank');
      void refreshList();
    },
    loadSample: () => {
      replace(newDraft(SAMPLE_BRIEF, true), 'sample');
    },
    open: async (id: string): Promise<string | null> => {
      const result = await bridge().loadDraft(id);
      if (result.status !== 'ok') return result.message;
      replace(result.draft, 'stored');
      return null;
    },
    remove: async (id: string): Promise<string | null> => {
      const result = await bridge().deleteDraft(id);
      if (result.status !== 'ok') return result.message;
      if (latest.current.id === id) replace(newDraft(EMPTY_BRIEF, false), 'blank');
      await refreshList();
      return null;
    },
  };
}

export type BriefDraftControls = ReturnType<typeof useBriefDraft>;
