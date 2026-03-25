import React, { useEffect, useMemo, useState } from 'react';
import {
  Building,
  Calendar,
  CreditCard,
  DollarSign,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { EmployeeChecklistCard, EmployeeNotesCard, EmployeeStatCard } from '../components/EmployeeCards';
import { API, authHeaders, type EmployeeDashboardStats, type EmployeeWorker } from '../shared';

type EmployeeView = 'overview' | 'workers' | 'payments' | 'reports' | 'clients' | 'income';

type OverviewPayload = {
  stats: EmployeeDashboardStats;
  workers: EmployeeWorker[];
  workersNeedingAttention: EmployeeWorker[];
  topPerformers: EmployeeWorker[];
  syncState: {
    lastWordPressSync?: { at?: string; [key: string]: unknown } | null;
    lastMyPhonerSync?: { at?: string; [key: string]: unknown } | null;
    lastLucaSync?: { at?: string; [key: string]: unknown } | null;
  };
  integrations: {
    wordpress: { connected: boolean };
    luca: { connected: boolean; error?: string };
    myphoner: { connected: boolean; error?: string };
  };
};

type PaymentsPayload = {
  workers: EmployeeWorker[];
  stats: EmployeeDashboardStats;
  totalOwed: number;
};

type ReportsPayload = {
  stats: EmployeeDashboardStats;
  workers: EmployeeWorker[];
  topPerformers: EmployeeWorker[];
  averages: { calls: number; meetings: number; hours: number; conversion: number };
};

type CustomersPayload = {
  customers: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    organizationNumber?: string;
    totalRevenue: number;
    invoiceCount: number;
  }>;
};

type IncomePayload = {
  connected: boolean;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    totalAmount: number;
    paidAmount: number;
    createdAt: string;
  }>;
  summary: {
    totalRevenue: number;
    paidInvoices: number;
    unpaidInvoices: number;
    pendingAmount: number;
  } | null;
  error?: string;
};

const intervalOptions = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: '1 month' },
  { value: '3mth', label: '3 months' },
  { value: 'year', label: '1 year' },
  { value: 'thisyear', label: 'This year' },
];

