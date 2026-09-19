import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, FastForward, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { SalesClient, SalesGoalKey, SalesNextAction, SalesNextActionPreset } from '../shared';
import {
  formatGoalLabel,
  formatPresetLabel,
  getCurrentGoalKey,
  getGoalActions,
  getRemainingGoalCount,
  getVisibleGoalKeys,
  GOAL_PRESETS,
  defaultAddToCalendar,
  presetNeedsMeeting,
  suggestedDueAtForPreset,
} from '../../../../lib/sales-next-actions.js';

type DraftState = {
  presetKey: SalesNextActionPreset;
  name: string;
  dueAt: string;
  addToCalendar: boolean;
};

type EditState = {
  actionId: string;
  name: string;
  dueAt: string;
  addToCalendar: boolean;
};

type Props = {
  client: SalesClient;
  progressBusyKey: string | null;
  actionBusy: boolean;
  onToggleGoal: (key: SalesGoalKey, extra?: { fastTrack?: boolean }) => void;
  onMutateAction: (body: Record<string, unknown>) => Promise<void>;
};

function toDateTimeLocal(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function toIsoDateTime(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function formatWhen(value = '') {
  if (!value) return 'Tid ikke satt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('nb-NO');
}

export function SalesGoalTimeline({
  client,
  progressBusyKey,
  actionBusy,
  onToggleGoal,
  onMutateAction,
}: Props) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const currentGoal = getCurrentGoalKey(client) as SalesGoalKey | '';
  const visibleGoals = getVisibleGoalKeys(client) as SalesGoalKey[];
  const remainingCount = getRemainingGoalCount(client);
  const currentActions = useMemo(
    () => (currentGoal ? getGoalActions(client, currentGoal) : []),
    [client, currentGoal]
  );
  const presets = currentGoal ? (GOAL_PRESETS[currentGoal] || []) : [];
  const hasMeeting = Boolean(client.agreedTime && client.meetingAt);
  const canFastTrack = Boolean(currentGoal && currentGoal !== 'contractSigned' && currentGoal !== 'paymentReceived');

  function startPreset(presetKey: SalesNextActionPreset) {
    if (presetNeedsMeeting(presetKey) && !hasMeeting) return;
    const suggested = suggestedDueAtForPreset(presetKey, client);
    setEdit(null);
    setDraft({
      presetKey,
      name: formatPresetLabel(presetKey) === 'Custom' ? '' : formatPresetLabel(presetKey),
      dueAt: toDateTimeLocal(suggested),
      addToCalendar: defaultAddToCalendar(presetKey, client),
    });
  }

  async function confirmDraft() {
    if (!draft || !currentGoal) return;
    await onMutateAction({
      op: 'create',
      goalKey: currentGoal,
      presetKey: draft.presetKey,
      name: draft.name,
      dueAt: toIsoDateTime(draft.dueAt),
      addToCalendar: draft.addToCalendar,
    });
    setDraft(null);
  }

  async function saveEdit() {
    if (!edit) return;
    await onMutateAction({
      op: 'update',
      id: edit.actionId,
      name: edit.name,
      dueAt: toIsoDateTime(edit.dueAt),
      addToCalendar: edit.addToCalendar,
    });
    setEdit(null);
  }

  return (
    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleGoals.map((key) => {
          const done = Boolean(client.progression?.[key]);
          const busy = progressBusyKey === `${client.id}:${key}`;
          return (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => onToggleGoal(key)}
              title={done ? 'Klikk for å angre dette målet' : 'Marker dette målet som ferdig og vis neste'}
              className={`px-2 py-1 rounded-md text-[11px] border transition-colors hover:border-[#FF5B00]/40 disabled:opacity-60 ${
                done
                  ? 'bg-green-900/40 border-green-600/40 text-green-300'
                  : 'bg-black/20 border-[#FF5B00]/40 text-[#ffb087]'
              }`}
            >
              {busy ? <Loader2 size={11} className="inline mr-1 animate-spin" /> : done ? <CheckCircle2 size={11} className="inline mr-1" /> : null}
              {formatGoalLabel(key)}
            </button>
          );
        })}
        {remainingCount > 0 && (
          <span className="px-2 py-1 rounded-md text-[11px] border border-white/10 bg-black/20 text-gray-500">
            +{remainingCount} igjen
          </span>
        )}
        {canFastTrack && (
          <button
            type="button"
            disabled={Boolean(progressBusyKey)}
            onClick={() => onToggleGoal('contractSigned', { fastTrack: true })}
            title="Kunden går rett til kontrakt. Hopper over gjenstående mål."
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-white/10 bg-black/20 text-gray-300 hover:border-[#FF5B00]/40 disabled:opacity-60"
          >
            <FastForward size={11} />
            Hopp til kontrakt
          </button>
        )}
      </div>

      {currentGoal ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-2">
          <div className="text-[11px] text-gray-400">
            Neste handling i <span className="text-gray-200">{formatGoalLabel(currentGoal)}</span>
          </div>

          {currentActions.length > 0 && (
            <div className="space-y-1.5">
              {currentActions.map((action: SalesNextAction) => {
                const editing = edit?.actionId === action.id;
                return (
                  <div
                    key={action.id}
                    className={`rounded-lg border px-2 py-1.5 ${
                      action.doneAt ? 'border-white/5 bg-black/10 opacity-60' : 'border-white/10 bg-black/30'
                    }`}
                  >
                    {editing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Navn
                          <input
                            value={edit.name}
                            onChange={(event) => setEdit((prev) => prev ? { ...prev, name: event.target.value } : prev)}
                            className="mt-1 w-full rounded-md bg-[#161616] border border-white/10 text-white text-xs px-2 py-1.5"
                          />
                        </label>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Tid for neste handling
                          <input
                            type="datetime-local"
                            value={edit.dueAt}
                            onChange={(event) => setEdit((prev) => prev ? { ...prev, dueAt: event.target.value } : prev)}
                            className="mt-1 w-full rounded-md bg-[#161616] border border-white/10 text-white text-xs px-2 py-1.5"
                          />
                        </label>
                        <label className="sm:col-span-2 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                          <span className="text-[11px] text-gray-200">Legg til i Google Kalender</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={edit.addToCalendar}
                            disabled={currentActions.find((entry) => entry.id === action.id)?.presetKey === 'meeting'}
                            onClick={() => setEdit((prev) => prev ? { ...prev, addToCalendar: !prev.addToCalendar } : prev)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-70 ${
                              edit.addToCalendar ? 'bg-[#FF5B00]' : 'bg-white/20'
                            }`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${edit.addToCalendar ? 'translate-x-4.5 ml-4' : 'ml-1'}`} />
                          </button>
                        </label>
                        <div className="sm:col-span-2 flex gap-2">
                          <button
                            type="button"
                            disabled={actionBusy || !edit.name.trim() || !edit.dueAt}
                            onClick={() => void saveEdit()}
                            className="px-2 py-1 rounded-md bg-[#FF5B00] text-white text-[11px] disabled:opacity-50"
                          >
                            Lagre
                          </button>
                          <button
                            type="button"
                            onClick={() => setEdit(null)}
                            className="px-2 py-1 rounded-md bg-white/10 text-gray-200 text-[11px]"
                          >
                            Avbryt
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => void onMutateAction({
                            op: 'complete',
                            id: action.id,
                            done: !action.doneAt,
                          })}
                          title={action.doneAt ? 'Merk som ikke gjort' : 'Merk handlingen som gjort'}
                          className="shrink-0 text-gray-400 hover:text-green-300"
                        >
                          <CheckCircle2 size={14} className={action.doneAt ? 'text-green-400' : ''} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-white truncate">{action.name}</div>
                          <div className="text-[11px] text-gray-400 truncate">{formatWhen(action.dueAt)}</div>
                        </div>
                        {action.addToCalendar ? (
                          <span title="I Google Kalender" className="shrink-0 text-[#FF5B00]">
                            <CalendarDays size={12} />
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEdit({
                            actionId: action.id,
                            name: action.name,
                            dueAt: toDateTimeLocal(action.dueAt),
                            addToCalendar: Boolean(action.addToCalendar) || action.presetKey === 'meeting',
                          })}
                          className="shrink-0 p-1 rounded text-gray-400 hover:text-white"
                          title="Endre navn eller tid"
                        >
                          <Pencil size={12} />
                        </button>
                        {action.presetKey !== 'meeting' && (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => void onMutateAction({ op: 'delete', id: action.id })}
                            className="shrink-0 p-1 rounded text-gray-500 hover:text-red-300"
                            title="Fjern handling"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {draft ? (
            <div className="rounded-lg border border-[#FF5B00]/30 bg-[#FF5B00]/5 p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">
                Navn
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => prev ? { ...prev, name: event.target.value } : prev)}
                  placeholder="F.eks. Oppsjekk 1"
                  className="mt-1 w-full rounded-md bg-[#161616] border border-white/10 text-white text-xs px-2 py-1.5"
                />
              </label>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">
                Tid for neste handling
                <input
                  type="datetime-local"
                  value={draft.dueAt}
                  onChange={(event) => setDraft((prev) => prev ? { ...prev, dueAt: event.target.value } : prev)}
                  className="mt-1 w-full rounded-md bg-[#161616] border border-white/10 text-white text-xs px-2 py-1.5"
                />
              </label>
              <label className="sm:col-span-2 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                <span className="text-[11px] text-gray-200">
                  {draft.presetKey === 'checkIn' && defaultAddToCalendar('checkIn', client)
                    ? 'Legg til i Google Kalender (påminnelse etter sendt tilbud)'
                    : 'Legg til i Google Kalender'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.addToCalendar}
                  disabled={draft.presetKey === 'meeting'}
                  onClick={() => setDraft((prev) => prev ? { ...prev, addToCalendar: !prev.addToCalendar } : prev)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-70 ${
                    draft.addToCalendar ? 'bg-[#FF5B00]' : 'bg-white/20'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${draft.addToCalendar ? 'ml-4' : 'ml-1'}`} />
                </button>
              </label>
              <div className="sm:col-span-2 flex gap-2">
                <button
                  type="button"
                  disabled={actionBusy || !draft.name.trim() || !draft.dueAt}
                  onClick={() => void confirmDraft()}
                  className="px-2 py-1 rounded-md bg-[#FF5B00] text-white text-[11px] disabled:opacity-50"
                >
                  Sett handling
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-gray-200 text-[11px]"
                >
                  <X size={11} />
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((presetKey: SalesNextActionPreset) => {
                const needsMeeting = presetNeedsMeeting(presetKey) && !hasMeeting;
                return (
                  <button
                    key={presetKey}
                    type="button"
                    disabled={needsMeeting || actionBusy}
                    onClick={() => startPreset(presetKey)}
                    title={needsMeeting ? 'Sett avtalt møtetid først' : 'Åpner navn og tid. Ingenting lagres før du bekrefter.'}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-white/10 bg-white/5 text-gray-200 hover:border-[#FF5B00]/40 disabled:opacity-40"
                  >
                    <Plus size={11} />
                    {formatPresetLabel(presetKey)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
