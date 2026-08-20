export const API = '/api';

export function getToken() {
  return localStorage.getItem('adminToken') || localStorage.getItem('superAdminToken');
}

// Sales workspace (role=sales) authenticates with the staff token; the admin panel uses the admin token.
export function getSalesToken() {
  return localStorage.getItem('adminToken') || localStorage.getItem('superAdminToken') || localStorage.getItem('employeeToken');
}

export function salesAuthHeaders() {
  const token = getSalesToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function setToken(token: string) {
  localStorage.setItem('adminToken', token);
  localStorage.setItem('superAdminToken', token);
}

export function clearToken() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('superAdminToken');
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type Tab = 'clients' | 'pages' | 'users' | 'analytics' | 'ecommerce' | 'employees';

export type Features = { users?: boolean; analytics?: boolean; ecommerce?: boolean };
export type UserRole = 'employee' | 'client' | 'sales' | 'none';
export type EmployeeProduct = 'asoldi' | 'ssu';
export type EmployeeRoleOption = 'none' | 'client' | 'sales' | 'employee-asoldi' | 'employee-ssu';

export type AdminUser = {
  id: string;
  username: string;
  createdAt: string;
  role: UserRole;
  employeeProduct?: EmployeeProduct;
};

export type ClientPaymentRequest = {
  userId: string;
  email: string;
  clientName: string;
  businessName: string;
  planName: string;
  paymentStatus: string;
  paymentMethod: string;
  requestedAt: string;
  updatedAt: string;
  invoiceRequest: {
    orgNumber: string;
    businessName: string;
    invoiceEmail: string;
    requestedAt: string;
  };
};

export function toEmployeeRoleOption(user: AdminUser): EmployeeRoleOption {
  if (user.role === 'client') return 'client';
  if (user.role === 'sales') return 'sales';
  if (user.role === 'employee') {
    return user.employeeProduct === 'ssu' ? 'employee-ssu' : 'employee-asoldi';
  }
  return 'none';
}

export function fromEmployeeRoleOption(option: EmployeeRoleOption): {
  role: UserRole;
  employeeProduct?: EmployeeProduct;
} {
  switch (option) {
    case 'client':
      return { role: 'client' };
    case 'sales':
      return { role: 'sales' };
    case 'employee-asoldi':
      return { role: 'employee', employeeProduct: 'asoldi' };
    case 'employee-ssu':
      return { role: 'employee', employeeProduct: 'ssu' };
    default:
      return { role: 'none' };
  }
}
export type Site = {
  id: string;
  site_key: string;
  domain: string;
  name: string;
  features: Features;
  createdAt: string;
};

export type ManageClientsView = 'clients' | 'sales';

export type SalesProgression = {
  step0AgreeMeetingTime: boolean;
  contractSigned: boolean;
  paymentReceived: boolean;
  domainConnected: boolean;
  live: boolean;
};

export type SalesReminders = {
  thankYouSentAt: string;
  reminder24hAt: string;
  reminder24hSentAt: string;
  reminder1hAt: string;
  reminder1hSentAt: string;
  skipDueToShortNotice: boolean;
};

export type SalesCalendarMeta = {
  eventId: string;
  htmlLink: string;
  meetLink: string;
  calendarId: string;
  accountKey: string;
  syncedAt: string;
};

export type SalesWebsiteImportMeta = {
  importedAt: string;
  publishedAt?: string;
  sourceRunId: string;
  sourceStep: string;
  sourceBaseUrl: string;
  siteFolder: string;
  importRoot: string;
  previewUrl: string;
  previewSlug?: string;
  publicUrl?: string;
  publicPreviewPublishedAt?: string;
};

export type SalesMakerRunMeta = {
  runId: string;
  dashboardUrl: string;
  previewUrl: string;
  latestReadyStep: string;
  latestStepStatus: string;
  intakeStatus?: string;
  exportPath: string;
  statusUpdatedAt: string;
  fieldsSyncedAt?: string;
  industry: string;
  createdAt: string;
};

export type SalesArchiveMeta = {
  archivedAt: string;
  reason: string;
};

export type SalesClientDetails = {
  instagramUrl: string;
  facebookUrl: string;
  proffUrl: string;
  otherLinks: string;
  googleBusinessProfile: string;
};

export type SalesMyphonerMeta = {
  leadId: string;
  leadIds: string[];
  listId: string;
  listName: string;
  leadResourceUrl: string;
  winnerCategory: string;
  winnerComment: string;
  lastWinnerWebhookAt: string;
  lastRecordingWebhookAt: string;
  latestEventAt: string;
  latestCallId: string;
  latestCallStartedAt: string;
  latestCallDurationSeconds: number;
  latestCallUserEmail: string;
  latestCallDestinationNumber: string;
  latestRecordingUrl: string;
  latestRecordingSyncReason: string;
};

export type SalesProduct = 'asoldi' | 'ssu';

export type SalesClient = {
  id: string;
  product: SalesProduct;
  businessName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  meetingPlace: string;
  industry: string;
  meetingMode: 'online' | 'in-person';
  meetingDurationMinutes: number;
  agreedTime: boolean;
  meetingAt: string;
  websiteDomain: string;
  notes: string;
  details: SalesClientDetails;
  myphoner: SalesMyphonerMeta;
  progression: SalesProgression;
  reminders: SalesReminders;
  calendar: SalesCalendarMeta;
  websiteImport: SalesWebsiteImportMeta;
  makerRun: SalesMakerRunMeta;
  hubSite?: {
    siteKey: string;
    domain: string;
    id: string;
    createdAt: string;
    liveUrl?: string;
  };
  status: 'active' | 'not-sold' | 'secondary';
  archive: SalesArchiveMeta;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_FEATURES: Features = { users: true, analytics: false, ecommerce: false };

export const SITE_PAGES = [
  { path: '/', label: 'Home' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/about', label: 'About' },
  { path: '/booking', label: 'Booking' },
  { path: '/clients', label: 'Clients' },
  { path: '/services/web-development', label: 'Web Development' },
  { path: '/services/social-media', label: 'Social Media Marketing' },
  { path: '/services/email-marketing', label: 'Email Marketing' },
  { path: '/services/photo-video', label: 'Photo & Video' },
  { path: '/1000kr', label: '1000kr' },
  { path: '/bli-ansatt', label: 'Bli ansatt' },
  { path: '/login', label: 'Login' },
  { path: '/ansatt', label: 'Ansatt' },
];

export type EmployeeChecklist = {
  contractSent: boolean;
  contractSigned: boolean;
  oneWeekMeeting: boolean;
  monthlyReview: boolean;
  systemAccessGranted: boolean;
  personalDetailsReceived: boolean;
};

export type EmployeeNote = {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
};

export type EmployeeStats = {
  totalCalls: number;
  meetingsBooked: number;
  hoursCalled: number;
  conversionRate: number;
  lastSyncDate: string;
};

export type EmployeePayment = {
  hourlyRate: number;
  commissionPerMeeting: number;
  totalOwed: number;
  lastPaymentDate: string;
  nextPayday: string;
  paymentMethod: 'bank' | 'other';
  bankAccount: string;
};

export type EmployeeWorker = {
  id: string;
  name: string;
  email: string;
  role: 'caller' | 'admin' | 'other';
  status: 'active' | 'inactive' | 'onboarding';
  startDate: string;
  avatarUrl?: string;
  contractUrl?: string;
  wordpressId?: number | null;
  wordpressCreatedAt?: string;
  checklist: EmployeeChecklist;
  myphonerStats: EmployeeStats;
  paymentInfo: EmployeePayment;
  notes: EmployeeNote[];
  createdAt: string;
  updatedAt: string;
};

export type EmployeeDashboardStats = {
  totalWorkers: number;
  activeWorkers: number;
  totalMeetingsThisMonth: number;
  totalHoursThisMonth: number;
  totalOwedThisMonth: number;
  daysUntilPayday: number;
  isOverdue: boolean;
  pendingOnboarding: number;
};
