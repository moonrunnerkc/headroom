import { describe, expect, it } from 'vitest';
import {
  EMPTY_BRIEF,
  FIELD_GROUPS,
  FIELD_SPECS,
  completedFieldCount,
  groupForField,
  validateBrief,
  type BriefFields,
} from '../../src/domain/brief';
import { briefToJson, briefToMarkdown } from '../../src/domain/brief-export';

const currencies = new Set(['USD', 'EUR', 'JPY']);
const today = '2026-11-15';
const valid: BriefFields = {
  ...EMPTY_BRIEF,
  title: 'Library kiosk refresh',
  objective: 'Replace the catalog kiosk interface.',
  audience: 'Library visitors',
  scope: 'Kiosk UI only; not the catalog backend.',
  deliverables: 'Prototype\n\nUsability report',
  successCriteria: 'Visitors find a title in under a minute',
};

describe('brief validation', () => {
  it('accepts a complete brief and reports required fields on a blank one', () => {
    expect(validateBrief(valid, today, currencies)).toEqual({});
    const errors = validateBrief(EMPTY_BRIEF, today, currencies);
    const required = Object.values(FIELD_SPECS)
      .filter((s) => s.required)
      .map((s) => s.id);
    expect(Object.keys(errors).sort()).toEqual([...required].sort());
  });

  it('validates real calendar dates not earlier than today', () => {
    expect(
      validateBrief({ ...valid, targetDate: '2026-02-30' }, today, currencies).targetDate,
    ).toMatch(/real date/);
    expect(
      validateBrief({ ...valid, targetDate: '2026-11-14' }, today, currencies).targetDate,
    ).toMatch(/later/);
    expect(
      validateBrief({ ...valid, targetDate: '2026-11-15' }, today, currencies).targetDate,
    ).toBeUndefined();
  });

  it('requires amount and currency together and validates both', () => {
    expect(
      validateBrief({ ...valid, budgetAmount: '100' }, today, currencies).budgetCurrency,
    ).toBeDefined();
    expect(
      validateBrief({ ...valid, budgetCurrency: 'USD' }, today, currencies).budgetAmount,
    ).toBeDefined();
    expect(
      validateBrief({ ...valid, budgetAmount: '1,000', budgetCurrency: 'USD' }, today, currencies)
        .budgetAmount,
    ).toBeDefined();
    expect(
      validateBrief({ ...valid, budgetAmount: '1000.5', budgetCurrency: 'XYZ' }, today, currencies)
        .budgetCurrency,
    ).toBeDefined();
    expect(
      validateBrief(
        { ...valid, budgetAmount: '1000.50', budgetCurrency: 'EUR' },
        today,
        currencies,
      ),
    ).toEqual({});
  });

  it('enforces length limits', () => {
    expect(validateBrief({ ...valid, title: 'x'.repeat(121) }, today, currencies).title).toMatch(
      /120/,
    );
  });

  it('places every field in exactly one group', () => {
    const grouped = FIELD_GROUPS.flatMap((g) => g.fields);
    expect([...grouped].sort()).toEqual(Object.keys(FIELD_SPECS).sort());
    expect(groupForField('budgetCurrency').id).toBe('budget-resources');
  });

  it('counts only filled, valid fields as complete', () => {
    expect(completedFieldCount(EMPTY_BRIEF, {})).toBe(0);
    expect(completedFieldCount(valid, validateBrief(valid, today, currencies))).toBe(6);
  });
});

describe('brief export', () => {
  const meta = { exportedAt: '2026-11-15T12:00:00.000Z', complete: true, sample: false };

  it('exports every value to JSON with list fields split and blank lines dropped', () => {
    const parsed: unknown = JSON.parse(briefToJson(valid, meta));
    expect(parsed).toMatchObject({
      format: 'headroom-project-brief',
      status: 'complete',
      title: valid.title,
      deliverables: ['Prototype', 'Usability report'],
      budget: null,
      targetDate: null,
    });
  });

  it('exports Markdown containing every provided value and marks sample content', () => {
    const markdown = briefToMarkdown(
      { ...valid, budgetAmount: '10', budgetCurrency: 'USD' },
      { ...meta, sample: true },
    );
    for (const value of [
      valid.title,
      valid.objective,
      valid.audience,
      valid.scope,
      '- Prototype',
      '10 USD',
    ]) {
      expect(markdown).toContain(value);
    }
    expect(markdown).toContain('sample content');
    expect(markdown).toContain('_Not provided._');
  });
});
