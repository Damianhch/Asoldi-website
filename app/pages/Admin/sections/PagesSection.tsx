import React from 'react';
import { ExternalLink } from 'lucide-react';
import { SITE_PAGES } from '../shared';

export function PagesSection() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-2">Pages</h1>
      <p className="text-gray-400 text-sm mb-6">Quick navigation to all pages on this site.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SITE_PAGES.map((page) => (
          <a
            key={page.path}
            href={page.path}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-[#2a2a2a] border border-white/10 px-4 py-3 hover:border-[#FF5B00]/50 transition-colors group"
          >
            <span className="text-white font-medium">{page.label}</span>
            <ExternalLink size={16} className="text-gray-400 group-hover:text-[#FF5B00]" />
          </a>
        ))}
      </div>
    </div>
  );
}
