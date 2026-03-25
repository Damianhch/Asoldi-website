export const API = '/api';

export function getToken() {
  return localStorage.getItem('adminToken') || localStorage.getItem('superAdminToken');
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
export type UserRole = 'employee' | 'client' | 'none';

export type Site = {
  id: string;
  site_key: string;
  domain: string;
  name: string;
  features: Features;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  username: string;
  createdAt: string;
  role: UserRole;
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
