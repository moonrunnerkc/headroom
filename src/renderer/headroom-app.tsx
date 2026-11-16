import { useCallback, useEffect, useRef, useState } from 'react';
import { inlineHelp, type QueueItem, type WorkspaceId } from '../domain/request-queue';
import type { ModelList } from '../shared/ai-types';
import type { Preferences } from '../shared/draft-schema';
import type { SensingEvent } from '../shared/sensing-types';
import { bridge } from './bridge';
import { BRIEF_STEPS, BriefWorkspace } from './brief/brief-workspace';
import { useBriefDraft } from './brief/use-brief-draft';
import { createEvidenceRecorder } from './evidence-log';
import { LearningWorkspace } from './learning/learning-workspace';
import { useLearning } from './learning/use-learning';
import { SensingPanel } from './sensing/sensing-panel';
import { captureActive, useSensing } from './sensing/use-sensing';
import { AdaptationBanner } from './shell/adaptation-banner';
import { EvidencePanel } from './shell/evidence-panel';
import { QueuePanel } from './shell/queue-panel';
import { StatusStrip, type Panel } from './shell/status-strip';
import { usePresentation } from './shell/use-presentation';
import { useRequestQueue } from './shell/use-queue';
import { useSafeBoundary } from './shell/use-safe-boundary';
import { briefContextVersion, useWorkspaceRequests } from './shell/use-workspace-requests';

