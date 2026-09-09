import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import {
  API,
  developmentAuthHeaders,
  type DevelopmentItem,
} from '../shared';

const DEVELOPMENT_STEPS: { key: keyof DevelopmentItem['development']; label: string }[] = [
  { key: 'hostingerEnvironmentSetup', label: 'Hostinger environment sat opp' },
  { key: 'githubRepoPushed', label: 'GitHub repo pushed' },
  { key: 'v1Ferdig', label: 'V1 ferdig' },
  { key: 'nettsideFerdig', label: 'Nettside ferdig' },
];

type Props = {
  hideHeader?: boolean;
};

export function DevelopmentClientsSection({ hideHeader = false }: Props) {
  const [items, setItems] = useState<DevelopmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/admin/development`, {
        headers: developmentAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed loading development clients');
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed loading development clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function toggleStep(item: DevelopmentItem, key: keyof DevelopmentItem['development']) {
    setBusyKey(`${item.id}:${key}`);
    setError('');
    try {
      const response = await fetch(`${API}/admin/development/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { ...developmentAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: !item.development?.[key],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed updating development step');
      }
      if (Array.isArray(data.items)) {
        setItems(data.items);
      } else {
        await loadItems();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed updating development step');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div>
          <h2 className="text-lg font-semibold text-white">Development</h2>
          <p className="text-gray-400 text-sm">
            Signed contracts wait here until Hostinger, GitHub, V1, and the finished website are checked off.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="min-h-[160px] flex items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} /> Loading development clients…
        </div>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          No websites in development. Contract-signed Asoldi clients appear here automatically.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const contact = [item.contactPerson, item.meetingPlace, item.contactEmail, item.contactPhone]
              .filter(Boolean)
              .join(' · ');
            const publicPreview = item.websiteImport?.publicUrl || '';
            const makerDashboard = item.makerRun?.dashboardUrl || '';
            const makerPreview = item.makerRun?.previewUrl || '';
            return (
              <div key={item.id} className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-4 flex flex-col gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-white font-semibold truncate">{item.businessName}</h3>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[11px] bg-sky-900/30 border border-sky-700/30 text-sky-300">
                      Development
                    </span>
                  </div>
                  {contact && <p className="mt-1 text-xs text-gray-400 truncate">{contact}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    {item.websiteDomain || 'No domain yet'}
                    {item.siteKey ? ` · ${item.siteKey}` : ''}
                  </p>
                </div>

                {item.notes ? (
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{item.notes}</p>
                ) : null}

                <div className="flex flex-wrap gap-1.5">
                  {DEVELOPMENT_STEPS.map((step) => {
                    const done = Boolean(item.development?.[step.key]);
                    return (
                      <button
                        key={step.key}
                        type="button"
                        disabled={busyKey === `${item.id}:${step.key}`}
                        onClick={() => void toggleStep(item, step.key)}
                        className={`px-2 py-1 rounded-md text-[11px] border transition-colors hover:border-[#FF5B00]/40 disabled:opacity-60 ${
                          done
                            ? 'bg-green-900/40 border-green-600/40 text-green-300'
                            : 'bg-black/20 border-white/10 text-gray-400'
                        }`}
                      >
                        {done ? <CheckCircle2 size={11} className="inline mr-1" /> : null}
                        {step.label}
                      </button>
                    );
                  })}
                </div>

                {(publicPreview || makerDashboard || makerPreview) && (
                  <div className="flex flex-wrap gap-2">
                    {publicPreview && (
                      <a
                        href={publicPreview}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15"
                      >
                        <ExternalLink size={13} /> Public preview
                      </a>
                    )}
                    {makerDashboard && (
                      <a
                        href={makerDashboard}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15"
                      >
                        <ExternalLink size={13} /> Open in maker
                      </a>
                    )}
                    {makerPreview && (
                      <a
                        href={makerPreview}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15"
                      >
                        <ExternalLink size={13} /> Maker preview
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
