import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Copy, ExternalLink, Loader2, LogOut, MonitorSmartphone, Search, Check } from 'lucide-react';
import { API, getSalesToken, salesAuthHeaders } from '../Admin/shared';

type LaptopPreviewItem = {
  id: string;
  businessName: string;
  status: string;
  runId: string;
  publicPreviewUrl: string;
  laptopUrl: string;
  importedAt: string;
};

const PUBLIC_PREVIEWS_URL = 'https://asoldi.com/previews';

export const LaptopPreviews = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'ready' | 'denied'>('checking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [boardUrl, setBoardUrl] = useState(PUBLIC_PREVIEWS_URL);
  const [items, setItems] = useState<LaptopPreviewItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedBoard, setCopiedBoard] = useState(false);

  useEffect(() => {
    const token = getSalesToken();
    if (!token) {
      navigate(`/login/ansatt?next=${encodeURIComponent('/previews')}`, { replace: true });
      return;
    }
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${API}/admin/sales/laptop-previews`, {
          headers: salesAuthHeaders(),
        });
        if (!active) return;
        if (response.status === 401 || response.status === 403) {
          setStatus('denied');
          return;
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.message || 'Could not load public previews.');
          setStatus('ready');
          return;
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        if (data.boardUrl) setBoardUrl(String(data.boardUrl));
        setStatus('ready');
      } catch {
        if (active) {
          setError('Could not load public previews.');
          setStatus('ready');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      `${item.businessName} ${item.runId}`.toLowerCase().includes(needle)
    );
  }, [items, query]);

  function logout() {
    localStorage.removeItem('employeeToken');
    window.dispatchEvent(new Event('employee-auth-changed'));
    navigate('/login/ansatt', { replace: true });
  }

  async function copyText(value: string, id = '') {
    try {
      await navigator.clipboard.writeText(value);
      if (id) {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
      } else {
        setCopiedBoard(true);
        window.setTimeout(() => setCopiedBoard(false), 2000);
      }
    } catch {
      setError('Could not copy the link. Select and copy it instead.');
    }
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-300">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading public previews…
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center gap-4 text-gray-300 px-6 text-center">
        <h1 className="text-xl font-semibold text-white">No access</h1>
        <p className="max-w-md text-sm text-gray-400">
          This page lists the same asoldi.com website previews clients see in checkout. Sign in with a sales or admin account.
        </p>
        <button type="button" onClick={logout} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white hover:bg-[#e55200]">
          Back to login
        </button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Public website previews – Asoldi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <header className="border-b border-white/10 bg-[#222]">
          <div className="max-w-[1100px] mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-[#FF5B00]">
                <MonitorSmartphone size={18} />
                <span className="text-xs uppercase tracking-wide">Meeting preview board</span>
              </div>
              <h1 className="text-lg font-semibold mt-1">Client website previews</h1>
              <p className="text-xs text-gray-400 mt-1">
                These are the Hostinger / asoldi.com snapshots used on Sales and in client checkout. Website Maker updates them after each finished step.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/sales" className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm">
                Sales
              </Link>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-[1100px] mx-auto px-6 py-8 space-y-5">
          <div className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Bookmark this on the meeting laptop</div>
              <code className="block mt-1 text-sm text-emerald-300 break-all">{boardUrl}</code>
            </div>
            <button
              type="button"
              onClick={() => void copyText(boardUrl)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
            >
              {copiedBoard ? <Check size={15} /> : <Copy size={15} />}
              {copiedBoard ? 'Copied' : 'Copy board link'}
            </button>
          </div>

          <label className="block">
            <span className="sr-only">Search clients</span>
            <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <Search size={16} className="text-gray-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent outline-none text-white"
                placeholder="Search business name"
              />
            </span>
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          {loading ? (
            <div className="min-h-[180px] flex items-center justify-center text-gray-400">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading websites…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-6 text-sm text-gray-400">
              {items.length === 0
                ? 'No public previews yet. Finish Step 1 in Website Maker, or click Update public website now on that run.'
                : 'No matching clients.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((item) => {
                const previewUrl = item.publicPreviewUrl || item.laptopUrl;
                return (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-4 flex flex-col gap-3">
                  <div>
                    <h2 className="text-white font-semibold truncate">{item.businessName}</h2>
                    <p className="mt-1 text-xs text-gray-500 break-all">{previewUrl}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white text-sm hover:bg-[#e55200]"
                    >
                      <ExternalLink size={15} />
                      Open public preview
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyText(previewUrl, item.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15"
                    >
                      {copiedId === item.id ? <Check size={15} /> : <Copy size={15} />}
                      {copiedId === item.id ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
};
