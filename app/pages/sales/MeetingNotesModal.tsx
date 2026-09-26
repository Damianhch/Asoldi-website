import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  PRICING,
  type MeetingQuoteState,
  adjustedPrice,
  allPaidRecurringServices,
  customBaselineIds,
  emptyMeetingQuote,
  fmtKr,
  getTier,
  grandTotal,
  includedPagesFor,
  namedPackageMonthly,
  normalizeMeetingQuote,
  packageService,
  presetIds,
  quotedMonthly,
  cappedOneTimeCharge,
  setupCost,
} from './websitePricing';

type Props = {
  businessName: string;
  notes: string;
  quote: unknown;
  saving?: boolean;
  onClose: () => void;
  onPersist: (payload: { notes: string; meetingQuote: MeetingQuoteState }) => Promise<void> | void;
  onContinue: () => void;
};

export function MeetingNotesModal({ businessName, notes, quote, saving, onClose, onPersist, onContinue }: Props) {
  const [state, setState] = useState<MeetingQuoteState>(() => normalizeMeetingQuote(quote || emptyMeetingQuote()));
  const [notater, setNotater] = useState(notes || '');
  const [savedLabel, setSavedLabel] = useState('Lagres automatisk');
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setSavedLabel('Lagrer…');
    const timer = window.setTimeout(() => {
      void Promise.resolve(persistRef.current({ notes: notater, meetingQuote: state }))
        .then(() => setSavedLabel('Lagret'))
        .catch(() => setSavedLabel('Kunne ikke lagre'));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [notater, state]);
  const selected = useMemo(() => new Set<string>(state.selected), [state.selected]);
  const oneTimeAddOns = useMemo(() => new Set<string>(state.oneTimeAddOns), [state.oneTimeAddOns]);
  const monthly = quotedMonthly(state);
  const setup = setupCost(state);
  const capped = cappedOneTimeCharge(state);
  const total = grandTotal(state);
  const tier = getTier(state.customMode ? 'custom' : state.tierId);

  function setSelected(next: Set<string>) {
    setState((prev) => ({ ...prev, selected: [...next] }));
  }

  function applyNamed(tierId: string) {
    setState((prev) => ({
      ...prev,
      tierId,
      customMode: false,
      selected: presetIds(tierId),
    }));
  }

  function applyCustom() {
    setState((prev) => ({
      ...prev,
      tierId: 'custom',
      customMode: true,
      selected: customBaselineIds(),
    }));
  }

  function toggleService(id: string) {
    const next = new Set<string>(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleOneTimeAddOn(id: string) {
    const next = new Set<string>(oneTimeAddOns);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setState((prev) => ({ ...prev, oneTimeAddOns: [...next] }));
  }

  const includedPages = includedPagesFor(state.tierId, state.customMode);

  function extraPages() {
    return Math.max(0, state.pages - includedPages);
  }

  function scalingLabel(item: { scalesWithPages?: boolean; price: number }, checked: boolean) {
    if (!item.scalesWithPages) return '—';
    const perPage = item.price * PRICING.pageScaling.ratePercent;
    const extra = extraPages();
    if (!checked || extra === 0) return `${fmtKr(perPage)}/ekstra side`;
    return `+${fmtKr(perPage * extra)} (${extra} ekstra × ${fmtKr(perPage)})`;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-3">
      <div className="w-full max-w-[1180px] max-h-[94vh] overflow-hidden rounded-2xl bg-[#1b1b1b] border border-white/10 flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div className="min-w-0">
            <h3 className="text-white font-semibold truncate">Møte — {businessName || 'kunde'}</h3>
            <p className="text-xs text-gray-400">Steg 1 av 2 · Notater og kalkulator lagres fortløpende. Neste steg er tilbudet.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/15">
            <X size={16} />
          </button>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] min-h-0 flex-1 overflow-hidden">
          <div className="overflow-y-auto p-5 space-y-4 text-sm text-gray-200">
            <label className="block">
              <span className="text-xs text-gray-400">Antall sider</span>
              <input
                type="number"
                min={1}
                value={state.pages}
                onChange={(e) => setState((prev) => ({ ...prev, pages: Math.max(1, Number(e.target.value) || 1) }))}
                className="mt-1 w-24 px-3 py-2 rounded-lg bg-[#111] border border-white/10 text-white"
              />
              <span className="ml-2 text-xs text-gray-500">
                {includedPages} inkludert i {state.customMode ? 'à la carte' : getTier(state.tierId).label}.
                {extraPages() > 0 ? ` ${extraPages()} ekstra.` : ' Ingen ekstra.'}
              </span>
            </label>

            <div>
              <div className="text-xs text-gray-400 mb-2">Pakke</div>
              <div className="space-y-1.5">
                {PRICING.tiers.map((entry) => {
                  const totalForTier = entry.id === 'custom'
                    ? quotedMonthly({ ...state, customMode: true, tierId: 'custom', selected: state.customMode ? state.selected : customBaselineIds() })
                    : namedPackageMonthly(entry.id, state.pages);
                  const checked = entry.id === 'custom' ? state.customMode : (!state.customMode && state.tierId === entry.id);
                  return (
                    <label key={entry.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="meeting-tier"
                        checked={checked}
                        onChange={() => (entry.id === 'custom' ? applyCustom() : applyNamed(entry.id))}
                        className="mt-1"
                      />
                      <span>
                        {entry.label} — {fmtKr(totalForTier)}/mnd · {entry.delivery}
                        {entry.id === 'custom' ? ' — à la carte' : ' — fast pakkepris'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400 mb-2">Engangskostnader</div>
              {PRICING.oneTimeAddOns.map((item) => (
                <label key={item.id} className="flex items-center gap-2 mb-1 cursor-pointer">
                  <input type="checkbox" checked={oneTimeAddOns.has(item.id)} onChange={() => toggleOneTimeAddOn(item.id)} />
                  {item.name} — {fmtKr(item.price)} engangs
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.oneTime}
                onChange={(e) => setState((prev) => ({ ...prev, oneTime: e.target.checked }))}
              />
              Engangsbetaling (månedspris × 9)
            </label>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-black/30 text-gray-400">
                  <tr>
                    <th className="text-left p-2">Tjeneste</th>
                    <th className="text-left p-2">Pris</th>
                    <th className="text-left p-2">Sider</th>
                    <th className="text-left p-2">Justert</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING.alwaysOn.map((item) => (
                    <tr key={item.id} className="border-t border-white/5">
                      <td className="p-2">{item.name}</td>
                      <td className="p-2">0 kr</td>
                      <td className="p-2">—</td>
                      <td className="p-2 text-emerald-300">Alltid</td>
                    </tr>
                  ))}
                  {allPaidRecurringServices().map((item) => {
                    const checked = selected.has(item.id);
                    const inPackage = packageService(state, item.id);
                    const p = adjustedPrice(item, state.pages, state.tierId, state.customMode);
                    return (
                      <tr key={item.id} className={`border-t border-white/5 ${checked ? '' : 'text-gray-500'}`}>
                        <td className="p-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={checked} onChange={() => toggleService(item.id)} />
                            {item.name}
                            {item.oneTimeMonths ? ` — engangs: ${item.oneTimeMonths} mnd` : ''}
                          </label>
                        </td>
                        <td className="p-2">{inPackage ? 'Inkl. i pakke' : fmtKr(p.base)}</td>
                        <td className="p-2">{scalingLabel(item, inPackage || checked)}</td>
                        <td className="p-2">
                          {inPackage
                            ? (p.scale > 0 ? `+${fmtKr(p.scale)}` : 'Inkl.')
                            : checked
                              ? (state.oneTime && item.oneTimeMonths ? fmtKr(item.price * item.oneTimeMonths) : fmtKr(p.total))
                              : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-gray-400">
                {state.oneTime ? `Engangssum (${tier.label}, ${state.pages} sider)` : `Månedlig (${tier.label}, ${state.pages} sider)`}
              </div>
              <div className="text-2xl font-semibold text-white mt-1">
                {state.oneTime ? fmtKr(total) : `${fmtKr(monthly)} / mnd`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {state.oneTime
                  ? `= ${fmtKr(monthly)}/mnd × ${PRICING.oneTimeMultiplier}${capped ? ` + ${fmtKr(capped)} ubegrenset 6 mnd` : ''}${setup ? ` + ${fmtKr(setup)} oppsett` : ''}`
                  : `${state.customMode ? 'À la carte' : `Pakke ${fmtKr(PRICING.packagePrices[state.tierId] || 0)}`}${setup ? ` + ${fmtKr(setup)} engangs` : ''}`}
              </div>
            </div>
          </div>

          <aside className="border-t lg:border-t-0 lg:border-l border-white/10 bg-[#161616] flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-white/10">
              <h4 className="text-white font-medium">Salgsnotater</h4>
              <p className="text-[11px] text-gray-500">Lagres på kunden. Kortet viser Notater.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <label className="block">
                <span className="text-xs text-gray-400">Custom sections</span>
                <textarea
                  value={state.customSections}
                  onChange={(e) => setState((prev) => ({ ...prev, customSections: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/10 text-sm text-white"
                  placeholder="Meny, booking, blogg, galleri…"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-400">Start date</span>
                <input
                  type="date"
                  value={state.startDate}
                  onChange={(e) => setState((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/10 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-400">Hovedprodukt og mål med nettsiden</span>
                <textarea
                  value={state.productGoal}
                  onChange={(e) => setState((prev) => ({ ...prev, productGoal: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/10 text-sm text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-400">Identitet (farger, stil, språk)</span>
                <textarea
                  value={state.identity}
                  onChange={(e) => setState((prev) => ({ ...prev, identity: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/10 text-sm text-white"
                />
              </label>
              <div className="rounded-lg border-2 border-amber-500/50 bg-amber-950/30 p-3 text-xs text-amber-100">
                <strong className="block mb-1">Validere at dette blir sendt</strong>
                Media, logo, bedriftsinfo, lenker osv.
              </div>
              <label className="block">
                <span className="text-xs text-gray-400">Notater</span>
                <textarea
                  value={notater}
                  onChange={(e) => setNotater(e.target.value)}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/10 text-sm text-white"
                  placeholder="Skriv notater her…"
                />
              </label>
            </div>
            <div className="p-4 border-t border-white/10 space-y-2">
              <p className="text-[11px] text-gray-500">{saving ? 'Lagrer…' : savedLabel}</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  void Promise.resolve(persistRef.current({ notes: notater, meetingQuote: state })).then(() => onContinue());
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200] disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Send tilbud
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
