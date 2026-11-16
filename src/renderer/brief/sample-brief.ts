import type { BriefFields } from '../../domain/brief';

/** Clearly labeled sample content for trying the form; it describes no real organization. */
export const SAMPLE_BRIEF: BriefFields = {
  title: 'Sample: Neighborhood library kiosk refresh',
  objective:
    'Make the library catalog kiosk easier to use so visitors can find and reserve an item without staff help.',
  audience: 'Adult and teen library visitors, including people using screen magnification.',
  scope:
    'In scope: kiosk search, results, and reservation screens.\nOut of scope: the catalog database and staff tools.',
  constraints:
    'Must run on the existing kiosk hardware. No visitor accounts may be created at the kiosk.',
  targetDate: '',
  budgetAmount: '12000',
  budgetCurrency: 'USD',
  resources: 'One designer for six weeks\nKiosk test unit\nTen volunteer testers',
  deliverables: 'Interactive prototype\nUsability test report\nImplementation guide',
  successCriteria:
    'Most test participants complete a reservation without help\nNo critical accessibility issues remain open',
};
