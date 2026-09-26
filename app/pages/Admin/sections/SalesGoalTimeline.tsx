import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronsDown, ChevronsUp, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { SalesClient, SalesGoalKey, SalesNextAction, SalesNextActionPreset } from '../shared';
import {
  AFTER_SALE_GOAL,
  ACTION_FORMATS,
  formatActionFormatLabel,
  formatGoalLabel,
  formatPresetLabel,
  getCurrentGoalKey,
  getFutureGoalKeys,
  getGoalActions,
  getRemainingGoalCount,
  getSalesGoalKeys,
  getVisibleGoalKeys,
  GOAL_PRESETS,
  defaultAddToCalendar,
  defaultFormatForPreset,
  presetNeedsMeeting,
  suggestedDueAtForPreset,
} from '../../../../lib/sales-next-actions.js';
import type { SalesActionFormat } from '../shared';

type DraftState = {
  presetKey: SalesNextActionPreset;
  name: string;
  note: string;
  format: SalesActionFormat;
  dueAt: string;
  addToCalendar: boolean;
};

type EditState = {
  actionId: string;
  name: string;
  note: string;
  format: SalesActionFormat;
  dueAt: string;
  addToCalendar: boolean;
};

type Props = {
  client: SalesClient;
  progressBusyKey: string | null;
  actionBusy: boolean;
  onToggleGoal: (key: SalesGoalKey, extra?: { fastTrack?: boolean }) => void;
  onMutateAction: (body: Record<string, unknown>) => Promise<void>;
  /** Sold clients: actions only, no møte/tilbud/kontrakt checkpoints. */
  variant?: 'active' | 'win';
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
  variant = 'active',
}: Props) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [showFutureGoals, setShowFutureGoals] = useState(false);
  const isWin = variant === 'win';
  const currentGoal = (isWin ? AFTER_SALE_GOAL : getCurrentGoalKey(client)) as SalesGoalKey | 'afterSale' | '';
  const remainingCount = getRemainingGoalCount(client);
  const visibleGoals = (showFutureGoals
    ? getSalesGoalKeys(client.product)
    : getVisibleGoalKeys(client)) as SalesGoalKey[];
  const futureGoalSet = new Set(getFutureGoalKeys(client) as SalesGoalKey[]);
  const currentActions = useMemo(
    () => (currentGoal ? getGoalActions(client, currentGoal) as SalesNextAction[] : []),
    [client, currentGoal]
  );
  const presets = currentGoal ? (GOAL_PRESETS[currentGoal] || []) : [];
  const hasMeeting = Boolean(client.agreedTime && client.meetingAt);

  function startPreset(presetKey: SalesNextActionPreset) {
    if (presetNeedsMeeting(presetKey) && !hasMeeting) return;
    const suggested = suggestedDueAtForPreset(presetKey, client);
    setEdit(null);
    setDraft({
      presetKey,
      name: formatPresetLabel(presetKey) === 'Custom' ? '' : formatPresetLabel(presetKey),
      note: '',
      format: defaultFormatForPreset(presetKey) as SalesActionFormat,
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
      note: draft.note,
      format: draft.format,
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
      note: edit.note,
      format: edit.format,
      dueAt: toIsoDateTime(edit.dueAt),
      addToCalendar: edit.addToCalendar,
    });
    setEdit(null);
  }

  function formatControls(
    value: { format: SalesActionFormat; addToCalendar: boolean; presetKey?: string },
    onChange: (patch: Partial<Pick<DraftState, 'format' | 'addToCalendar'>>) => void,
  ) {
    const calendarLocked = value.presetKey === 'meeting';
    return (
      <div className="sm:col-span-2 flex items-center gap-2">
        <select
          aria-label="Format"
          value={value.format}
          onChange={(event) => onChange({ format: event.target.value as SalesActionFormat })}
          className="min-w-0 flex-1 rounded-md bg-[#161616] border border-white/10 text-white text-xs px-2 py-1.5"
        >
          {ACTION_FORMATS.map((format) => (
            <option key={format} value={format}>{formatActionFormatLabel(format)}</option>
          ))}
        </select>
        <span title="15 min i Google Kalender" className="shrink-0 text-gray-300">
          <CalendarDays size={15} />
        </span>
        <button
          type="button"
          role="switch"
          aria-label="15 min i Google Kalender"
          aria-checked={value.addToCalendar}
          disabled={calendarLocked}
          onClick={() => onChange({ addToCalendar: !value.addToCalendar })}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-70 ${
            value.addToCalendar ? 'bg-[#FF5B00]' : 'bg-white/20'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${value.addToCalendar ? 'ml-4' : 'ml-1'}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
      {!isWin && (
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleGoals.map((key) => {
          const done = Boolean(client.progression?.[key]);
          const busy = progressBusyKey === `${client.id}:${key}`;
          const isFuture = futureGoalSet.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={busy || isFuture}
              onClick={() => onToggleGoal(key)}
              title={
                isFuture
                  ? 'Fullfør nåværende mål først'
                  : done
                    ? 'Klikk for å angre dette målet'
                    : 'Marker dette målet som ferdig. Neste mål vises automatisk.'
              }
              className={`px-2 py-1 rounded-md text-[11px] border transition-colors disabled:opacity-60 ${
                done
                  ? 'bg-green-900/40 border-green-600/40 text-green-300 hover:border-green-500/50'
                  : 'bg-black/20 border-white/10 text-gray-300 hover:border-white/20'
              }`}
            >
              {busy ? <Loader2 size={11} className="inline mr-1 animate-spin" /> : done ? <CheckCircle2 size={11} className="inline mr-1" /> : null}
              {formatGoalLabel(key)}
            </button>
          );
        })}
        {remainingCount > 0 && (
          <button
            type="button"
            onClick={() => setShowFutureGoals((prev) => !prev)}
            className="inline-flex items-center justify-center p-1 text-gray-400 hover:text-gray-200"
            title={showFutureGoals ? 'Skjul senere mål' : `Vis ${remainingCount} senere mål`}
            aria-label={showFutureGoals ? 'Skjul senere mål' : `Vis ${remainingCount} senere mål`}
          >
            {showFutureGoals ? <ChevronsUp size={16} /> : <ChevronsDown size={16} />}
          </button>
        )}
      </div>
      )}

      {currentGoal ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-2">
          <div className="text-[11px] text-gray-400">
            {isWin ? 'Neste handling' : (
              <>Neste handling i <span className="text-gray-200">{formatGoalLabel(currentGoal)}</span></>
            )}
          </div>

          {currentActions.map((currentAction) => (
            <div key={currentAction.id} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
              {edit?.actionId === currentAction.id ? (
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
                  <label className="sm:col-span-2 text-[10px] text-gray-400 uppercase tracking-wide">
                    Notat til handlingen
                    <textarea
                      value={edit.note}
                      onChange={(event) => setEdit((prev) => prev ? { ...prev, note: event.target.value } : prev)}
                      rows={2}
                      placeholder="F.eks. ringer etter lunsj, vil ha pris på 5 sider"
                      className="mt-1 w-full rounded-md bg-[#161616] border border-white/10 text-white text-xs px-2 py-1.5 resize-y"
                    />
                  </label>
                  {formatControls(
                    { format: edit.format, addToCalendar: edit.addToCalendar, presetKey: currentAction.presetKey },
                    (patch) => setEdit((prev) => prev ? { ...prev, ...patch } : prev),
                  )}
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
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white truncate">
                      {currentAction.name}
                      {currentAction.format ? (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-400">{formatActionFormatLabel(currentAction.format)}</span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">{formatWhen(currentAction.dueAt)}</div>
                    {currentAction.note ? (
                      <div className="mt-0.5 text-[11px] text-gray-300 whitespace-pre-wrap break-words">{currentAction.note}</div>
                    ) : null}
                  </div>
                  {currentAction.addToCalendar ? (
                    <span title="I Google Kalender" className="shrink-0 text-[#FF5B00]">
                      <CalendarDays size={12} />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setEdit({
                      actionId: currentAction.id,
                      name: currentAction.name,
                      note: currentAction.note || '',
                      format: (currentAction.format || defaultFormatForPreset(currentAction.presetKey)) as SalesActionFormat,
                      dueAt: toDateTimeLocal(currentAction.dueAt),
                      addToCalendar: Boolean(currentAction.addToCalendar) || currentAction.presetKey === 'meeting',
                    })}
                    className="shrink-0 p-1 rounded text-gray-400 hover:text-white"
                    title="Endre navn eller tid"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void onMutateAction({ op: 'complete', id: currentAction.id })}
                    className="shrink-0 p-1 rounded text-gray-400 hover:text-green-300"
                    title={currentAction.presetKey === 'meeting' ? 'Møtet er hatt' : 'Fullfør handling'}
                  >
                    <CheckCircle2 size={12} />
                  </button>
                  {currentAction.presetKey !== 'meeting' && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void onMutateAction({ op: 'delete', id: currentAction.id })}
                      className="shrink-0 p-1 rounded text-gray-500 hover:text-red-300"
                      title="Fjern handling"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {draft ? (
            <div className="rounded-lg border border-white/10 bg-black/10 p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">
                Navn
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => prev ? { ...prev, name: event.target.value } : prev)}
                  placeholder="F.eks. Ring"
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
              <label className="sm:col-span-2 text-[10px] text-gray-400 uppercase tracking-wide">
                Notat til handlingen
                <textarea
                  value={draft.note}
                  onChange={(event) => setDraft((prev) => prev ? { ...prev, note: event.target.value } : prev)}
                  rows={2}
                  placeholder="Valgfritt. Spesifikk kontekst for denne handlingen."
                  className="mt-1 w-full rounded-md bg-[#161616] border border-white/10 text-white text-xs px-2 py-1.5 resize-y"
                />
              </label>
              {formatControls(
                { format: draft.format, addToCalendar: draft.addToCalendar, presetKey: draft.presetKey },
                (patch) => setDraft((prev) => prev ? { ...prev, ...patch } : prev),
              )}
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
                    title={needsMeeting ? 'Sett avtalt møtetid først' : 'Legg til handlingen. Møtet blir stående.'}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-white/10 bg-white/5 text-gray-200 hover:border-white/20 disabled:opacity-40"
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
