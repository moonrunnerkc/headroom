import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Layout } from '../../src/domain/presentation-controller';
import { createEvidenceRecorder } from '../../src/renderer/evidence-log';
import { LESSON_TEXT } from '../../src/renderer/learning/http-caching-lesson';
import { LearningWorkspace } from '../../src/renderer/learning/learning-workspace';
import { useLearning, type LearningControls } from '../../src/renderer/learning/use-learning';
import { installFakeBridge } from './fake-bridge';

const recorder = createEvidenceRecorder(
  () => 0,
  () => new Date(0),
);
let setLayoutFromTest: (layout: Layout) => void = () => undefined;
let learningFromTest: LearningControls | null = null;

function Harness() {
  const learning = useLearning(recorder, () => undefined);
  const [layout, setLayout] = useState<Layout>('standard');
  setLayoutFromTest = setLayout;
  learningFromTest = learning;
  return (
    <LearningWorkspace
      learning={learning}
      layout={layout}
      models={{ status: 'unavailable', reason: 'Ollama is not running.' }}
      model={null}
      onModel={() => undefined}
      onRefreshModels={() => undefined}
      help={[]}
      onDismissHelp={() => undefined}
    />
  );
}

const renderedSource = () =>
  [...document.querySelectorAll('.source-text')].map((node) => node.textContent).join('');
const visibleBlocks = () =>
  [...document.querySelectorAll('article.source-block')].filter(
    (node) => !(node as HTMLElement).hidden,
  );

beforeEach(() => {
  installFakeBridge();
});

describe('learning layouts', () => {
  it('renders the complete lesson text exactly, in order, in both layouts', () => {
    render(<Harness />);
    expect(renderedSource()).toBe(LESSON_TEXT);
    act(() => {
      setLayoutFromTest('focused');
    });
    expect(renderedSource()).toBe(LESSON_TEXT);
    expect(visibleBlocks()).toHaveLength(1);
  });

  it('preserves notes, answers, and reading position across layout changes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const notes = screen.getAllByLabelText('Your note on this section');
    const secondNote = notes[1];
    if (secondNote === undefined) throw new Error('lesson should have several sections');
    await user.type(secondNote, 'max-age is in seconds');
    act(() => {
      setLayoutFromTest('focused');
    });
    expect(learningFromTest?.position).toBe('b002');
    expect(visibleBlocks()[0]?.querySelector('textarea')).toBe(secondNote);
    expect((secondNote as HTMLTextAreaElement).value).toBe('max-age is in seconds');
    await user.click(screen.getByRole('button', { name: /^Next: Section 3/ }));
    act(() => {
      setLayoutFromTest('standard');
    });
    expect(learningFromTest?.position).toBe('b003');
    expect((secondNote as HTMLTextAreaElement).value).toBe('max-age is in seconds');
  });

  it('keeps reading and notes available and explains why AI cannot run', () => {
    render(<Harness />);
    expect(screen.getByText(/Explanations are unavailable: Ollama is not running/)).toBeTruthy();
    for (const button of screen.getAllByRole('button', { name: 'Explain this section' })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getAllByLabelText('Your note on this section')[0]).toBeTruthy();
  });

  it('renders hostile imported text as inert characters', () => {
    const hostile =
      '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script>\n\n[link](javascript:alert(1))';
    render(<Harness />);
    act(() => {
      learningFromTest?.loadText('Pasted text', 'pasted', hostile);
    });
    expect(renderedSource()).toBe(hostile);
    expect(document.querySelector('.blocks img, .blocks script, .blocks a')).toBeNull();
    expect('pwned' in window).toBe(false);
  });
});
