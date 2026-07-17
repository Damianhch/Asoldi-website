import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Gift, MessageSquare, Search, UserCircle2, ChevronRight, LogOut, Settings, CreditCard } from 'lucide-react';
import { useClientAuth } from '../../contexts/ClientAuthContext';

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

function SidebarLink({
  to,
  label,
  active,
  hasChevron = false,
}: {
  to: string;
  label: string;
  active: boolean;
  hasChevron?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-white text-[#111827] shadow-sm' : 'text-[#30353D] hover:bg-white/80'
      }`}
    >
      <span>{label}</span>
      {hasChevron ? <ChevronRight size={14} /> : null}
    </Link>
  );
}

export function ClientPortalLayout({ children, title, subtitle }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, clearClientSession } = useClientAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const isHome = location.pathname === '/kunde' || location.pathname === '/kunde/hjem';
  const isServices = location.pathname.startsWith('/kunde/tjenester');
  const isSettings = location.pathname.startsWith('/kunde/innstillinger');

  useEffect(() => {
    if (!profileMenuOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [profileMenuOpen]);

  function logout() {
    clearClientSession();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-[#111827]">
      <div className="mx-auto max-w-[1460px] min-h-screen flex">
        <aside className="w-[220px] border-r border-[#E7E9EE] bg-[#F3F4F6] px-4 py-5 flex flex-col">
          <Link
            to="/kunde/hjem"
            className="flex items-center gap-3 mb-8 rounded-xl -mx-1 px-1 py-1 transition-colors hover:bg-white/70"
            aria-label="Til hjem"
          >
            <div className="w-10 h-10 rounded-xl bg-[#FF5B00] text-white flex items-center justify-center font-bold">A</div>
            <div>
              <p className="text-sm font-semibold">Asoldi HUB</p>
              <p className="text-xs text-[#6B7280]">Kundeportal</p>
            </div>
          </Link>

          <nav className="space-y-2">
            <SidebarLink to="/kunde/hjem" label="Hjem" active={isHome} />
            <SidebarLink to="/kunde/tjenester" label="Tjenester" active={isServices} hasChevron />
            {isServices ? (
              <div className="ml-3 mt-2 space-y-1 border-l border-[#E5E7EB] pl-3">
                <Link to="/kunde/tjenester" className={`block rounded-md px-2 py-1.5 text-xs ${location.pathname === '/kunde/tjenester' ? 'bg-white text-[#111827] font-medium' : 'text-[#4B5563] hover:bg-white/70'}`}>Nettside</Link>
                <span className="block rounded-md px-2 py-1.5 text-xs text-[#9CA3AF]">E-post (låst)</span>
                <span className="block rounded-md px-2 py-1.5 text-xs text-[#9CA3AF]">Sosiale medier (låst)</span>
              </div>
            ) : null}
          </nav>
          <div className="mt-auto pt-5">
            <SidebarLink to="/kunde/innstillinger" label="Innstillinger" active={isSettings} />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="h-[72px] bg-white border-b border-[#E7E9EE] px-6 flex items-center justify-between">
            <div>
              {title ? <h1 className="text-lg font-semibold">{title}</h1> : null}
              {subtitle ? <p className="text-xs text-[#6B7280]">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="inline-flex items-center gap-2 rounded-full bg-[#FFE7DA] px-4 py-2 text-sm text-[#FF5B00]">
                <Gift size={14} />
                Verv og tjen 3.000,-
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] px-3 py-2 text-sm bg-white">
                <MessageSquare size={14} />
                Chat
              </button>
              <button type="button" className="rounded-full border border-[#E5E7EB] p-2 bg-white" aria-label="Søk">
                <Search size={16} />
              </button>
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="rounded-full border border-[#E5E7EB] p-2 bg-white"
                  aria-label="Bruker"
                >
                  <UserCircle2 size={18} />
                </button>
                {profileMenuOpen ? (
                  <div className="absolute right-0 mt-2 min-w-[240px] rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-lg">
                    <p className="text-sm font-medium">{profile?.name || 'Kunde'}</p>
                    <p className="text-xs text-[#6B7280]">{profile?.email || ''}</p>
                    <div className="mt-3 space-y-1">
                      <Link
                        to="/kunde/innstillinger"
                        onClick={() => setProfileMenuOpen(false)}
                        className="inline-flex w-full items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB]"
                      >
                        <Settings size={14} />
                        Innstillinger
                      </Link>
                      <Link
                        to="/kunde/innstillinger/fakturering"
                        onClick={() => setProfileMenuOpen(false)}
                        className="inline-flex w-full items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB]"
                      >
                        <CreditCard size={14} />
                        Fakturering
                      </Link>
                      <button
                        type="button"
                        onClick={logout}
                        className="inline-flex w-full items-center gap-2 rounded-lg border border-[#F3D2C0] px-3 py-2 text-sm text-[#B45309] hover:bg-[#FFF7ED]"
                      >
                        <LogOut size={14} />
                        Logg ut
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
