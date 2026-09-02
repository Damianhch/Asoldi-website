import React, { useState } from 'react';
import { ClientSitesSection } from './ClientSitesSection';
import { SalesClientsSection } from './SalesClientsSection';
import type { ManageClientsView, Site } from '../shared';

type Props = {
  sites: Site[];
  loading: boolean;
  copyKey: string | null;
  onAdd: () => void;
  onEdit: (site: Site) => void;
  onEditAdmin?: (site: Site) => void;
  onDelete: (id: string) => void;
  onCopyKey: (key: string) => void;
};

export function ManageClientsSection({
  sites,
  loading,
  copyKey,
  onAdd,
  onEdit,
  onEditAdmin,
  onDelete,
  onCopyKey,
}: Props) {
  const [view, setView] = useState<ManageClientsView>('clients');

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Manage clients</h1>
        <p className="text-gray-400 text-sm">Track active hub clients and move sales prospects into delivery when they are ready.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView('clients')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'clients' ? 'bg-[#FF5B00] text-white' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}
        >
          Clients
        </button>
        <button
          type="button"
          onClick={() => setView('sales')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'sales' ? 'bg-[#FF5B00] text-white' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}
        >
          Sales
        </button>
      </div>

      {view === 'clients' ? (
        <ClientSitesSection
          sites={sites}
          loading={loading}
          copyKey={copyKey}
          onAdd={onAdd}
          onEdit={onEdit}
          onEditAdmin={onEditAdmin}
          onDelete={onDelete}
          onCopyKey={onCopyKey}
          hideHeader
        />
      ) : (
        <SalesClientsSection onPromotedToClient={() => setView('clients')} />
      )}
    </div>
  );
}
