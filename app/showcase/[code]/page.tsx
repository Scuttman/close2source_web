"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getShowcaseByCode, getProject } from '@/lib/dal';
import type { ShowcaseDoc, ProjectDoc } from '@/lib/dal';
import PageShell from 'components/PageShell';
import ProfileLoadingShell from 'components/ProfileLoadingShell';
import { RectangleGroupIcon, MapPinIcon } from '@heroicons/react/24/outline';

type FullProject = ProjectDoc & { id: string };
type FullShowcase = ShowcaseDoc & { id: string };

export default function ShowcasePage() {
  const params = useParams();
  const code = (params.code as string || '').toUpperCase();

  const [showcase, setShowcase] = useState<FullShowcase | null>(null);
  const [projects, setProjects] = useState<FullProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const sc = await getShowcaseByCode(code);
        if (!sc) { if (!cancelled) { setError('Showcase not found.'); setLoading(false); } return; }
        if (!cancelled) setShowcase(sc);

        // Load the projects in parallel, then keep only live ones
        const fetched = await Promise.all(
          (sc.projectDocIds || []).map(id => getProject(id)),
        );
        if (!cancelled) {
          setProjects(
            fetched
              .filter((p): p is FullProject => p !== null)
              .filter(p => p.status === 'live'),
          );
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) { setError(e.message || 'Failed to load showcase.'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  if (loading) return <ProfileLoadingShell title="Showcase" />;

  if (error || !showcase) {
    return (
      <PageShell title={<span>Showcase</span>}>
        <div className="p-6 text-sm text-red-600">{error || 'Showcase not found.'}</div>
      </PageShell>
    );
  }

  return (
    <PageShell title={<span>{showcase.title}</span>}>
      <div className="space-y-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="inline-block mb-3 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full uppercase tracking-wider">
                Project Showcase
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{showcase.title}</h1>
              {showcase.description && (
                <p className="text-gray-600 text-base leading-relaxed max-w-2xl">{showcase.description}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-gray-500 mb-1">Showcase Code</div>
              <div className="font-mono font-bold text-lg text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
                {showcase.showcaseId}
              </div>
            </div>
          </div>

          {/* Share link */}
          <div className="mt-6 flex items-center gap-3">
            <span className="text-xs text-gray-500">Share link:</span>
            <button
              onClick={() => {
                const url = `${window.location.origin}/showcase/${showcase.showcaseId}`;
                navigator.clipboard.writeText(url).catch(() => {});
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition font-mono"
            >
              {typeof window !== 'undefined' ? `${window.location.origin}/showcase/${showcase.showcaseId}` : `/showcase/${showcase.showcaseId}`}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Project Count */}
        <div className="flex items-center gap-2">
          <RectangleGroupIcon className="w-5 h-5 text-orange-500" />
          <span className="text-sm font-semibold text-gray-700">
            {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
          </span>
        </div>

        {/* Project Cards — grouped by location when multiple locations present */}
        {projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <RectangleGroupIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">No live projects in this showcase.</p>
          </div>
        ) : (
          <LocationGroupedProjects projects={projects} />
        )}
      </div>
    </PageShell>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a stable location key and human-readable label for a project. */
function locationInfo(project: FullProject): { key: string; label: string } {
  const loc = project.location;
  if (!loc) return { key: '', label: '' };
  const town    = loc.town    || loc.name    || '';
  const country = loc.country || '';
  const key     = [town, country].filter(Boolean).join('||');
  const label   = [town, country].filter(Boolean).join(', ');
  return { key, label };
}

/** Group projects by location key, preserving insertion order. */
function groupByLocation(
  projects: FullProject[],
): { key: string; label: string; items: FullProject[] }[] {
  const map = new Map<string, { key: string; label: string; items: FullProject[] }>();
  for (const p of projects) {
    const { key, label } = locationInfo(p);
    if (!map.has(key)) map.set(key, { key, label, items: [] });
    map.get(key)!.items.push(p);
  }
  return Array.from(map.values());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: FullProject }) {
  return (
    <a
      href={`/projects/${project.projectId || project.id}/proposal`}
      className="group rounded-2xl overflow-hidden border border-gray-200 bg-white hover:shadow-lg transition flex flex-col"
    >
      {project.coverPhotoUrl ? (
        <img src={project.coverPhotoUrl} alt={project.name} className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center">
          <RectangleGroupIcon className="w-12 h-12 text-orange-200" />
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col">
        {project.projectId && (
          <span className="text-xs font-mono text-gray-400 mb-2">{project.projectId}</span>
        )}

        <h3 className="text-base font-bold text-gray-900 group-hover:text-orange-600 transition mb-1 line-clamp-2">
          {project.name}
        </h3>

        {project.description && (
          <p className="text-sm text-gray-500 line-clamp-3 flex-1 mb-3">{project.description}</p>
        )}

        {(project.location?.name || project.location?.town) && (
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-auto mb-2">
            <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
            {project.location.town || project.location.name}
            {project.location.country ? `, ${project.location.country}` : ''}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center text-xs font-semibold text-orange-600 group-hover:text-orange-700 transition">
          View Project
          <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </a>
  );
}

function ProjectGrid({ projects }: { projects: FullProject[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map(p => <ProjectCard key={p.id} project={p} />)}
    </div>
  );
}

function LocationGroupedProjects({ projects }: { projects: FullProject[] }) {
  const groups = groupByLocation(projects);

  // Single group (same or no location) — plain grid, no headings
  if (groups.length <= 1) {
    return <ProjectGrid projects={projects} />;
  }

  return (
    <div className="space-y-12">
      {groups.map(group => (
        <section key={group.key || '__no_location__'}>
          {/* Section heading — bold black, matching project proposal heading style */}
          <div className="mb-6 pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <MapPinIcon className="w-5 h-5 text-gray-800 shrink-0" />
              <h2 className="text-xl font-bold text-black uppercase tracking-wide leading-none">
                {group.label || 'Other'}
              </h2>
              <span className="ml-auto text-sm font-semibold text-gray-500">
                {group.items.length} {group.items.length === 1 ? 'project' : 'projects'}
              </span>
            </div>
          </div>
          <ProjectGrid projects={group.items} />
        </section>
      ))}
    </div>
  );
}
