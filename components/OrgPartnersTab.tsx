"use client";
import { useEffect, useState } from 'react';
import { getOrgProjects } from '@/lib/dal';
import {
  BuildingOfficeIcon,
  UserIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface Partner {
  uid: string;
  name: string;
  email: string;
  type: 'individual' | 'organization';
  supportType: 'full-grant' | 'pledge' | 'request-info' | 'other';
  message?: string;
  addedAt: string;
  pledgeAmount?: number;
  currency?: string;
  organizationId?: string;
  organizationDbId?: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  // enriched at display time
  projectId?: string;
  projectName?: string;
  projectDocId?: string;
}

interface OrgPartnersTabProps {
  org: any;
  isOwner: boolean;
}

const SUPPORT_LABELS: Record<string, string> = {
  'full-grant': 'Full Grant',
  'pledge': 'Pledge',
  'request-info': 'Request Info',
  'other': 'Other',
};

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function OrgPartnersTab({ org, isOwner }: OrgPartnersTabProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'organization'>('all');
  const [filterSupport, setFilterSupport] = useState<'all' | string>('all');

  useEffect(() => {
    if (!org?.orgId) return;
    let cancelled = false;
    setLoading(true);

    async function fetchPartners() {
      try {
        // Fetch all projects belonging to this org
        const projects = await getOrgProjects(org.orgId);
        const allPartners: Partner[] = [];
        projects.forEach((data: any) => {
          if (Array.isArray(data.partners)) {
            data.partners.forEach((p: any) => {
              allPartners.push({
                ...p,
                projectDocId: data.id,
                projectId: data.projectId || data.id,
                projectName: data.name || data.projectName || 'Unnamed Project',
              });
            });
          }
        });
        if (!cancelled) setPartners(allPartners);
      } catch (e) {
        console.error('Error fetching org partners:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPartners();
    return () => { cancelled = true; };
  }, [org?.orgId]);

  // Filtered view
  const filtered = partners.filter(p => {
    if (filterType !== 'all' && p.type !== filterType) return false;
    if (filterSupport !== 'all' && p.supportType !== filterSupport) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(s) ||
        p.email?.toLowerCase().includes(s) ||
        p.organizationName?.toLowerCase().includes(s) ||
        p.projectName?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Summary stats
  const totalPledged = partners.reduce((sum, p) => sum + (p.pledgeAmount || 0), 0);
  const orgPartners = partners.filter(p => p.type === 'organization');
  const indyPartners = partners.filter(p => p.type === 'individual');

  return (
    <div className="flex flex-col gap-4 p-4 min-h-[300px]">

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Total Partners</span>
          <span className="text-2xl font-bold text-white">{partners.length}</span>
          <span className="text-xs text-gray-500">{orgPartners.length} org · {indyPartners.length} individual</span>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Total Pledged</span>
          <span className="text-2xl font-bold text-orange-400">
            {totalPledged > 0 ? formatCurrency(totalPledged, partners.find(p => p.currency)?.currency || 'USD') : '—'}
          </span>
          <span className="text-xs text-gray-500">across all projects</span>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Projects with Partners</span>
          <span className="text-2xl font-bold text-white">
            {new Set(partners.map(p => p.projectDocId)).size}
          </span>
          <span className="text-xs text-gray-500">of your projects</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search partners..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex items-center gap-1 text-sm">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="all">All types</option>
            <option value="individual">Individual</option>
            <option value="organization">Organisation</option>
          </select>
          <select
            value={filterSupport}
            onChange={e => setFilterSupport(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="all">All support types</option>
            <option value="pledge">Pledge</option>
            <option value="full-grant">Full Grant</option>
            <option value="request-info">Request Info</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Partner List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
          Loading partners...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <BuildingOfficeIcon className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {partners.length === 0
              ? 'No partners have joined your projects yet.'
              : 'No partners match your filters.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((partner, idx) => (
            <PartnerCard key={`${partner.uid}-${partner.projectDocId}-${idx}`} partner={partner} isOwner={isOwner} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartnerCard({ partner, isOwner }: { partner: Partner; isOwner: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const isOrg = partner.type === 'organization';
  const displayName = isOrg ? (partner.organizationName || partner.name) : partner.name;
  const initial = displayName?.[0]?.toUpperCase() || '?';

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Avatar / Logo */}
        {isOrg && partner.organizationLogoUrl ? (
          <img
            src={partner.organizationLogoUrl}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
          />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isOrg ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
            {isOrg ? <BuildingOfficeIcon className="w-5 h-5" /> : initial}
          </div>
        )}

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900 truncate">{displayName}</span>
            {isOrg && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">Organisation</span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {SUPPORT_LABELS[partner.supportType] || partner.supportType}
            </span>
            {partner.pledgeAmount != null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                {formatCurrency(partner.pledgeAmount, partner.currency)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <FolderIcon className="w-3 h-3" />
              {partner.projectName}
            </span>
            <span>{timeAgo(partner.addedAt)}</span>
          </div>
        </div>

        {/* Expand chevron */}
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-50 bg-gray-50/50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {!isOrg && (
              <div>
                <span className="text-xs text-gray-400 block">Name</span>
                <span className="text-gray-800">{partner.name}</span>
              </div>
            )}
            {partner.email && isOwner && (
              <div>
                <span className="text-xs text-gray-400 block">Email</span>
                <a href={`mailto:${partner.email}`} className="text-orange-600 hover:underline text-sm">
                  {partner.email}
                </a>
              </div>
            )}
            {isOrg && partner.organizationId && (
              <div>
                <span className="text-xs text-gray-400 block">Organisation ID</span>
                <a href={`/org/${partner.organizationId}`} className="text-orange-600 hover:underline text-sm">
                  {partner.organizationId}
                </a>
              </div>
            )}
            <div>
              <span className="text-xs text-gray-400 block">Support Type</span>
              <span className="text-gray-800">{SUPPORT_LABELS[partner.supportType] || partner.supportType}</span>
            </div>
            {partner.pledgeAmount != null && (
              <div>
                <span className="text-xs text-gray-400 block">Amount</span>
                <span className="text-gray-800 font-semibold">{formatCurrency(partner.pledgeAmount, partner.currency)}</span>
              </div>
            )}
            <div>
              <span className="text-xs text-gray-400 block">Project</span>
              <a href={`/projects/${partner.projectId}/proposal`} className="text-orange-600 hover:underline text-sm">
                {partner.projectName}
              </a>
            </div>
            <div>
              <span className="text-xs text-gray-400 block">Joined</span>
              <span className="text-gray-800">{new Date(partner.addedAt).toLocaleDateString()}</span>
            </div>
          </div>
          {partner.message && (
            <div className="mt-3">
              <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                <ChatBubbleLeftIcon className="w-3 h-3" /> Message
              </span>
              <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-100 italic">
                "{partner.message}"
              </p>
            </div>
          )}
          {isOwner && (
            <div className="mt-3 flex gap-2">
              {partner.email && (
                <a
                  href={`mailto:${partner.email}?subject=Re: ${encodeURIComponent(partner.projectName || 'your project partnership')}`}
                  className="text-xs px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
                >
                  Contact
                </a>
              )}
              {isOrg && partner.organizationId && (
                <a
                  href={`/org/${partner.organizationId}`}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-colors"
                >
                  View Organisation
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
