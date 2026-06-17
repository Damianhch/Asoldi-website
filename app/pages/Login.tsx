import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Users } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export const Login = () => {
  return (
    <>
      <Helmet>
        <title>Velg innlogging – Asoldi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen bg-[#F8F9FB] px-6 py-10 flex items-center">
        <div className="max-w-[1140px] mx-auto w-full grid lg:grid-cols-[1.1fr_1fr] rounded-[28px] overflow-hidden border border-[#E6E9EF] bg-white shadow-[0_20px_50px_rgba(17,24,39,0.06)]">
          <div className="p-10 lg:p-12 bg-gradient-to-br from-[#FFF3EC] via-[#FFF8F5] to-white border-b lg:border-b-0 lg:border-r border-[#F1DACC]">
            <img src="/media/client-flow/login-hero.svg" alt="Asoldi login illustration" className="w-full rounded-2xl border border-[#F5D8C8]" />
            <h1 className="mt-6 text-3xl font-semibold text-[#111827]">Velg hvordan du vil logge inn</h1>
            <p className="mt-3 text-sm text-[#6B7280]">
              Kundeportal for oppfølging av leveranse eller ansattportal for intern drift.
            </p>
          </div>

          <div className="p-10 lg:p-12 space-y-4">
            <RoleCard
              to="/login/kunde"
              title="Jeg er kunde"
              description="Følg onboarding, velg plan og se fremdrift i kundeportalen."
              icon={<Building2 size={22} />}
            />
            <RoleCard
              to="/login/ansatt"
              title="Jeg er ansatt"
              description="Logg inn for å håndtere kundeflyter, møter og oppfølging."
              icon={<Users size={22} />}
            />
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] mt-4">
              <ArrowRight size={14} className="rotate-180" />
              Tilbake til nettsiden
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

function RoleCard({
  to,
  title,
  description,
  icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-5 hover:border-[#FF5B00]/40 hover:bg-[#FFF8F4] transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-[#FFF0E8] text-[#FF5B00] flex items-center justify-center">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
          <p className="mt-1 text-sm text-[#6B7280]">{description}</p>
        </div>
        <ArrowRight size={16} className="text-[#9CA3AF] mt-1" />
      </div>
    </Link>
  );
}
