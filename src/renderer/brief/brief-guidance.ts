/** Optional contextual tips, one per brief step. They wait in the shared queue and never block input. */
export const BRIEF_TIPS: Readonly<
  Record<string, { readonly title: string; readonly detail: string }>
> = {
  basics: {
    title: 'Objective tip:',
    detail:
      'State the outcome, not the activity. "Visitors reserve items unaided" is clearer than "redesign the kiosk".',
  },
  'audience-scope': {
    title: 'Scope tip:',
    detail: 'List at least one thing that is out of scope so reviewers know where the work stops.',
  },
  'constraints-timing': {
    title: 'Constraints tip:',
    detail:
      'Include fixed dependencies such as approvals, hardware, or data access that could delay the target date.',
  },
  'budget-resources': {
    title: 'Budget tip:',
    detail: 'Leave the amount blank if it is unknown; a blank optional field is valid.',
  },
  outcomes: {
    title: 'Success criteria tip:',
    detail:
      'Prefer criteria someone could check later, such as a task most testers complete without help.',
  },
};
