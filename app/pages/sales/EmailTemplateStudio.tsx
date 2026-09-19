import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, FileUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { EmailVisualEditor } from './EmailVisualEditor';
import {
  deleteEmailTemplate,
  importEmailTemplate,
  listEmailTemplates,
  saveEmailDraft,
  saveEmailTemplate,
  type EmailTemplate,
  type MergeField,
} from './emailApi';
import { getSalesToken } from '../Admin/shared';

type Props = {
  embedded?: boolean;
};

export function EmailTemplateStudio({ embedded = false }: Props) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [mergeFields, setMergeFields] = useState<MergeField[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [html, setHtml] = useState('');
  const [htmlKey, setHtmlKey] = useState('empty');
  const [project, setProject] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const selected = useMemo(
    () => templates.find((row) => row.id === selectedId) || null,
    [templates, selectedId]
  );

  async function refresh(selectId = '') {
    const data = await listEmailTemplates();
    setTemplates(data.templates || []);
    setMergeFields(data.mergeFields || []);
    const nextId = selectId || data.templates?.[0]?.id || '';
    setSelectedId(nextId);
    const match = (data.templates || []).find((row) => row.id === nextId);
    if (match) applyTemplate(match);
    setLoading(false);
  }

  function applyTemplate(template: EmailTemplate) {
    setName(template.name);
    setSubject(template.subject);
    setPreheader(template.preheader);
    setHtml(template.html);
    setProject((template.grapesProject as Record<string, unknown> | undefined) || null);
    setHtmlKey(`${template.id}-${template.updatedAt}`);
  }

  useEffect(() => {
    refresh().catch((err) => {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste maler');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    applyTemplate(selected);
  }, [selectedId]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const data = await saveEmailTemplate({
        id: selected?.id,
        key: selected?.key,
        name,
        subject,
        preheader,
        html,
        grapesProject: project || undefined,
      });
      setNotice('Mal lagret');
      await refresh(data.template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lagring feilet');
    } finally {
      setSaving(false);
    }
  }

  async function handleNew() {
    setSaving(true);
    setError('');
    try {
      const data = await saveEmailTemplate({
        name: 'Ny mal',
        subject: '',
        preheader: '',
        html: '<table width="100%"><tr><td style="padding:24px;font-family:Arial">Hei {{firstName}},</td></tr></table>',
      });
      await refresh(data.template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke opprette mal');
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(file: File) {
    const htmlText = await file.text();
    setSaving(true);
    setError('');
    try {
      const data = await importEmailTemplate({
        name: file.name.replace(/\.[^.]+$/, ''),
        html: htmlText,
      });
      setNotice('Mal importert');
      await refresh(data.template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import feilet');
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setError('');
    try {
      const data = await saveEmailDraft({
        templateId: selected?.id,
        templateKey: selected?.key,
        subject,
        preheader,
        html,
      });
      setPreviewUrl(data.previewPc);
      window.open(data.previewPc, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Forhåndsvisning feilet');
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Slette «${selected.name}»?`)) return;
    setSaving(true);
    try {
      await deleteEmailTemplate(selected.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sletting feilet');
    } finally {
      setSaving(false);
    }
  }

  const body = (
    <div className={`grid gap-6 ${embedded ? '' : 'lg:grid-cols-[260px_1fr]'}`}>
      <aside className="rounded-xl bg-[#222] border border-white/10 p-4 h-fit">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Maler</h2>
          <button type="button" onClick={() => void handleNew()} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15">
            <Plus size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full mb-3 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 text-xs text-gray-300 hover:bg-white/5"
        >
          <FileUp size={14} />
          Importer HTML
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm,.txt"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleImport(file);
          }}
        />
        <div className="space-y-1">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelectedId(template.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                selectedId === template.id ? 'bg-[#FF5B00] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <div>{template.name}</div>
              <div className="text-[11px] opacity-70">{template.preset ? 'Asoldi-mal' : 'Egen mal'}</div>
            </button>
          ))}
          {templates.length === 0 && !loading && (
            <p className="text-xs text-gray-500">Ingen maler ennå. Importer HTML eller lag en ny.</p>
          )}
        </div>
      </aside>
      <section className="min-h-[70vh] flex flex-col gap-3">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-xs text-gray-400">
            Navn
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/15 text-white text-sm" />
          </label>
          <label className="text-xs text-gray-400">
            Emne
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/15 text-white text-sm" />
          </label>
          <label className="text-xs text-gray-400 md:col-span-2">
            Forhåndstekst / preheader
            <input value={preheader} onChange={(e) => setPreheader(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/15 text-white text-sm" />
          </label>
        </div>
        <div className="flex-1 min-h-[560px]">
          <EmailVisualEditor
            html={html}
            htmlKey={htmlKey}
            grapesProject={selected?.grapesProject}
            mergeFields={mergeFields}
            onHtmlChange={setHtml}
            onProjectChange={setProject}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white text-sm disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Lagre mal
          </button>
          <button type="button" onClick={() => void handlePreview()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-sm">
            <ExternalLink size={14} />
            Forhåndsvis URL
          </button>
          {selected && (
            <button type="button" onClick={() => void handleDelete()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-sm">
              <Trash2 size={14} />
              Slett
            </button>
          )}
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-400 underline self-center">
              {previewUrl}
            </a>
          )}
        </div>
      </section>
    </div>
  );

  if (embedded) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">E-postmaler</h1>
        <p className="text-gray-400 text-sm mb-6">Dra blokker, rediger tekst og importer HTML. Flettefelt fylles når du sender fra salgssiden.</p>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {notice && <p className="text-emerald-300 text-sm mb-3">{notice}</p>}
        {loading ? <Loader2 className="animate-spin" /> : body}
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>E-postmaler – Asoldi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="staff-light min-h-screen bg-[#1a1a1a] text-white">
        <header className="border-b border-white/10 bg-[#222]">
          <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">E-postmaler</h1>
              <p className="text-xs text-gray-400">Rediger Asoldi-malene, eller importer en ny.</p>
            </div>
            <Link to="/sales" className="px-3 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/15">Tilbake til salg</Link>
          </div>
        </header>
        <main className="max-w-[1400px] mx-auto px-6 py-6">
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          {notice && <p className="text-emerald-300 text-sm mb-3">{notice}</p>}
          {loading ? <Loader2 className="animate-spin" /> : body}
        </main>
      </div>
    </>
  );
}

export function EmailTemplateStudioPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const token = getSalesToken();
    if (!token) navigate('/login/ansatt', { replace: true });
  }, [navigate]);
  return <EmailTemplateStudio />;
}
