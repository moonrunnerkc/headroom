/**
 * Canonical project-brief data. Both layouts edit exactly these strings, so a
 * layout change can never alter values. List fields store one item per line.
 */
export interface BriefFields {
  readonly title: string;
  readonly objective: string;
  readonly audience: string;
  readonly scope: string;
  readonly constraints: string;
  readonly targetDate: string;
  readonly budgetAmount: string;
  readonly budgetCurrency: string;
  readonly resources: string;
  readonly deliverables: string;
  readonly successCriteria: string;
}

export type BriefFieldId = keyof BriefFields;

export interface FieldSpec {
  readonly id: BriefFieldId;
  readonly label: string;
  readonly help: string;
  readonly required: boolean;
  readonly kind: 'text' | 'long-text' | 'list' | 'date' | 'amount' | 'currency';
  readonly maxLength: number;
}

export const FIELD_SPECS: Readonly<Record<BriefFieldId, FieldSpec>> = {
  title: {
    id: 'title',
    label: 'Project title',
    help: 'A short name people will recognize.',
    required: true,
    kind: 'text',
    maxLength: 120,
  },
  objective: {
    id: 'objective',
    label: 'Objective',
    help: 'What the project should accomplish, in one or two sentences.',
    required: true,
    kind: 'long-text',
    maxLength: 2_000,
  },
  audience: {
    id: 'audience',
    label: 'Intended audience',
    help: 'Who will use or benefit from the result.',
    required: true,
    kind: 'long-text',
    maxLength: 1_000,
  },
  scope: {
    id: 'scope',
    label: 'Scope',
    help: 'What is included. Naming what is excluded prevents surprises.',
    required: true,
    kind: 'long-text',
    maxLength: 3_000,
  },
  constraints: {
    id: 'constraints',
    label: 'Constraints',
    help: 'Limits such as policies, technology, staffing, or dependencies.',
    required: false,
    kind: 'long-text',
    maxLength: 3_000,
  },
  targetDate: {
    id: 'targetDate',
    label: 'Target date',
    help: 'Optional. Use the date picker or YYYY-MM-DD.',
    required: false,
    kind: 'date',
    maxLength: 10,
  },
  budgetAmount: {
    id: 'budgetAmount',
    label: 'Budget amount',
    help: 'Optional. Digits with up to two decimal places, no separators.',
    required: false,
    kind: 'amount',
    maxLength: 16,
  },
  budgetCurrency: {
    id: 'budgetCurrency',
    label: 'Budget currency',
    help: 'Three-letter ISO 4217 code, required when an amount is given.',
    required: false,
    kind: 'currency',
    maxLength: 3,
  },
  resources: {
    id: 'resources',
    label: 'Required resources',
    help: 'One per line: people, tools, data, or access.',
    required: false,
    kind: 'list',
    maxLength: 3_000,
  },
  deliverables: {
    id: 'deliverables',
    label: 'Deliverables',
    help: 'One per line. At least one is required.',
    required: true,
    kind: 'list',
    maxLength: 3_000,
  },
  successCriteria: {
    id: 'successCriteria',
    label: 'Success criteria',
    help: 'One per line. How you will know the project worked.',
    required: true,
    kind: 'list',
    maxLength: 3_000,
  },
};

export interface FieldGroup {
  readonly id: string;
  readonly title: string;
  readonly instructions: string;
  readonly fields: readonly BriefFieldId[];
}

export const FIELD_GROUPS: readonly FieldGroup[] = [
  {
    id: 'basics',
    title: 'Basics',
    instructions: 'Name the project and state its objective.',
    fields: ['title', 'objective'],
  },
  {
    id: 'audience-scope',
    title: 'Audience and scope',
    instructions: 'Describe who it is for and what it covers.',
    fields: ['audience', 'scope'],
  },
  {
    id: 'constraints-timing',
    title: 'Constraints and timing',
    instructions: 'Record known limits and the target date.',
    fields: ['constraints', 'targetDate'],
  },
  {
    id: 'budget-resources',
    title: 'Budget and resources',
    instructions: 'Estimate the budget and list what the work needs.',
    fields: ['budgetAmount', 'budgetCurrency', 'resources'],
  },
  {
    id: 'outcomes',
    title: 'Deliverables and success',
    instructions: 'List what will be produced and how success is judged.',
    fields: ['deliverables', 'successCriteria'],
  },
];

export const REVIEW_STEP = 'review';

export const EMPTY_BRIEF: BriefFields = {
  title: '',
  objective: '',
  audience: '',
  scope: '',
  constraints: '',
  targetDate: '',
  budgetAmount: '',
  budgetCurrency: '',
  resources: '',
  deliverables: '',
  successCriteria: '',
};

export function listItems(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export type FieldErrors = Partial<Record<BriefFieldId, string>>;

const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Validate the whole brief. `today` (YYYY-MM-DD, local) is supplied so the
 * rule is deterministic; `currencies` is the runtime's ISO 4217 list.
 */
export function validateBrief(
  fields: BriefFields,
  today: string,
  currencies: ReadonlySet<string>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const spec of Object.values(FIELD_SPECS)) {
    const value = fields[spec.id];
    if (value.length > spec.maxLength)
      errors[spec.id] = `Use ${spec.maxLength} characters or fewer.`;
    else if (
      spec.required &&
      (spec.kind === 'list' ? listItems(value).length === 0 : value.trim() === '')
    ) {
      errors[spec.id] =
        spec.kind === 'list'
          ? `Add at least one item to ${spec.label.toLowerCase()}.`
          : `Enter ${spec.label.toLowerCase()}.`;
    }
  }
  if (fields.targetDate !== '' && errors.targetDate === undefined) {
    if (!isRealDate(fields.targetDate)) errors.targetDate = 'Enter a real date as YYYY-MM-DD.';
    else if (fields.targetDate < today) errors.targetDate = 'Choose today or a later date.';
  }
  const amount = fields.budgetAmount.trim();
  const currency = fields.budgetCurrency.trim();
  if (amount !== '' && errors.budgetAmount === undefined && !AMOUNT.test(amount)) {
    errors.budgetAmount =
      'Enter digits with up to two decimal places, for example 2500 or 2500.50.';
  }
  if (currency !== '' && !currencies.has(currency)) {
    errors.budgetCurrency = 'Enter a three-letter ISO 4217 code such as USD or EUR.';
  } else if (amount !== '' && currency === '') {
    errors.budgetCurrency = 'Enter the currency for this budget.';
  } else if (amount === '' && currency !== '') {
    errors.budgetAmount = 'Enter an amount for this currency, or clear the currency.';
  }
  return errors;
}

export function groupErrors(group: FieldGroup, errors: FieldErrors): BriefFieldId[] {
  return group.fields.filter((id) => errors[id] !== undefined);
}

export function groupForField(field: BriefFieldId): FieldGroup {
  const group = FIELD_GROUPS.find((candidate) => candidate.fields.includes(field));
  if (group === undefined) throw new Error(`field ${field} has no group`);
  return group;
}

export function completedFieldCount(fields: BriefFields, errors: FieldErrors): number {
  return Object.values(FIELD_SPECS).filter(
    (spec) => fields[spec.id].trim() !== '' && errors[spec.id] === undefined,
  ).length;
}
