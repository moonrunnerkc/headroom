import { FIELD_GROUPS, FIELD_SPECS, listItems, type BriefFields } from './brief';

export interface BriefExportMeta {
  readonly exportedAt: string;
  readonly complete: boolean;
  readonly sample: boolean;
}

export function briefToJson(fields: BriefFields, meta: BriefExportMeta): string {
  const document = {
    format: 'headroom-project-brief',
    formatVersion: 1,
    exportedAt: meta.exportedAt,
    status: meta.complete ? 'complete' : 'draft',
    sampleContent: meta.sample,
    title: fields.title,
    objective: fields.objective,
    audience: fields.audience,
    scope: fields.scope,
    constraints: fields.constraints,
    targetDate: fields.targetDate === '' ? null : fields.targetDate,
    budget:
      fields.budgetAmount.trim() === ''
        ? null
        : { amount: fields.budgetAmount.trim(), currency: fields.budgetCurrency.trim() },
    resources: listItems(fields.resources),
    deliverables: listItems(fields.deliverables),
    successCriteria: listItems(fields.successCriteria),
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

function section(label: string, body: string): string {
  return `## ${label}\n\n${body === '' ? '_Not provided._' : body}\n`;
}

export function briefToMarkdown(fields: BriefFields, meta: BriefExportMeta): string {
  const title = fields.title.trim() === '' ? 'Untitled project brief' : fields.title.trim();
  const lines = [
    `# ${title}`,
    '',
    `Status: ${meta.complete ? 'complete' : 'draft'}. Exported ${meta.exportedAt}.`,
    ...(meta.sample ? ['', 'This brief was created from Headroom sample content.'] : []),
    '',
  ];
  for (const group of FIELD_GROUPS) {
    for (const id of group.fields) {
      if (id === 'title' || id === 'budgetCurrency') continue;
      const spec = FIELD_SPECS[id];
      if (id === 'budgetAmount') {
        const amount = fields.budgetAmount.trim();
        lines.push(
          section('Budget', amount === '' ? '' : `${amount} ${fields.budgetCurrency.trim()}`),
        );
      } else if (spec.kind === 'list') {
        lines.push(
          section(
            spec.label,
            listItems(fields[id])
              .map((entry) => `- ${entry}`)
              .join('\n'),
          ),
        );
      } else {
        lines.push(section(spec.label, fields[id].trim()));
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