export function EmployeesSection() {
  const [view, setView] = useState<EmployeeView>('overview');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<'wordpress' | 'myphoner' | 'luca' | null>(null);
  const [interval, setInterval] = useState('month');
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [workers, setWorkers] = useState<EmployeeWorker[]>([]);
  const [payments, setPayments] = useState<PaymentsPayload | null>(null);
  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [customers, setCustomers] = useState<CustomersPayload | null>(null);
  const [income, setIncome] = useState<IncomePayload | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<EmployeeWorker | null>(null);
  const [workerForm, setWorkerForm] = useState({ name: '', email: '', status: 'active', hourlyRate: '0', commissionPerMeeting: '0' });
  const [savingWorker, setSavingWorker] = useState(false);

  useEffect(() => {
    void loadView(view);
  }, [view]);

  async function request(path: string, init?: RequestInit) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        ...authHeaders(),
        'Content-Type': init?.body ? 'application/json' : (init?.headers as Record<string, string> | undefined)?.['Content-Type'],
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
    return data;
  }

  async function loadView(nextView: EmployeeView) {
    setLoading(true);
    setError('');
    try {
      if (nextView === 'overview') {
        const data = await request('/admin/employees/overview');
        setOverview(data);
        setWorkers(data.workers || []);
      } else if (nextView === 'workers') {
        const data = await request('/admin/employees/workers');
        setWorkers(data.workers || []);
      } else if (nextView === 'payments') {
        setPayments(await request('/admin/employees/payments'));
      } else if (nextView === 'reports') {
        setReports(await request('/admin/employees/reports'));
      } else if (nextView === 'clients') {
        setCustomers(await request('/admin/employees/clients'));
      } else if (nextView === 'income') {
        setIncome(await request('/admin/employees/income'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee data');
    } finally {
      setLoading(false);
    }
  }

  async function sync(type: 'wordpress' | 'myphoner' | 'luca') {
    setSyncing(type);
    setError('');
    try {
      const suffix = type === 'myphoner' ? `/admin/employees/sync/myphoner?interval=${interval}` : `/admin/employees/sync/${type}`;
      await request(suffix, { method: 'POST' });
      await Promise.all([
        loadView(view),
        view !== 'overview' ? loadView('overview') : Promise.resolve(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to sync ${type}`);
    } finally {
      setSyncing(null);
    }
  }

  async function refreshSelectedWorker(id: string) {
    const data = await request(`/admin/employees/workers/${id}`);
    setSelectedWorker(data.worker);
    setWorkers((prev) => prev.map((worker) => (worker.id === id ? data.worker : worker)));
  }

  async function saveWorker(e: React.FormEvent) {
    e.preventDefault();
    setSavingWorker(true);
    setError('');
    try {
      await request('/admin/employees/workers', {
        method: 'POST',
        body: JSON.stringify({
          name: workerForm.name,
          email: workerForm.email,
          status: workerForm.status,
          hourlyRate: Number(workerForm.hourlyRate || 0),
          commissionPerMeeting: Number(workerForm.commissionPerMeeting || 0),
        }),
      });
      setWorkerForm({ name: '', email: '', status: 'active', hourlyRate: '0', commissionPerMeeting: '0' });
      await loadView('workers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create worker');
    } finally {
      setSavingWorker(false);
    }
  }

  async function savePaymentInfo(workerId: string, paymentInfo: Partial<EmployeeWorker['paymentInfo']>) {
    await request(`/admin/employees/workers/${workerId}/payment`, {
      method: 'PATCH',
      body: JSON.stringify(paymentInfo),
    });
    await refreshSelectedWorker(workerId);
    if (view === 'payments') await loadView('payments');
  }

  const filteredWorkers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return workers;
    return workers.filter((worker) => worker.name.toLowerCase().includes(query) || worker.email.toLowerCase().includes(query));
  }, [search, workers]);

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Employees</h1>
          <p className="text-gray-400 text-sm">Integrated employee management from the old admin dashboard.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {intervalOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setInterval(option.value)}
              className={`px-3 py-2 rounded-lg text-sm ${interval === option.value ? 'bg-[#FF5B00] text-white' : 'bg-white/10 text-gray-300'}`}
            >
              {option.label}
            </button>
          ))}
          <SyncButton label="Sync WordPress" loading={syncing === 'wordpress'} onClick={() => sync('wordpress')} />
          <SyncButton label="Sync MyPhoner" loading={syncing === 'myphoner'} onClick={() => sync('myphoner')} />
          <SyncButton label="Sync Luca" loading={syncing === 'luca'} onClick={() => sync('luca')} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          ['overview', 'Overview'],
          ['workers', 'Workers'],
          ['payments', 'Payments'],
          ['reports', 'Reports'],
          ['clients', 'Clients'],
          ['income', 'Income'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key as EmployeeView)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${view === key ? 'bg-[#FF5B00] text-white' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 px-4 py-3">{error}</div>}

      {loading ? (
        <div className="min-h-[220px] flex items-center justify-center text-gray-400"><Loader2 className="animate-spin mr-2" size={18} /> Loading employee data…</div>
      ) : (
        <>
          {view === 'overview' && overview && <OverviewPanel data={overview} />}
          {view === 'workers' && (
            <WorkersPanel
              workers={filteredWorkers}
              search={search}
              setSearch={setSearch}
              workerForm={workerForm}
              setWorkerForm={setWorkerForm}
              savingWorker={savingWorker}
              onSubmit={saveWorker}
              onOpenWorker={setSelectedWorker}
            />
          )}
          {view === 'payments' && payments && <PaymentsPanel data={payments} onOpenWorker={setSelectedWorker} />}
          {view === 'reports' && reports && <ReportsPanel data={reports} />}
          {view === 'clients' && <ClientsPanel data={customers} />}
          {view === 'income' && <IncomePanel data={income} />}
        </>
      )}

      {selectedWorker && (
        <WorkerDrawer
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
          onChecklistSaved={(next) => setSelectedWorker({ ...selectedWorker, checklist: next })}
          onNotesSaved={(next) => setSelectedWorker({ ...selectedWorker, notes: next })}
          onPaymentSaved={savePaymentInfo}
          refreshWorker={refreshSelectedWorker}
        />
      )}
    </div>
  );
}

function SyncButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-50">
      {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
      {label}
    </button>
  );
}

function OverviewPanel({ data }: { data: OverviewPayload }) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <EmployeeStatCard title="Workers" value={data.stats.totalWorkers} />
        <EmployeeStatCard title="Active workers" value={data.stats.activeWorkers} />
        <EmployeeStatCard title="Meetings this month" value={data.stats.totalMeetingsThisMonth} />
        <EmployeeStatCard title="Total owed" value={`${data.stats.totalOwedThisMonth.toLocaleString()} kr`} subtitle={data.stats.isOverdue ? 'Overdue' : `${data.stats.daysUntilPayday} days until payday`} />
      </div>
      <div className="grid xl:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-6 xl:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4">Workers needing attention</h3>
          <div className="space-y-3">
            {data.workersNeedingAttention.length === 0 ? (
              <div className="text-gray-500 text-sm">Everyone looks up to date.</div>
            ) : data.workersNeedingAttention.map((worker) => (
              <div key={worker.id} className="rounded-xl bg-black/20 border border-white/10 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-medium">{worker.name}</div>
                  <div className="text-xs text-gray-500">{worker.email}</div>
                </div>
                <div className="text-xs text-gray-400">{Object.values(worker.checklist).filter((value) => !value).length} pending</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Integrations</h3>
          <div className="space-y-3 text-sm">
            <IntegrationStatus name="WordPress" connected={data.integrations.wordpress.connected} />
            <IntegrationStatus name="MyPhoner" connected={data.integrations.myphoner.connected} message={data.integrations.myphoner.error} />
            <IntegrationStatus name="Luca" connected={data.integrations.luca.connected} message={data.integrations.luca.error} />
          </div>
          <div className="border-t border-white/10 mt-5 pt-4 text-xs text-gray-500 space-y-2">
            <div>WordPress sync: {formatSyncState(data.syncState.lastWordPressSync)}</div>
            <div>MyPhoner sync: {formatSyncState(data.syncState.lastMyPhonerSync)}</div>
            <div>Luca sync: {formatSyncState(data.syncState.lastLucaSync)}</div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Top performers</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {data.topPerformers.map((worker, index) => (
            <div key={worker.id} className="rounded-xl bg-black/20 border border-white/10 p-4">
              <div className="text-xs text-gray-500 mb-1">#{index + 1}</div>
              <div className="text-white font-medium">{worker.name}</div>
              <div className="text-gray-400 text-sm mt-2">{worker.myphonerStats.meetingsBooked} meetings</div>
              <div className="text-gray-500 text-xs">{worker.myphonerStats.conversionRate}% conversion</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkersPanel({
  workers,
  search,
  setSearch,
  workerForm,
  setWorkerForm,
  savingWorker,
  onSubmit,
  onOpenWorker,
}: {
  workers: EmployeeWorker[];
  search: string;
  setSearch: (value: string) => void;
  workerForm: { name: string; email: string; status: string; hourlyRate: string; commissionPerMeeting: string };
  setWorkerForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; status: string; hourlyRate: string; commissionPerMeeting: string }>>;
  savingWorker: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onOpenWorker: (worker: EmployeeWorker) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-6">
        <form onSubmit={onSubmit} className="grid md:grid-cols-5 gap-3">
          <input value={workerForm.name} onChange={(e) => setWorkerForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" className="px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 text-white" />
          <input value={workerForm.email} onChange={(e) => setWorkerForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className="px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 text-white" />
          <input value={workerForm.hourlyRate} onChange={(e) => setWorkerForm((prev) => ({ ...prev, hourlyRate: e.target.value }))} placeholder="Hourly rate" className="px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 text-white" />
          <input value={workerForm.commissionPerMeeting} onChange={(e) => setWorkerForm((prev) => ({ ...prev, commissionPerMeeting: e.target.value }))} placeholder="Commission/meeting" className="px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 text-white" />
          <button type="submit" disabled={savingWorker} className="px-4 py-3 rounded-lg bg-[#FF5B00] text-white disabled:opacity-50">
            {savingWorker ? 'Saving…' : 'Add worker'}
          </button>
        </form>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workers..." className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#2a2a2a] border border-white/10 text-white" />
      </div>
      <div className="grid xl:grid-cols-2 gap-4">
        {workers.map((worker) => (
          <button
            key={worker.id}
            type="button"
            onClick={() => onOpenWorker(worker)}
            className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-5 text-left hover:border-[#FF5B00]/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white font-medium">{worker.name}</div>
                <div className="text-sm text-gray-400">{worker.email}</div>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${worker.status === 'active' ? 'bg-green-900/40 text-green-300' : worker.status === 'onboarding' ? 'bg-amber-900/40 text-amber-300' : 'bg-white/10 text-gray-400'}`}>
                {worker.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5 text-sm">
              <div><div className="text-gray-500">Meetings</div><div className="text-white">{worker.myphonerStats.meetingsBooked}</div></div>
              <div><div className="text-gray-500">Owed</div><div className="text-white">{worker.paymentInfo.totalOwed.toLocaleString()} kr</div></div>
              <div><div className="text-gray-500">Checklist</div><div className="text-white">{Object.values(worker.checklist).filter(Boolean).length}/6</div></div>
            </div>
          </button>
        ))}
      </div>
      {workers.length === 0 && <div className="text-gray-500 text-sm">No workers found yet.</div>}
    </div>
  );
}

function PaymentsPanel({ data, onOpenWorker }: { data: PaymentsPayload; onOpenWorker: (worker: EmployeeWorker) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <EmployeeStatCard title="Total owed" value={`${data.totalOwed.toLocaleString()} kr`} />
        <EmployeeStatCard title="Workers to pay" value={data.workers.filter((worker) => worker.paymentInfo.totalOwed > 0).length} />
        <EmployeeStatCard title="Next payday" value="1st" subtitle={data.stats.isOverdue ? 'Overdue' : `${data.stats.daysUntilPayday} days remaining`} />
      </div>
      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-gray-400 font-medium">Worker</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Hourly</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Commission</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Owed</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.workers.map((worker) => (
              <tr key={worker.id} className="border-b border-white/5 cursor-pointer hover:bg-white/5" onClick={() => onOpenWorker(worker)}>
                <td className="px-4 py-3 text-white">{worker.name}</td>
                <td className="px-4 py-3 text-gray-300">{worker.paymentInfo.hourlyRate} kr</td>
                <td className="px-4 py-3 text-gray-300">{worker.paymentInfo.commissionPerMeeting} kr</td>
                <td className="px-4 py-3 text-white">{worker.paymentInfo.totalOwed.toLocaleString()} kr</td>
                <td className="px-4 py-3 text-gray-400">{worker.paymentInfo.lastPaymentDate || 'Not paid yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsPanel({ data }: { data: ReportsPayload }) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <EmployeeStatCard title="Avg calls" value={data.averages.calls} />
        <EmployeeStatCard title="Avg meetings" value={data.averages.meetings} />
        <EmployeeStatCard title="Avg hours" value={data.averages.hours} />
        <EmployeeStatCard title="Avg conversion" value={`${data.averages.conversion}%`} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top performers</h3>
          <div className="space-y-3">
            {data.topPerformers.map((worker, index) => (
              <div key={worker.id} className="rounded-xl bg-black/20 border border-white/10 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">#{index + 1} {worker.name}</div>
                  <div className="text-xs text-gray-500">{worker.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-white">{worker.myphonerStats.meetingsBooked} meetings</div>
                  <div className="text-xs text-gray-500">{worker.myphonerStats.conversionRate}% conversion</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Worker comparison</h3>
          <div className="space-y-4">
            {data.workers.filter((worker) => worker.status === 'active').map((worker) => {
              const maxMeetings = Math.max(...data.workers.map((entry) => entry.myphonerStats.meetingsBooked || 0), 1);
              const width = (worker.myphonerStats.meetingsBooked / maxMeetings) * 100;
              return (
                <div key={worker.id}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-white">{worker.name}</span>
                    <span className="text-gray-400">{worker.myphonerStats.meetingsBooked}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden">
                    <div className="h-full bg-[#FF5B00]" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientsPanel({ data }: { data: CustomersPayload | null }) {
  if (!data) return <div className="text-gray-500">No client revenue data loaded yet.</div>;
  const totalRevenue = data.customers.reduce((sum, customer) => sum + customer.totalRevenue, 0);
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <EmployeeStatCard title="Clients" value={data.customers.length} />
        <EmployeeStatCard title="Revenue" value={`${Math.round(totalRevenue).toLocaleString()} kr`} />
        <EmployeeStatCard title="Invoices" value={data.customers.reduce((sum, customer) => sum + customer.invoiceCount, 0)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {data.customers.map((customer) => (
          <div key={customer.id} className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-5">
            <div className="text-white font-medium">{customer.name}</div>
            <div className="text-sm text-gray-400 mt-1">{customer.organizationNumber || 'No org number'}</div>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div><div className="text-gray-500">Revenue</div><div className="text-white">{Math.round(customer.totalRevenue).toLocaleString()} kr</div></div>
              <div><div className="text-gray-500">Invoices</div><div className="text-white">{customer.invoiceCount}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomePanel({ data }: { data: IncomePayload | null }) {
  if (!data) return <div className="text-gray-500">No income data loaded yet.</div>;
  return (
    <div className="space-y-6">
      {data.error && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 px-4 py-3">{data.error}</div>}
      {data.summary && (
        <div className="grid md:grid-cols-4 gap-4">
          <EmployeeStatCard title="Revenue" value={`${Math.round(data.summary.totalRevenue).toLocaleString()} kr`} />
          <EmployeeStatCard title="Paid invoices" value={data.summary.paidInvoices} />
          <EmployeeStatCard title="Unpaid invoices" value={data.summary.unpaidInvoices} />
          <EmployeeStatCard title="Pending amount" value={`${Math.round(data.summary.pendingAmount).toLocaleString()} kr`} />
        </div>
      )}
      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-gray-400 font-medium">Invoice</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Customer</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Amount</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Paid</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-white/5">
                <td className="px-4 py-3 text-white">{invoice.invoiceNumber}</td>
                <td className="px-4 py-3 text-gray-300">{invoice.customerName}</td>
                <td className="px-4 py-3 text-white">{Math.round(invoice.totalAmount).toLocaleString()} kr</td>
                <td className="px-4 py-3 text-gray-300">{Math.round(invoice.paidAmount).toLocaleString()} kr</td>
                <td className="px-4 py-3 text-gray-400">{invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('nb-NO') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkerDrawer({
  worker,
  onClose,
  onChecklistSaved,
  onNotesSaved,
  onPaymentSaved,
  refreshWorker,
}: {
  worker: EmployeeWorker;
  onClose: () => void;
  onChecklistSaved: (next: EmployeeWorker['checklist']) => void;
  onNotesSaved: (next: EmployeeWorker['notes']) => void;
  onPaymentSaved: (workerId: string, paymentInfo: Partial<EmployeeWorker['paymentInfo']>) => Promise<void>;
  refreshWorker: (id: string) => Promise<void>;
}) {
  const [hourlyRate, setHourlyRate] = useState(String(worker.paymentInfo.hourlyRate));
  const [commission, setCommission] = useState(String(worker.paymentInfo.commissionPerMeeting));
  const [savingPayment, setSavingPayment] = useState(false);

  async function savePayment() {
    setSavingPayment(true);
    try {
      await onPaymentSaved(worker.id, {
        hourlyRate: Number(hourlyRate || 0),
        commissionPerMeeting: Number(commission || 0),
      });
      await refreshWorker(worker.id);
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex justify-end">
      <div className="w-full max-w-2xl h-full overflow-y-auto bg-[#1f1f1f] border-l border-white/10 p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">{worker.name}</h2>
            <p className="text-gray-400">{worker.email}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg bg-white/10 text-gray-300 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <EmployeeStatCard title="Meetings" value={worker.myphonerStats.meetingsBooked} />
          <EmployeeStatCard title="Conversion" value={`${worker.myphonerStats.conversionRate}%`} />
          <EmployeeStatCard title="Total owed" value={`${worker.paymentInfo.totalOwed.toLocaleString()} kr`} />
        </div>

        <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Payment settings</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="Hourly rate" className="px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 text-white" />
            <input value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="Commission / meeting" className="px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 text-white" />
          </div>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={savePayment} disabled={savingPayment} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white disabled:opacity-50">
              {savingPayment ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <EmployeeChecklistCard workerId={worker.id} checklist={worker.checklist} onSaved={onChecklistSaved} />
          <EmployeeNotesCard workerId={worker.id} notes={worker.notes} onSaved={onNotesSaved} />
        </div>
      </div>
    </div>
  );
}

function IntegrationStatus({ name, connected, message }: { name: string; connected: boolean; message?: string }) {
  return (
    <div className="rounded-lg bg-black/20 border border-white/10 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-white">{name}</span>
        <span className={connected ? 'text-green-300' : 'text-amber-300'}>{connected ? 'Connected' : 'Not connected'}</span>
      </div>
      {!connected && message && <div className="text-xs text-gray-500 mt-1">{message}</div>}
    </div>
  );
}

function formatSyncState(value: { at?: string } | null | undefined) {
  if (!value?.at) return 'Never';
  return new Date(value.at).toLocaleString();
}
