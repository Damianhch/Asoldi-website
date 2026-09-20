import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, FileText, Film, HardDrive, Image as ImageIcon, Loader2, Music, Pencil, Trash2, Upload, X } from 'lucide-react';
import { API, authHeaders, type MediaItem } from '../shared';

type Filter = 'all' | MediaItem['kind'];

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value < 10 && idx > 0 ? value.toFixed(1) : Math.round(value)} ${units[idx]}`;
}

function KindIcon({ kind, size = 16 }: { kind: MediaItem['kind']; size?: number }) {
  if (kind === 'image') return <ImageIcon size={size} />;
  if (kind === 'video') return <Film size={size} />;
  if (kind === 'audio') return <Music size={size} />;
  return <FileText size={size} />;
}

function SourceBadge({ source }: { source: MediaItem['source'] }) {
  if (source === 'disk') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/30 text-emerald-300">on disk</span>;
  if (source === 'both') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/30 text-emerald-300">disk + git</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/30 text-amber-300" title="Only in the Git repo (public/media). Upload it here to keep it when it is removed from Git.">git only</span>;
}

/**
 * WordPress-style media library for asoldi.com. Files are stored on the
 * Hostinger disk (persistent data dir) and served at /media/<name> — the same
 * URLs the site already uses — so a GitHub deploy never removes them.
 */
export function MediaLibrarySection() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [maxBytes, setMaxBytes] = useState(0);
  const [dir, setDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<{ total: number; done: number; current: string } | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [copied, setCopied] = useState('');
  const [folder, setFolder] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/media`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not load media');
      setItems(Array.isArray(data.items) ? data.items : []);
      setMaxBytes(Number(data.maxBytes) || 0);
      setDir(String(data.dir || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load media');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.kind !== filter) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.alt.toLowerCase().includes(q) || item.tags.some((t) => t.includes(q));
    });
  }, [items, filter, query]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: items.length };
    for (const item of items) out[item.kind] = (out[item.kind] || 0) + 1;
    return out;
  }, [items]);

  const totalDisk = useMemo(() => items.filter((i) => i.source !== 'git').reduce((sum, i) => sum + i.size, 0), [items]);
  const gitOnly = useMemo(() => items.filter((i) => i.source === 'git').length, [items]);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setError('');
    const tooBig = files.filter((f) => maxBytes && f.size > maxBytes);
    if (tooBig.length) {
      setError(`${tooBig.map((f) => f.name).join(', ')} exceed ${formatBytes(maxBytes)} (HUB_MEDIA_MAX_MB).`);
      return;
    }
    setUploading({ total: files.length, done: 0, current: files[0].name });
    try {
      // One request per file so a single failure does not lose the batch and
      // progress stays honest for large videos.
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setUploading({ total: files.length, done: i, current: file.name });
        const form = new FormData();
        form.append('files', file);
        const params = new URLSearchParams();
        if (folder.trim()) params.set('folder', folder.trim());
        const res = await fetch(`${API}/admin/media${params.toString() ? `?${params}` : ''}`, {
          method: 'POST',
          headers: authHeaders(),
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${file.name}: ${data.message || 'upload failed'}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      await load();
    } finally {
      setUploading(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    void uploadFiles(Array.from(e.dataTransfer.files || []));
  }

  async function copyUrl(item: MediaItem) {
    const absolute = `${window.location.origin}${item.url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(item.name);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      window.prompt('Copy URL', absolute);
    }
  }

  async function remove(item: MediaItem) {
    if (!confirm(`Delete "${item.name}" from the media library? Pages that reference /media/${item.name} will break.`)) return;
    const res = await fetch(`${API}/admin/media/${item.name.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.message || 'Delete failed');
      return;
    }
    if (selected?.name === item.name) setSelected(null);
    await load();
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Media</h1>
          <p className="text-gray-400 text-sm">
            Videos, audio, images and PDFs used on asoldi.com. Stored on the server disk and served at <code className="text-gray-300">/media/&lt;name&gt;</code> — a GitHub deploy never removes them.
          </p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <div>{items.length} files · {formatBytes(totalDisk)} on disk{gitOnly ? ` · ${gitOnly} only in Git` : ''}</div>
          {dir && <div className="mt-0.5 font-mono text-[11px] text-gray-500 truncate max-w-[360px]" title={dir}>{dir}</div>}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-4 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors ${
          dragging ? 'border-[#FF5B00] bg-[#FF5B00]/10' : 'border-white/15 bg-[#2a2a2a]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf"
          onChange={(e) => {
            void uploadFiles(Array.from(e.target.files || []));
            e.target.value = '';
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-sm text-gray-200">
            <Loader2 size={20} className="animate-spin text-[#FF5B00]" />
            <div>
              Uploading {uploading.done + 1} / {uploading.total} — <span className="text-gray-400">{uploading.current}</span>
            </div>
            <div className="w-64 h-1.5 rounded bg-white/10 overflow-hidden">
              <div className="h-full bg-[#FF5B00] transition-all" style={{ width: `${Math.round((uploading.done / uploading.total) * 100)}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={22} className="text-gray-400" />
            <div className="text-sm text-gray-200">Drag files here or</div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white text-sm font-medium hover:bg-[#e65200]"
              >
                Choose files
              </button>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="folder (optional)"
                className="px-3 py-2 rounded-lg bg-[#1e1e1e] border border-white/10 text-sm text-white w-44"
              />
            </div>
            <div className="text-xs text-gray-500">
              png · jpg · webp · gif · svg · mp4 · webm · mov · mp3 · wav · pdf{maxBytes ? ` · max ${formatBytes(maxBytes)} per file` : ''}
            </div>
          </div>
        )}
      </div>

      {error && <div className="mt-3 rounded-lg bg-red-900/30 border border-red-700/30 px-4 py-2 text-sm text-red-200">{error}</div>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(['all', 'image', 'video', 'audio', 'document'] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              filter === key ? 'bg-[#FF5B00] border-[#FF5B00] text-white' : 'bg-[#2a2a2a] border-white/10 text-gray-300 hover:border-white/30'
            }`}
          >
            {key === 'all' ? 'All' : key === 'document' ? 'PDF' : key.charAt(0).toUpperCase() + key.slice(1)}
            <span className="ml-1 opacity-70">{counts[key] || 0}</span>
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, alt, tag…"
          className="ml-auto px-3 py-1.5 rounded-lg bg-[#2a2a2a] border border-white/10 text-sm text-white w-64"
        />
      </div>

      {loading ? (
        <div className="mt-6 text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : visible.length === 0 ? (
        <div className="mt-6 text-sm text-gray-400">No files{query || filter !== 'all' ? ' match this filter' : ' yet'}.</div>
      ) : (
        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSelected(item)}
              className={`group text-left rounded-xl overflow-hidden border bg-[#2a2a2a] hover:border-[#FF5B00]/60 transition-colors ${
                selected?.name === item.name ? 'border-[#FF5B00]' : 'border-white/10'
              }`}
            >
              <div className="aspect-square bg-[#1e1e1e] flex items-center justify-center overflow-hidden">
                {item.kind === 'image' ? (
                  <img src={item.url} alt={item.alt || item.name} loading="lazy" className="w-full h-full object-cover" />
                ) : item.kind === 'video' ? (
                  <video src={item.url} muted preload="metadata" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-500"><KindIcon kind={item.kind} size={32} /></div>
                )}
              </div>
              <div className="p-2">
                <div className="text-xs text-white truncate" title={item.name}>{item.name}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-400">
                  <span>{formatBytes(item.size)}</span>
                  <SourceBadge source={item.source} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <MediaDetails
          item={selected}
          copied={copied === selected.name}
          onClose={() => setSelected(null)}
          onCopy={() => void copyUrl(selected)}
          onDelete={() => void remove(selected)}
          onSaved={(next) => {
            setSelected(next);
            void load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function MediaDetails({
  item,
  copied,
  onClose,
  onCopy,
  onDelete,
  onSaved,
  onError,
}: {
  item: MediaItem;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onSaved: (item: MediaItem) => void;
  onError: (message: string) => void;
}) {
  const [alt, setAlt] = useState(item.alt);
  const [tags, setTags] = useState(item.tags.join(', '));
  const [rename, setRename] = useState(item.name.split('/').pop() || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAlt(item.alt);
    setTags(item.tags.join(', '));
    setRename(item.name.split('/').pop() || '');
  }, [item]);

  async function save() {
    setSaving(true);
    onError('');
    try {
      const res = await fetch(`${API}/admin/media/${item.name.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), rename }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Save failed');
      if (data.item) onSaved(data.item);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const dirty = alt !== item.alt || tags !== item.tags.join(', ') || rename !== (item.name.split('/').pop() || '');

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#23282d] border-l border-white/10 shadow-2xl z-40 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate" title={item.name}>{item.name}</div>
          <div className="text-xs text-gray-400 inline-flex items-center gap-2 mt-0.5">
            <KindIcon kind={item.kind} size={12} /> {item.mime} · {formatBytes(item.size)} · <SourceBadge source={item.source} />
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="rounded-xl bg-[#1e1e1e] border border-white/10 overflow-hidden flex items-center justify-center min-h-[160px]">
          {item.kind === 'image' && <img src={item.url} alt={item.alt || item.name} className="max-h-72 w-full object-contain" />}
          {item.kind === 'video' && <video src={item.url} controls preload="metadata" className="w-full max-h-72" />}
          {item.kind === 'audio' && <audio src={item.url} controls preload="metadata" className="w-full px-4" />}
          {item.kind === 'document' && (
            <a href={item.url} target="_blank" rel="noreferrer" className="text-sm text-[#FF5B00] underline inline-flex items-center gap-2 py-8"><FileText size={16} /> Open PDF</a>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">URL</label>
          <div className="flex gap-2">
            <input readOnly value={item.url} className="flex-1 px-3 py-2 rounded-lg bg-[#1e1e1e] border border-white/10 text-xs text-gray-200 font-mono" />
            <button type="button" onClick={onCopy} className="px-3 py-2 rounded-lg bg-white/10 text-gray-200 text-xs inline-flex items-center gap-1.5 hover:bg-white/15">
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Use this path in code or content, e.g. <code>&lt;video src="{item.url}"&gt;</code>.</p>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">File name</label>
          <div className="relative">
            <input
              value={rename}
              onChange={(e) => setRename(e.target.value)}
              disabled={item.source === 'git'}
              className="w-full px-3 py-2 rounded-lg bg-[#1e1e1e] border border-white/10 text-sm text-white disabled:opacity-60"
            />
            <Pencil size={12} className="absolute right-3 top-3 text-gray-500" />
          </div>
          {item.source === 'git' && <p className="text-[11px] text-amber-300 mt-1">Only in Git — upload a copy here before renaming or deleting.</p>}
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Alt text</label>
          <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the file for screen readers" className="w-full px-3 py-2 rounded-lg bg-[#1e1e1e] border border-white/10 text-sm text-white" />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Tags</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="marketing, lydklipp, hero" className="w-full px-3 py-2 rounded-lg bg-[#1e1e1e] border border-white/10 text-sm text-white" />
        </div>

        <div className="text-xs text-gray-500 space-y-0.5">
          <div className="inline-flex items-center gap-1.5"><HardDrive size={12} /> {item.source === 'git' ? 'public/media (Git checkout)' : 'persistent data dir /media'}</div>
          {item.uploadedBy && <div>Uploaded by {item.uploadedBy}</div>}
          <div>{new Date(item.createdAt).toLocaleString('nb-NO')}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/10">
        <button
          type="button"
          onClick={onDelete}
          disabled={item.source === 'git'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-900/30 disabled:opacity-40"
        >
          <Trash2 size={14} /> Delete
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
        </button>
      </div>
    </div>
  );
}
