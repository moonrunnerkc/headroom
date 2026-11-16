import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { FIELD_GROUPS } from '../../src/domain/brief';
import type { Layout } from '../../src/domain/presentation-controller';
import { createEvidenceRecorder } from '../../src/renderer/evidence-log';
import { BRIEF_STEPS, BriefWorkspace } from '../../src/renderer/brief/brief-workspace';
import { useBriefDraft } from '../../src/renderer/brief/use-brief-draft';
import { installFakeBridge } from './fake-bridge';

const recorder = createEvidenceRecorder(
  () => 0,
  () => new Date(0),
);
let setLayoutFromTest: (layout: Layout) => void = () => undefined;

function Harness() {
  const brief = useBriefDraft(recorder);
  const [layout, setLayout] = useState<Layout>('standard');
  const [step, setStep] = useState(BRIEF_STEPS[0] ?? 'basics');
  setLayoutFromTest = setLayout;
  return (
    <BriefWorkspace
      brief={brief}
      layout={layout}
      step={step}
      onStep={setStep}
      help={[]}
      onDismissHelp={() => undefined}
    />
  );
}

const visibleGroups = () =>
  FIELD_GROUPS.filter((group) => {
    const legend = screen.getByText(group.title, { selector: 'legend' });
    return !legend.closest('fieldset')?.hidden;
  }).map((group) => group.id);

beforeEach(() => {
  installFakeBridge();
});

describe('project brief layouts', () => {
  it('switching layouts preserves values, focus, cursor position, and the same input element', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const objective = screen.getByLabelText(/^Objective/);
    await user.type(screen.getByLabelText(/^Project title/), 'Kiosk refresh');
    await user.click(objective);
    await user.type(objective, 'Help visitors reserve items');
    if (!(objective instanceof HTMLTextAreaElement)) throw new Error('expected a textarea');
    objective.setSelectionRange(5, 5);

    act(() => {
      setLayoutFromTest('focused');
    });
    expect(screen.getByLabelText(/^Objective/)).toBe(objective);
    expect(document.activeElement).toBe(objective);
    expect(objective.selectionStart).toBe(5);
    expect(visibleGroups()).toEqual(['basics']);

    act(() => {
      setLayoutFromTest('standard');
    });
    expect(visibleGroups()).toEqual(FIELD_GROUPS.map((g) => g.id));
    expect(screen.getByLabelText(/^Project title/)).toHaveProperty('value', 'Kiosk refresh');
    expect(objective.value).toBe('Help visitors reserve items');
  });

  it('keeps every step reachable and validation errors visible in focused layout', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const title = screen.getByLabelText(/^Project title/);
    await user.click(title);
    await user.tab();
    act(() => {
      setLayoutFromTest('focused');
    });
    const steps = within(screen.getByRole('navigation', { name: 'Brief steps' })).getAllByRole(
      'button',
    );
    expect(steps).toHaveLength(BRIEF_STEPS.length);
    await user.click(screen.getByRole('button', { name: /^Next: Audience and scope/ }));
    expect(visibleGroups()).toEqual(['audience-scope']);
    const summary = screen.getByRole('alert');
    expect(within(summary).getByText(/Project title \(Basics\)/)).toBeTruthy();
  });

  it('associates help and errors with each control', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const title = screen.getByLabelText(/^Project title/);
    await user.click(title);
    await user.tab();
    expect(title.getAttribute('aria-invalid')).toBe('true');
    const described = (title.getAttribute('aria-describedby') ?? '').split(' ');
    const texts = described.map((id) => document.getElementById(id)?.textContent ?? '');
    expect(texts.some((t) => t.includes('short name'))).toBe(true);
    expect(texts.some((t) => t.includes('Enter project title'))).toBe(true);
  });

  it('keeps a draft that failed to save instead of replacing it with a new one', async () => {
    installFakeBridge({
      saveDraft: () => Promise.resolve({ status: 'error', message: 'The disk is full.' }),
    });
    const user = userEvent.setup();
    render(<Harness />);
    const title = screen.getByLabelText(/^Project title/);
    await user.type(title, 'Unsaved work');
    expect(
      await screen.findByText(/could not be saved: The disk is full/, {}, { timeout: 3_000 }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New blank brief' }));
    expect(await screen.findByText(/still open\. Retry saving or export it first/)).toBeTruthy();
    expect(screen.getByLabelText(/^Project title/)).toHaveProperty('value', 'Unsaved work');
  });
});
