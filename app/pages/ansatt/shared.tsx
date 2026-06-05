import React from 'react';

export const CALENDAR_EMBED =
  'https://calendar.google.com/calendar/embed?src=daracha777%40gmail.com&ctz=Europe%2FOslo&mode=WEEK';

export type StatItem = { value: string; label: string };

export function CalendarSection() {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-white mb-4">Booking informasjon</h2>
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#1a1a1a]">
        <iframe
          title="Kalender"
          src={CALENDAR_EMBED}
          style={{ border: 0, width: '100%', minHeight: 400 }}
          width="800"
          height="600"
        />
      </div>
    </section>
  );
}

export function AboutUsSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Hvem er vi</h2>
      <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 md:p-8 mb-6">
        <div className="space-y-4 text-gray-300 text-base md:text-lg leading-relaxed">{children}</div>
      </div>
    </section>
  );
}

export function InfoCards({
  targetAudience,
  goal,
}: {
  targetAudience: React.ReactNode;
  goal: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
      <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Målgruppe</h3>
        <div className="text-gray-400 text-sm leading-relaxed">{targetAudience}</div>
      </div>
      <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Mål</h3>
        <div className="text-gray-400 text-sm leading-relaxed">{goal}</div>
      </div>
    </div>
  );
}

export function StatsRow({ stats }: { stats: readonly StatItem[] }) {
  return (
    <section className="mb-10">
      <div className={`grid gap-4 grid-cols-2 ${stats.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-[#1a1a1a] border border-white/10 p-5 text-center"
          >
            <p className="text-2xl md:text-3xl font-bold text-[#FF5B00] mb-2">{stat.value}</p>
            <p className="text-gray-400 text-sm leading-snug">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ServiceCards({
  title,
  items,
}: {
  title: string;
  items: readonly { title: string; body: string }[];
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item) => (
          <div key={item.title} className="rounded-xl bg-[#1a1a1a] border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
            <p className="text-gray-400 text-sm">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
