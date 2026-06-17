import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { ClientRouteGuard } from '../../components/client/ClientRouteGuard';
import { ClientPortalLayout } from '../../components/client/ClientPortalLayout';
import { useClientAuth } from '../../contexts/ClientAuthContext';

type DashboardResponse = {
  profile: any;
  dashboard: {
    todoList: Array<{ id: string; title: string; description: string; actionLabel: string; route: string }>;
    marketingElements: Array<{ key: string; label: string; status: string; health: string[]; createdAt: string }>;
    performance: {
      uniqueViews: number;
      bounceRate: number;
      bounceDeltaPct: number;
      purchases: number;
      clicks: number;
      monthLabel: string;
    };
    greetingName: string;
  };
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '—';
  return date.toLocaleDateString('nb-NO');
}

export const ClientHome = () => {
  const navigate = useNavigate();
  const { token } = useClientAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/client/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Kunne ikke laste dashboard.');
        setData(payload as DashboardResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kunne ikke laste dashboard.');
      } finally {
        setLoading(false);
      }
    }
    if (token) void load();
  }, [token]);

  const performance = useMemo(() => data?.dashboard?.performance, [data]);
  const element = data?.dashboard?.marketingElements?.[0];
  const todos = data?.dashboard?.todoList || [];

  return (
    <ClientRouteGuard>
      <Helmet>
        <title>Kundeportal – Hjem</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <ClientPortalLayout>
        {loading ? (
          <div className="min-h-[280px] flex items-center justify-center text-[#6B7280]">
            <Loader2 className="animate-spin mr-2" size={18} /> Laster dashboard…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-600 text-sm">{error}</div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-6">
              <h2 className="text-3xl font-semibold text-[#111827]">Velkommen til Asoldi, {data?.dashboard?.greetingName || 'kunde'}!</h2>
              <p className="mt-2 text-sm text-[#6B7280]">Her ser du neste steg i leveransen din.</p>
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-[#111827]">Din to-do liste</h3>
                <div className="mt-4 space-y-3">
                  {todos.map((todo) => (
                    <div key={todo.id} className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-[#111827]">{todo.title}</p>
                        <p className="text-xs text-[#6B7280] mt-1">{todo.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(todo.route)}
                        className="rounded-lg bg-[#FF5B00] px-4 py-2 text-sm text-white hover:bg-[#E55200]"
                      >
                        {todo.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
              <h3 className="text-xl font-semibold text-[#111827]">Dine markedsføringselementer</h3>
              <div className="mt-5 rounded-2xl border border-[#E5E7EB] bg-[#FCFCFD] p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#FFD6C2] bg-[#FFF7F2] px-4 py-2 text-sm text-[#FF5B00]">
                    {element?.label || 'Nettside'}
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/kunde/tjenester/nettside/planer')}
                    className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm text-[#111827] hover:bg-[#F9FAFB]"
                  >
                    Flere detaljer
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">Asoldi.com</p>
                      <p className="text-xs text-[#6B7280]">Opprettet: {formatDate(element?.createdAt || '')}</p>
                    </div>
                    <div className="inline-flex items-center gap-2 text-xs text-[#374151]">
                      <span className="h-2.5 w-2.5 rounded-sm bg-black" />
                      Nivå 1
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(element?.health || []).map((badge) => (
                      <span key={badge} className="rounded-full border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-1 text-xs text-[#374151]">
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#111827]">Ytelse</h4>
                    <span className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-2 py-1 text-xs text-[#4B5563]">{performance?.monthLabel || '1 mnd'}</span>
                  </div>
                  <div className="mt-3 grid md:grid-cols-4 gap-3">
                    <PerformanceCard title="Unike visninger" value={String(performance?.uniqueViews ?? 0)} />
                    <PerformanceCard title="Avvisningsrate" value={`${performance?.bounceRate ?? 0}%`} hint={`+${performance?.bounceDeltaPct ?? 0}%`} />
                    <PerformanceCard title="Kjøp" value={String(performance?.purchases ?? 0)} />
                    <PerformanceCard title="Klikk" value={String(performance?.clicks ?? 0)} />
                  </div>
                </div>
              </div>
            </section>

            <button
              type="button"
              onClick={() => navigate('/kunde/tjenester/nettside/start')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#FFD6C2] bg-[#FFF7F2] px-4 py-2 text-sm text-[#FF5B00]"
            >
              Gå til nettsidebygger
              <ExternalLink size={14} />
            </button>
          </div>
        )}
      </ClientPortalLayout>
    </ClientRouteGuard>
  );
};

function PerformanceCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#FCFCFD] p-3">
      <p className="text-xs text-[#6B7280]">{title}</p>
      <p className="mt-1 text-xl font-semibold text-[#111827]">{value}</p>
      {hint ? <p className="text-xs text-emerald-600 mt-1">{hint}</p> : null}
    </div>
  );
}
