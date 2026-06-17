import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Gift, Lock, LogOut, MessageSquare, Search, UserRound } from 'lucide-react';
import { clearClientToken } from './auth';

type ActiveItem = 'home' | 'website' | 'checkout';

type Props = {
  title: string;
  subtitle?: string;
  active: ActiveItem;
  children: React.ReactNode;
};

export function ClientShell({ title, subtitle = '', active, children }: Props) {
  const navigate = useNavigate();

  function logout() {
    clearClientToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#1a1a1a]">
      <div className="flex min-h-screen">
        <aside className="w-20 md:w-64 bg-white border-r border-[#e5e7eb] px-3 md:px-5 py-5">
          <Link to="/kunde" className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#FF5B00] text-white grid place-items-center font-bold">A</div>
            <div className="hidden md:block">
              <p className="font-semibold text-[#111827]">SHB´s Marketing HUB</p>
            </div>
          </Link>

          <nav className="space-y-1">
            <SidebarLink to="/kunde" active={active === 'home'} label="Hjem" />
            <div className="pt-2">
              <p className="hidden md:flex text-xs uppercase tracking-wide text-[#9ca3af] px-3 mb-1 items-center gap-1">
                Tjenester <ChevronRight size={12} />
              </p>
              <SidebarLink to="/kunde/services/website/builder" active={active === 'website' || active === 'checkout'} label="Nettside" />
              <SidebarLocked label="E-post" />
              <SidebarLocked label="Sosiale medier" />
            </div>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="h-20 border-b border-[#e5e7eb] bg-white px-5 md:px-8 flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold truncate">{title}</h1>
              {subtitle ? <p className="text-sm text-[#6b7280] mt-0.5 truncate">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <button className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-[#ffe5d6] text-[#f97316]">
                <Gift size={14} />
                Henvis og tjen 3.000,-
              </button>
              <HeaderIcon label="Chat" icon={<MessageSquare size={16} />} />
              <HeaderIcon label="Søk" icon={<Search size={16} />} />
              <HeaderIcon label="Profil" icon={<UserRound size={16} />} />
              <button
                type="button"
                onClick={logout}
                className="px-3 py-2 rounded-lg bg-[#111827] text-white text-sm hover:bg-black transition-colors"
              >
                <span className="hidden md:inline-flex items-center gap-2"><LogOut size={14} /> Logg ut</span>
                <span className="md:hidden"><LogOut size={14} /></span>
              </button>
            </div>
          </header>

          <main className="p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ to, active, label }: { to: string; active: boolean; label: string }) {
  return (
    <Link
      to={to}
      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-[#fff1e8] text-[#f97316]'
          : 'text-[#374151] hover:bg-[#f9fafb]'
      }`}
    >
      <span>{label}</span>
      {label === 'Nettside' ? <ChevronRight size={14} /> : null}
    </Link>
  );
}

function SidebarLocked({ label }: { label: string }) {
  return (
    <div className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#9ca3af] cursor-not-allowed">
      <span>{label}</span>
      <Lock size={12} />
    </div>
  );
}

function HeaderIcon({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      className="w-10 h-10 grid place-items-center rounded-full border border-[#e5e7eb] text-[#4b5563] hover:bg-[#f9fafb]"
    >
      {icon}
    </button>
  );
}
