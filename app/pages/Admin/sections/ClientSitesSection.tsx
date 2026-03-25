import React from 'react';
import { Edit2, Globe, Key, Plus, Trash2 } from 'lucide-react';
import type { Features, Site } from '../shared';

type Props = {
  sites: Site[];
  loading: boolean;
  copyKey: string | null;
  onAdd: () => void;
  onEdit: (site: Site) => void;
  onDelete: (id: string) => void;
  onCopyKey: (key: string) => void;
};

export function ClientSitesSection({ sites, loading, copyKey, onAdd, onEdit, onDelete, onCopyKey }: Props) {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-2">Manage clients</h1>
      <p className="text-gray-400 text-sm mb-6">Client sites in the hub. Add a site to get a site key for client CMS.</p>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Sites</h2>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200]"
        >
          <Plus size={18} /> Add site
        </button>
      </div>

      <div className="space-y-4">
        {sites.map((site) => (
          <div key={site.id} className="rounded-xl bg-[#2a2a2a] border border-white/10 p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">{site.name || 'Unnamed'}</p>
              <p className="text-gray-400 text-sm flex items-center gap-1">
                <Globe size={14} /> {site.domain || '—'}
              </p>
              <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                <Key size={12} /> <code className="bg-black/30 px-1 rounded">{site.site_key}</code>
                <button type="button" onClick={() => onCopyKey(site.site_key)} className="text-[#FF5B00] hover:underline ml-1">
                  {copyKey === site.site_key ? 'Copied!' : 'Copy'}
                </button>
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {site.features?.users && <FeatureBadge label="Users" color="green" />}
              {site.features?.analytics && <FeatureBadge label="Analytics" color="blue" />}
              {site.features?.ecommerce && <FeatureBadge label="Ecommerce" color="purple" />}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onEdit(site)} className="p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white">
                <Edit2 size={18} />
              </button>
              <button type="button" onClick={() => onDelete(site.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-900/20">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && sites.length === 0 && (
        <p className="text-gray-400 text-center py-8">No sites yet. Add one to get a site key for client CMS.</p>
      )}
    </div>
  );
}

function FeatureBadge({ label, color }: { label: string; color: 'green' | 'blue' | 'purple' }) {
  const classes = {
    green: 'bg-green-900/50 text-green-300',
    blue: 'bg-blue-900/50 text-blue-300',
    purple: 'bg-purple-900/50 text-purple-300',
  };
  return <span className={`px-2 py-0.5 rounded ${classes[color]}`}>{label}</span>;
}