export function HeadroomApp({ preferences }: { readonly preferences: Preferences }) {
  const [recorder] = useState(() =>
    createEvidenceRecorder(
      () => performance.now(),
      () => new Date(),
    ),
  );
  const { presentation, dispatch } = usePresentation(
    preferences.layout,
    preferences.mode,
    recorder,
  );
  const queue = useRequestQueue(recorder);
  const [workspace, setWorkspace] = useState<WorkspaceId>('brief');
  const [briefStep, setBriefStep] = useState<string>(BRIEF_STEPS[0] ?? 'basics');
  const [panel, setPanel] = useState<Panel>(null);
  const [consent, setConsent] = useState(false);
  const [models, setModels] = useState<ModelList | null>(null);
  const [model, setModel] = useState<string | null>(preferences.aiModel);
  const [prefsProblem, setPrefsProblem] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState('unknown');
  const contentRef = useRef<HTMLElement>(null);
  const brief = useBriefDraft(recorder);

  const where = useRef({ workspace, position: '' });
  const onExplanationReady = useCallback(
    (blockId: string, documentId: string) => {
      if (where.current.workspace === 'learning' && where.current.position === blockId) return;
      queue.add({
        workspace: 'learning',
        contextVersion: documentId,
        kind: 'explanation-ready',
        origin: 'user-requested',
        dedupeKey: `explanation:${documentId}:${blockId}`,
        title: 'Explanation ready.',
        detail: `The explanation you requested for Section ${String(Number(blockId.slice(1)))} is ready.`,
        target: blockId,
      });
    },
    [queue],
  );
  const learning = useLearning(recorder, onExplanationReady);
  useEffect(() => {
    where.current = { workspace, position: learning.position };
  }, [workspace, learning.position]);
  useWorkspaceRequests(queue, workspace, brief, briefStep, learning);

  const onSensingEvent = useCallback(
    (event: SensingEvent) => {
      switch (event.kind) {
        case 'trigger':
          dispatch({ type: 'sensor-trigger', triggerId: event.triggerId, atMs: performance.now() });
          break;
        case 'quality':
          recorder.record('signal-quality', event.quality);
          dispatch({ type: 'signal-usable', usable: event.quality === 'usable' });
          break;
        case 'baseline':
          recorder.record('baseline', event.status);
          break;
        case 'session-ended':
          recorder.record('sensing-ended', event.reason.replace(/[^a-z0-9-]/g, '-').slice(0, 48));
          dispatch({ type: 'sensing-ended' });
          break;
      }
    },
    [dispatch, recorder],
  );
  const sensing = useSensing(onSensingEvent);

  const refreshModels = useCallback(() => {
    void bridge().listModels().then(setModels);
  }, []);
  useEffect(refreshModels, [refreshModels]);
  useEffect(() => {
    void bridge()
      .appInfo()
      .then((info) => {
        setAppVersion(info.appVersion);
      });
  }, []);

  const layout = presentation.layout;
  const persistedMode = presentation.mode === 'automatic' ? 'suggest' : presentation.mode;
  useEffect(() => {
    void bridge()
      .savePreferences({ formatVersion: 1, layout, mode: persistedMode, aiModel: model })
      .then((result) => {
        setPrefsProblem(result.status === 'error' ? result.message : null);
      });
  }, [layout, persistedMode, model]);

  useSafeBoundary(presentation.pending?.kind === 'awaiting-safe-boundary', contentRef, () => {
    dispatch({ type: 'safe-boundary' });
  });

  const stopSensing = () => void bridge().stopSensing();
  const changeConsent = (next: boolean) => {
    setConsent(next);
    if (!next && captureActive(sensing)) stopSensing();
  };
  const chooseWorkspace = (next: WorkspaceId) => {
    if (next !== workspace) recorder.record('workspace-changed', next);
    setWorkspace(next);
  };
  const openItem = (item: QueueItem) => {
    chooseWorkspace(item.workspace);
    if (item.workspace === 'brief') setBriefStep(item.target);
    else learning.setPosition(item.target);
    queue.remove(item.id, 'opened');
    setPanel(null);
  };
  const dismissItem = (id: string) => {
    queue.remove(id, 'dismissed');
  };
  const briefHelp = inlineHelp(queue.queue, layout, {
    workspace: 'brief',
    contextVersion: briefContextVersion(brief),
    target: briefStep,
  });
  const learningHelp = inlineHelp(queue.queue, layout, {
    workspace: 'learning',
    contextVersion: learning.document.id,
    target: learning.position,
  });

  return (
    <div className="app" data-layout={layout}>
      <StatusStrip
        workspace={workspace}
        onWorkspace={chooseWorkspace}
        presentation={presentation}
        onLayout={(next) => {
          dispatch({ type: 'choose-layout', layout: next });
        }}
        onMode={(mode) => {
          dispatch({ type: 'set-mode', mode });
        }}
        sensing={sensing}
        onStopSensing={stopSensing}
        queueCount={queue.queue.length}
        panel={panel}
        onPanel={setPanel}
      />
      <AdaptationBanner presentation={presentation} dispatch={dispatch} />
      {prefsProblem !== null && (
        <p className="alert" role="alert">
          Preferences could not be saved: {prefsProblem}
        </p>
      )}
      <div className="body">
        <main ref={contentRef} id="workspace" tabIndex={-1}>
          <div hidden={workspace !== 'brief'}>
            <BriefWorkspace
              brief={brief}
              layout={layout}
              step={briefStep}
              onStep={setBriefStep}
              help={briefHelp}
              onDismissHelp={dismissItem}
            />
          </div>
          <div hidden={workspace !== 'learning'}>
            <LearningWorkspace
              learning={learning}
              layout={layout}
              models={models}
              model={model}
              onModel={(next) => {
                setModel(next === '' ? null : next);
              }}
              onRefreshModels={refreshModels}
              help={learningHelp}
              onDismissHelp={dismissItem}
            />
          </div>
        </main>
        {panel !== null && (
          <aside className="side-panel" aria-label="Panel">
            {panel === 'sensing' && (
              <SensingPanel
                snapshot={sensing}
                consent={consent}
                onConsent={changeConsent}
                presentation={presentation}
                dispatch={dispatch}
              />
            )}
            {panel === 'queue' && (
              <QueuePanel queue={queue.queue} onOpen={openItem} onDismiss={dismissItem} />
            )}
            {panel === 'evidence' && (
              <EvidencePanel
                build={() =>
                  recorder.build({
                    appVersion,
                    sensingPackets: sensing?.packetCount ?? 0,
                    sensingMedianIntervalMs: sensing?.medianIntervalMs ?? null,
                  })
                }
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
