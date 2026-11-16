import { useCallback, useEffect, useRef, useState } from 'react';
import { splitIntoBlocks, type SourceBlock } from '../../domain/source-blocks';
import type { ExplainResult } from '../../shared/ai-types';
import { bridge } from '../bridge';
import type { EvidenceRecorder } from '../evidence-log';
import { LESSON_TEXT, LESSON_TITLE } from './http-caching-lesson';

export interface LearningDocument {
  readonly id: string;
  readonly title: string;
  readonly origin: 'lesson' | 'pasted' | 'file';
  /** Exact source text; blocks are slices of it and are never rewritten. */
  readonly text: string;
  readonly blocks: readonly SourceBlock[];
}

export type Explanation = Extract<ExplainResult, { status: 'ok' }>;
export const CHECK_TARGET = 'check';

function makeDocument(
  title: string,
  origin: LearningDocument['origin'],
  text: string,
): LearningDocument {
  return { id: crypto.randomUUID(), title, origin, text, blocks: splitIntoBlocks(text) };
}

interface PendingRequest {
  readonly requestId: string;
  readonly blockId: string;
  readonly documentId: string;
}

/** Learning state shared by both layouts. Annotations and answers live in this session only. */
export function useLearning(
  recorder: EvidenceRecorder,
  onExplanationReady: (blockId: string, documentId: string) => void,
) {
  const [document, setDocument] = useState(() => makeDocument(LESSON_TITLE, 'lesson', LESSON_TEXT));
  const [position, setPosition] = useState<string>('b001');
  const [annotations, setAnnotations] = useState<Readonly<Record<string, string>>>({});
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({});
  const [checked, setChecked] = useState(false);
  const [explanations, setExplanations] = useState<Readonly<Record<string, Explanation>>>({});
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [aiError, setAiError] = useState<{
    readonly blockId: string;
    readonly message: string;
  } | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const documentRef = useRef(document);
  useEffect(() => {
    documentRef.current = document;
  }, [document]);
  // A function boundary keeps the post-await check from relying on pre-await narrowing.
  const isCurrent = useCallback(
    (request: PendingRequest) =>
      pendingRef.current?.requestId === request.requestId &&
      documentRef.current.id === request.documentId,
    [],
  );
  const readyRef = useRef(onExplanationReady);
  useEffect(() => {
    readyRef.current = onExplanationReady;
  }, [onExplanationReady]);

  const replaceDocument = useCallback((next: LearningDocument) => {
    const inFlight = pendingRef.current;
    if (inFlight !== null) void bridge().cancelExplain(inFlight.requestId);
    pendingRef.current = null;
    setPending(null);
    setDocument(next);
    setPosition(next.blocks[0]?.id ?? CHECK_TARGET);
    setAnnotations({});
    setAnswers({});
    setChecked(false);
    setExplanations({});
    setAiError(null);
  }, []);

  const explain = useCallback(
    async (blockId: string, question: string, model: string) => {
      const doc = documentRef.current;
      const index = doc.blocks.findIndex((block) => block.id === blockId);
      if (index < 0 || pendingRef.current !== null) return;
      const context = doc.blocks.slice(Math.max(0, index - 1), index + 2);
      const request: PendingRequest = {
        requestId: crypto.randomUUID(),
        blockId,
        documentId: doc.id,
      };
      pendingRef.current = request;
      setPending(request);
      setAiError(null);
      const result: ExplainResult = await bridge()
        .explain({
          requestId: request.requestId,
          model,
          targetBlockId: blockId,
          question,
          blocks: context.map((block) => ({ id: block.id, text: block.text })),
        })
        .catch(() => ({
          status: 'error',
          requestId: request.requestId,
          code: 'runtime-unavailable',
          message: 'The explanation request could not be delivered to the app process.',
        }));
      // A late answer for a replaced document or superseded request is discarded.
      if (!isCurrent(request)) return;
      pendingRef.current = null;
      setPending(null);
      recorder.record(
        'ai-result',
        result.status === 'ok' ? (result.fromSessionCache ? 'ok-cached' : 'ok') : result.code,
      );
      if (result.status === 'ok') {
        if (!result.fromSessionCache) recorder.recordAiDuration(result.durationMs);
        setExplanations((current) => ({ ...current, [blockId]: result }));
        readyRef.current(blockId, request.documentId);
      } else {
        setAiError({ blockId, message: result.message });
      }
    },
    [recorder, isCurrent],
  );

  const cancel = useCallback(() => {
    const inFlight = pendingRef.current;
    if (inFlight === null) return;
    void bridge().cancelExplain(inFlight.requestId);
  }, []);

  return {
    document,
    position,
    setPosition,
    annotations,
    annotate: (blockId: string, text: string) => {
      setAnnotations((current) => ({ ...current, [blockId]: text }));
    },
    answers,
    answer: (questionId: string, optionId: string) => {
      setAnswers((current) => ({ ...current, [questionId]: optionId }));
    },
    checked,
    submitCheck: () => {
      setChecked(true);
      recorder.record('lesson-check-submitted');
    },
    explanations,
    pending,
    aiError,
    explain,
    cancel,
    loadLesson: () => {
      replaceDocument(makeDocument(LESSON_TITLE, 'lesson', LESSON_TEXT));
    },
    loadText: (title: string, origin: 'pasted' | 'file', text: string) => {
      replaceDocument(makeDocument(title, origin, text));
    },
  };
}

export type LearningControls = ReturnType<typeof useLearning>;
