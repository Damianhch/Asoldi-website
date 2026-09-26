type Step = 1 | 2 | 3;

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Kundekort' },
  { step: 2, label: 'Produktnotater' },
  { step: 3, label: 'Tilbud' },
];

export function SalesFlowSteps({ step, onStep }: { step: Step; onStep: (step: Step) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {STEPS.map((item) => (
        item.step === step ? (
          <span key={item.step} className="rounded-xl bg-[#FF5B00] text-white px-3 py-3 text-sm font-semibold text-center">
            {item.step} · {item.label}
          </span>
        ) : (
          <button
            key={item.step}
            type="button"
            onClick={() => onStep(item.step)}
            className="rounded-xl border-2 border-[#E6E9EF] bg-white px-3 py-3 text-sm font-semibold text-center text-[#111827] hover:border-[#FF5B00] hover:text-[#FF5B00]"
          >
            {item.step} · {item.label}
          </button>
        )
      ))}
    </div>
  );
}
