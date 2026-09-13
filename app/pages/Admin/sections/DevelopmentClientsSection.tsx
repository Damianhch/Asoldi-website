import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  API,
  developmentAuthHeaders,
  type DevelopmentItem,
} from '../shared';
import { MakerRunTools } from '../../developer/MakerRunTools';
import {
  LAN_MAKER_URL,
  LOCAL_MAKER_URL,
  openMakerTunnelPopup,
  tunnelPopupMakerOrigin,
  useWebsiteMakerBaseUrl,
} from '../../sales/websiteMaker';

const DEVELOPMENT_STEPS: { key: keyof DevelopmentItem['development']; label: string }[] = [
  { key: 'hostingerEnvironmentSetup', label: 'Hostinger environment sat opp' },
  { key: 'githubRepoPushed', label: 'GitHub repo pushed' },
  { key: 'v1Ferdig', label: 'V1 ferdig' },
  { key: 'nettsideFerdig', label: 'Nettside ferdig' },
];

type Props = {
  hideHeader?: boolean;
};

function DevelopmentCard({
  item,
  kind,
  busyKey,
  websiteMakerBaseUrl,
  setWebsiteMakerBaseUrl,
  onToggleStep,
  onReload,
  onError,
  onNotice,
}: {
  item: DevelopmentItem;
  kind: 'preview' | 'deployment';
  busyKey: string | null;
  websiteMakerBaseUrl: string;
  setWebsiteMakerBaseUrl: (value: string) => void;
  onToggleStep: (item: DevelopmentItem, key: keyof DevelopmentItem['development']) => void;
  onReload: () => Promise<void> | void;
  onError: (message: string) => void;
  onNotice?: (message: string) => void;
}) {
  const contact = [item.contactPerson, item.contactPhone, item.contactEmail]
    .filter(Boolean)
    .join(' · ');
  const salesClientId = String(item.salesClientId || '').trim();

  return (
    <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-4 flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-white font-semibold truncate">{item.businessName}</h3>
          <span
            className={`shrink-0 px-2 py-0.5 rounded text-[11px] border ${
              kind === 'preview'
                ? 'bg-amber-900/30 border-amber-700/30 text-amber-300'
                : 'bg-sky-900/30 border-sky-700/30 text-sky-300'
            }`}
          >
            {kind === 'preview' ? 'Preview website' : 'Deployment'}
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

      {kind === 'deployment' && (
        <div className="flex flex-wrap gap-1.5">
          {DEVELOPMENT_STEPS.map((step) => {
            const done = Boolean(item.development?.[step.key]);
            return (
              <button
                key={step.key}
                type="button"
                disabled={busyKey === `${item.id}:${step.key}`}
                onClick={() => onToggleStep(item, step.key)}
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
      )}

      {salesClientId ? (
        <MakerRunTools
          salesClientId={salesClientId}
          client={{ id: salesClientId, makerRun: item.makerRun, websiteImport: item.websiteImport }}
          websiteMakerBaseUrl={websiteMakerBaseUrl}
          setWebsiteMakerBaseUrl={setWebsiteMakerBaseUrl}
          authHeaders={developmentAuthHeaders()}
          onReload={onReload}
          onError={onError}
          onNotice={onNotice}
          allowCreate
          allowLink
        />
      ) : (
        <p className="text-xs text-gray-500">No sales client linked — maker tools need a sales client.</p>
      )}
    </div>
  );
}

export function DevelopmentClientsSection({ hideHeader = false }: Props) {
  const [previewItems, setPreviewItems] = useState<DevelopmentItem[]>([]);
  const [deploymentItems, setDeploymentItems] = useState<DevelopmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [startingMakerTunnel, setStartingMakerTunnel] = useState(false);
  const { websiteMakerBaseUrl, setWebsiteMakerBaseUrl } = useWebsiteMakerBaseUrl();

  const loadItems = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`${API}/admin/development`, {
        headers: developmentAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed loading development clients');
      }
      const deployment = Array.isArray(data.deploymentItems)
        ? data.deploymentItems
        : (Array.isArray(data.items) ? data.items : []);
      setDeploymentItems(deployment);
      setPreviewItems(Array.isArray(data.previewItems) ? data.previewItems : []);
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
      if (Array.isArray(data.previewItems) || Array.isArray(data.deploymentItems) || Array.isArray(data.items)) {
        setPreviewItems(Array.isArray(data.previewItems) ? data.previewItems : previewItems);
        setDeploymentItems(
          Array.isArray(data.deploymentItems)
            ? data.deploymentItems
            : (Array.isArray(data.items) ? data.items : deploymentItems)
        );
      } else {
        await loadItems();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed updating development step');
    } finally {
      setBusyKey(null);
    }
  }

  async function startMakerTunnel() {
    setStartingMakerTunnel(true);
    setError('');
    try {
      const tunnelHost = tunnelPopupMakerOrigin(websiteMakerBaseUrl);
      const tunnelUrl = await openMakerTunnelPopup(tunnelHost);
      setWebsiteMakerBaseUrl(tunnelUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Website Maker tunnel');
    } finally {
      setStartingMakerTunnel(false);
    }
  }

  const empty = !loading && previewItems.length === 0 && deploymentItems.length === 0;

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div>
          <h2 className="text-lg font-semibold text-white">Utvikling</h2>
          <p className="text-gray-400 text-sm">
            Preview-nettsider for aktive salgskunder, og deployment etter kontrakt er signert.
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-4 space-y-2">
        <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Website Maker URL</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={websiteMakerBaseUrl}
            onChange={(e) => setWebsiteMakerBaseUrl(e.target.value)}
            placeholder={LAN_MAKER_URL}
            className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-sm"
          />
          <button
            type="button"
            onClick={() => setWebsiteMakerBaseUrl(LAN_MAKER_URL)}
            className="px-3 py-2 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15"
          >
            Office LAN
          </button>
          <button
            type="button"
            onClick={() => setWebsiteMakerBaseUrl(LOCAL_MAKER_URL)}
            className="px-3 py-2 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15"
          >
            This computer
          </button>
          <button
            type="button"
            onClick={() => void startMakerTunnel()}
            disabled={startingMakerTunnel}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
          >
            {startingMakerTunnel ? <Loader2 size={13} className="animate-spin" /> : null}
            Start tunnel
          </button>
        </div>
        <p className="text-[11px] text-gray-500">
          Opprett run, åpne Maker og Maker preview skjer her — ikke i Sales.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="min-h-[160px] flex items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} /> Loading development clients…
        </div>
      ) : empty ? (
        <p className="text-gray-400 text-center py-8">
          Ingen preview- eller deployment-kunder ennå. Nye salgskunder vises under Preview websites.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Preview website runs</h3>
              <p className="text-xs text-gray-400 mt-1">
                Aktive salgskunder. Lag preview-run her slik at sales bare åpner den offentlige URL-en.
              </p>
            </div>
            {previewItems.length === 0 ? (
              <p className="text-sm text-gray-500">Ingen preview-kunder akkurat nå.</p>
            ) : (
              <div className="space-y-4">
                {previewItems.map((item) => (
                  <React.Fragment key={item.id}>
                    <DevelopmentCard
                      item={item}
                      kind="preview"
                      busyKey={busyKey}
                      websiteMakerBaseUrl={websiteMakerBaseUrl}
                      setWebsiteMakerBaseUrl={setWebsiteMakerBaseUrl}
                      onToggleStep={toggleStep}
                      onReload={loadItems}
                      onError={setError}
                      onNotice={setNotice}
                    />
                  </React.Fragment>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Deployment website runs</h3>
              <p className="text-xs text-gray-400 mt-1">
                Signerte kontrakter: Hostinger, GitHub, V1 og ferdig nettside.
              </p>
            </div>
            {deploymentItems.length === 0 ? (
              <p className="text-sm text-gray-500">Ingen deployment-kunder akkurat nå.</p>
            ) : (
              <div className="space-y-4">
                {deploymentItems.map((item) => (
                  <React.Fragment key={item.id}>
                    <DevelopmentCard
                      item={item}
                      kind="deployment"
                      busyKey={busyKey}
                      websiteMakerBaseUrl={websiteMakerBaseUrl}
                      setWebsiteMakerBaseUrl={setWebsiteMakerBaseUrl}
                      onToggleStep={(entry, stepKey) => void toggleStep(entry, stepKey)}
                      onReload={loadItems}
                      onError={setError}
                      onNotice={setNotice}
                    />
                  </React.Fragment>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
