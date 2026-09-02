import React from 'react';
import { Edit2, Globe, Key, Plus, Trash2, UserRound } from 'lucide-react';
import type { Site } from '../shared';
import { WEBSITE_PLAN_OPTIONS } from '../shared';

type Props = {
  sites: Site[];
  loading: boolean;
  copyKey: string | null;
  onAdd: () => void;
  onEdit: (site: Site) => void;
  onEditAdmin?: (site: Site) => void;
  onDelete: (id: string) => void;
  onCopyKey: (key: string) => void;
  hideHeader?: boolean;
};

function planLabel(planId?: string) {
  return WEBSITE_PLAN_OPTIONS.find((plan) => plan.id === planId)?.name || 'Tier 1: Standard';
}

function catalogLabel(type?: string | null) {
  if (type === 'menu') return 'Menu';
  if (type === 'tiers') return 'Tiers';
  if (type === 'normal') return 'Products';
  return '';
}

function formatSeen(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function ClientSitesSection({ sites, loading, copyKey, onAdd, onEdit, onEditAdmin, onDelete, onCopyKey, hideHeader = false }: Props) {
  return (
    <div className="max-w-4xl">
      {!hideHeader && (
        <>
          <h1 className="text-2xl font-bold text-white mb-2">Manage clients</h1>
          <p className="text-gray-400 text-sm mb-6">Client sites in the hub. Add a site to get a site key for client CMS. Plan and ecommerce catalog type control what the client sees at domain.com/admin.</p>
        </>
      )}
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
              <p className="text-gray-500 text-xs mt-1">{planLabel(site.websitePlan)}</p>
              <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                <Key size={12} /> <code className="bg-black/30 px-1 rounded">{site.site_key}</code>
                <button type="button" onClick={() => onCopyKey(site.site_key)} className="text-[#FF5B00] hover:underline ml-1">
                  {copyKey === site.site_key ? 'Copied!' : 'Copy'}
                </button>
              </p>
              {(site.cms?.packageVersion || site.cms?.lastSeenAt || site.cms?.githubRepo) && (
                <p className="text-gray-500 text-xs mt-1">
                  {site.cms?.packageVersion ? `CMS ${site.cms.packageVersion}` : 'CMS version unknown'}
                  {site.cms?.lastSeenAt ? ` · seen ${formatSeen(site.cms.lastSeenAt)}` : ' · not seen yet'}
                  {site.cms?.githubRepo ? ` · ${site.cms.githubRepo}` : ''}
                </p>
              )}
              {site.cms?.adminUrl && (
                <a href={site.cms.adminUrl} target="_blank" rel="noreferrer" className="text-xs text-[#FF5B00] hover:underline">
                  Open client admin
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs flex-wrap justify-end max-w-[220px]">
              {site.features?.users && <FeatureBadge label="Users" color="green" />}
              {site.features?.analytics && <FeatureBadge label="Analytics" color="blue" />}
              {site.features?.ecommerce && (
                <FeatureBadge label={site.ecommerceCatalogType ? `Ecommerce · ${catalogLabel(site.ecommerceCatalogType)}` : 'Ecommerce'} color="purple" />
              )}
              {site.features?.blog && <FeatureBadge label="Blog" color="orange" />}
              {site.features?.socialSync && <FeatureBadge label="Social" color="teal" />}
              {site.features?.emailMarketing && <FeatureBadge label="Email" color="pink" />}
              {site.features?.general && <FeatureBadge label="General" color="gray" />}
            </div>
            <div className="flex items-center gap-2">
              {onEditAdmin && (
                <button type="button" onClick={() => onEditAdmin(site)} title="Client admin user" className="p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white">
                  <UserRound size={18} />
                </button>
              )}
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

function FeatureBadge({ label, color }: { label: string; color: 'green' | 'blue' | 'purple' | 'orange' | 'teal' | 'pink' | 'gray' }) {
  const classes = {
    green: 'bg-green-900/50 text-green-300',
    blue: 'bg-blue-900/50 text-blue-300',
    purple: 'bg-purple-900/50 text-purple-300',
    orange: 'bg-orange-900/50 text-orange-300',
    teal: 'bg-teal-900/50 text-teal-300',
    pink: 'bg-pink-900/50 text-pink-300',
    gray: 'bg-gray-700/60 text-gray-200',
  };
  return <span className={`px-2 py-1 rounded ${classes[color]}`}>{label}</span>;
}
