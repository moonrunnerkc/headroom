import { useEffect } from 'react';
import { REVIEW_STEP } from '../../domain/brief';
import type { WorkspaceId } from '../../domain/request-queue';
import { BRIEF_TIPS } from '../brief/brief-guidance';
import type { BriefDraftControls } from '../brief/use-brief-draft';
import { CHECK_TARGET, type LearningControls } from '../learning/use-learning';
import type { QueueControls } from './use-queue';

export function briefContextVersion(brief: BriefDraftControls): string {
  // Completing a brief changes its context, discarding its unsolicited items instead of releasing them.
  return brief.draft.complete ? `${brief.draft.id}:complete` : brief.draft.id;
}

/**
 * Feed real optional requests from both workspaces into the one shared queue,
 * and drop items whose task context has changed.
 */
export function useWorkspaceRequests(
  queue: QueueControls,
  workspace: WorkspaceId,
  brief: BriefDraftControls,
  briefStep: string,
  learning: LearningControls,
): void {
  const { add, setContext, consumeExplanation } = queue;
  const briefContext = briefContextVersion(brief);
  const errorCount = Object.keys(brief.errors).length;
  const learningDocument = learning.document;

  useEffect(() => {
    setContext('brief', briefContext);
  }, [setContext, briefContext]);

  useEffect(() => {
    setContext('learning', learningDocument.id);
  }, [setContext, learningDocument.id]);

  useEffect(() => {
    const tip = BRIEF_TIPS[briefStep];
    if (tip === undefined || brief.draft.complete) return;
    add({
      workspace: 'brief',
      contextVersion: briefContext,
      kind: 'contextual-help',
      origin: 'unsolicited',
      dedupeKey: `brief-tip:${briefContext}:${briefStep}`,
      title: tip.title,
      detail: tip.detail,
      target: briefStep,
    });
  }, [add, briefContext, briefStep, brief.draft.complete]);

  useEffect(() => {
    if (errorCount > 0 || brief.draft.complete || briefStep === REVIEW_STEP) return;
    add({
      workspace: 'brief',
      contextVersion: briefContext,
      kind: 'suggestion',
      origin: 'unsolicited',
      dedupeKey: `brief-review:${briefContext}`,
      title: 'Ready for review.',
      detail:
        'Every required field is valid. Review the summary and mark the brief complete when you are ready.',
      target: REVIEW_STEP,
    });
  }, [add, briefContext, errorCount, brief.draft.complete, briefStep]);

  useEffect(() => {
    if (workspace === 'learning') consumeExplanation(learning.position);
  }, [consumeExplanation, workspace, learning.position, learning.explanations]);

  const lastBlock = learningDocument.blocks.at(-1)?.id;
  useEffect(() => {
    if (
      learningDocument.origin !== 'lesson' ||
      learning.position !== lastBlock ||
      workspace !== 'learning'
    )
      return;
    add({
      workspace: 'learning',
      contextVersion: learningDocument.id,
      kind: 'suggestion',
      origin: 'unsolicited',
      dedupeKey: `lesson-check:${learningDocument.id}`,
      title: 'Comprehension check available.',
      detail: 'Four practice questions about the lesson are ready when you are.',
      target: CHECK_TARGET,
    });
  }, [add, learningDocument, learning.position, lastBlock, workspace]);
}
