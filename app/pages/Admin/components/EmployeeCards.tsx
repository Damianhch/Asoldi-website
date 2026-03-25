import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, Plus, Send } from 'lucide-react';
import type { EmployeeChecklist, EmployeeNote } from '../shared';

export const EMPLOYEE_CHECKLIST_LABELS: Record<keyof EmployeeChecklist, string> = {
  contractSent: 'Contract sent',
  contractSigned: 'Contract signed',
  oneWeekMeeting: '1 week meeting',
  monthlyReview: 'Monthly review',
  systemAccessGranted: 'System access granted',
  personalDetailsReceived: 'Personal details received',
};

export function EmployeeStatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-5">
      <div className="text-gray-400 text-sm mb-2">{title}</div>
      <div className="text-3xl font-semibold text-white">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-2">{subtitle}</div>}
    </div>
  );
}

export function EmployeeChecklistCard({
  workerId,
  checklist,
  onSaved,
}: {
  workerId: string;
  checklist: EmployeeChecklist;
  onSaved: (next: EmployeeChecklist) => void;
}) {
  const [savingKey, setSavingKey] = useState<keyof EmployeeChecklist | null>(null);

  const values = Object.values(checklist);
  const completed = values.filter(Boolean).length;
  const percentage = Math.round((completed / values.length) * 100);

  async function toggleItem(key: keyof EmployeeChecklist) {
    setSavingKey(key);
    try {
      const res = await fetch(`/api/admin/employees/workers/${workerId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken') || localStorage.getItem('superAdminToken') || ''}` },
        body: JSON.stringify({ key, value: !checklist[key] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.worker?.checklist) onSaved(data.worker.checklist);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Onboarding checklist</h3>
          <p className="text-sm text-gray-400">{completed}/{values.length} completed</p>
        </div>
        <div className="text-[#FF5B00] text-sm font-medium">{percentage}%</div>
      </div>
      <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden mb-5">
        <div className="h-full bg-[#FF5B00] transition-all" style={{ width: `${percentage}%` }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(checklist).map(([key, value]) => {
          const typedKey = key as keyof EmployeeChecklist;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleItem(typedKey)}
              className={`rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                value ? 'bg-[#FF5B00]/10 border-[#FF5B00]/40 text-white' : 'bg-black/20 border-white/10 text-gray-300 hover:border-white/20'
              }`}
            >
              {savingKey === typedKey ? (
                <Loader2 size={18} className="animate-spin flex-shrink-0" />
              ) : value ? (
                <CheckCircle2 size={18} className="flex-shrink-0 text-[#FF5B00]" />
              ) : (
                <AlertCircle size={18} className="flex-shrink-0 text-gray-500" />
              )}
              <span>{EMPLOYEE_CHECKLIST_LABELS[typedKey]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EmployeeNotesCard({
  workerId,
  notes,
  onSaved,
}: {
  workerId: string;
  notes: EmployeeNote[];
  onSaved: (next: EmployeeNote[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  async function addNote() {
    if (!draft.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/employees/workers/${workerId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken') || localStorage.getItem('superAdminToken') || ''}` },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.worker?.notes) {
        onSaved(data.worker.notes);
        setDraft('');
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 text-white">
          <MessageSquare size={18} />
          <h3 className="text-lg font-semibold">Notes</h3>
        </div>
      </div>
      <div className="rounded-xl bg-black/20 border border-white/10 p-4 mb-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Write a note about this worker..."
          className="w-full bg-transparent text-white placeholder-gray-500 outline-none resize-none"
        />
        <div className="flex justify-end pt-3">
          <button
            type="button"
            onClick={addNote}
            disabled={adding || !draft.trim()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FF5B00] text-white disabled:opacity-50"
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Save note
          </button>
        </div>
      </div>
      {notes.length === 0 ? (
        <div className="text-sm text-gray-500">No notes yet.</div>
      ) : (
        <div className="space-y-3">
          {notes.slice().reverse().map((note) => (
            <div key={note.id} className="rounded-xl bg-black/20 border border-white/10 p-4">
              <p className="text-white text-sm whitespace-pre-wrap">{note.content}</p>
              <div className="text-xs text-gray-500 mt-2">{note.createdBy} • {new Date(note.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
