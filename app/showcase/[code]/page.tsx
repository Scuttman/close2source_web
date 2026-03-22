"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getShowcaseByCode, getProject, updateShowcase, getUserProjects, deleteShowcase, getOrg, getOrgProjects } from '@/lib/dal';
import type { ShowcaseDoc, ProjectDoc } from '@/lib/dal';
import { getAuth } from 'firebase/auth';
import PageShell from 'components/PageShell';
import Image from 'next/image';
import ProfileLoadingShell from 'components/ProfileLoadingShell';
import { MapPreview } from 'components/MapPreview';
import { getCountryCenter, isSensitiveLocation } from '@/lib/countryHelpers';
import { RectangleGroupIcon, MapPinIcon, PencilIcon, CheckIcon, TrashIcon, PlusIcon, XMarkIcon, CurrencyDollarIcon, ShareIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

type FullProject = ProjectDoc & { id: string };
type FullShowcase = ShowcaseDoc & { id: string };
type ShowcaseLocation = {
  orgId: string;
  orgDbId: string;
  locationId: string;
  locationName: string;
  orgName: string;
  location: any;
  vision?: string;
  whatWeDo?: string;
  projects?: FullProject[];
};

export default function ShowcasePage() {
  const params = useParams();
  const code = (params.code as string || '').toUpperCase();

  const [showcase, setShowcase] = useState<FullShowcase | null>(null);
  const [projects, setProjects] = useState<FullProject[]>([]);
  const [locations, setLocations] = useState<ShowcaseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Auth & edit state
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editProjectDocIds, setEditProjectDocIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [userProjects, setUserProjects] = useState<FullProject[]>([]);
  const [loadingUserProjects, setLoadingUserProjects] = useState(false);
  // All fetched projects (for showing names in edit mode)
  const [allFetchedProjects, setAllFetchedProjects] = useState<FullProject[]>([]);

  // Listen for auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = auth.onAuthStateChanged(u => setCurrentUid(u?.uid || null));
    return () => unsub();
  }, []);

  const isOwner = !!(currentUid && showcase && showcase.ownerUid === currentUid);

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

        // Handle different showcase types
        if (sc.type === 'locations' && sc.locationEntries) {
          // Load locations from organizations, plus their live projects
          const locationResults = await Promise.allSettled(
            sc.locationEntries.map(async (entry) => {
              const [org, orgProjects] = await Promise.all([
                getOrg(entry.orgDbId),
                getOrgProjects(entry.orgId).catch(() => [] as FullProject[]),
              ]);
              if (!org) return null;
              const location = org.locations?.find((loc: any) => loc.id === entry.locationId);
              if (!location) return null;
              const locationName: string = location.name;
              const liveProjects = (orgProjects as FullProject[]).filter(
                (p: any) =>
                  p.locationName === locationName &&
                  (p.status ?? 'live') === 'live' &&
                  (p.visibility ?? 'public') === 'public',
              );
              return {
                orgId: entry.orgId,
                orgDbId: entry.orgDbId,
                locationId: entry.locationId,
                locationName,
                orgName: org.name,
                location: location,
                vision: location.vision,
                whatWeDo: location.whatWeDo,
                projects: liveProjects,
              };
            })
          );
          if (!cancelled) {
            const validLocations: ShowcaseLocation[] = [];
            for (const result of locationResults) {
              if (result.status === 'fulfilled' && result.value !== null) {
                validLocations.push(result.value);
              }
            }
            setLocations(validLocations);
            setLoading(false);
          }
        } else {
          // Load projects (default behavior)
          const docIds = sc.projectDocIds || [];
          const results = await Promise.allSettled(
            docIds.map(id => getProject(id)),
          );
          if (!cancelled) {
            const allProjects = results
              .filter((r): r is PromiseFulfilledResult<FullProject> =>
                r.status === 'fulfilled' && r.value !== null)
              .map(r => r.value);
            setAllFetchedProjects(allProjects);
            // Only hide draft projects for non-owners
            setProjects(allProjects);
            setLoading(false);
          }
        }
      } catch (e: any) {
        if (!cancelled) { setError(e.message || 'Failed to load showcase.'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  // Enter edit mode
  const startEditing = () => {
    if (!showcase) return;
    setEditTitle(showcase.title);
    setEditDesc(showcase.description || '');
    setEditProjectDocIds([...showcase.projectDocIds]);
    setEditing(true);
    setShowAddPicker(false);
  };

  // Save edits
  const handleSave = async () => {
    if (!showcase) return;
    setSaving(true);
    try {
      await updateShowcase(showcase.id, {
        title: editTitle.trim() || showcase.title,
        ...(editDesc.trim() ? { description: editDesc.trim() } : {}),
        projectDocIds: editProjectDocIds,
      });
      // Refresh data
      const updated = await getShowcaseByCode(code);
      if (updated) {
        setShowcase(updated);
        const results = await Promise.allSettled(
          (updated.projectDocIds || []).map(id => getProject(id)),
        );
        const validProjects = results
          .filter((r): r is PromiseFulfilledResult<FullProject> =>
            r.status === 'fulfilled' && r.value !== null)
          .map(r => r.value);
        setAllFetchedProjects(validProjects);
        setProjects(validProjects);
      }
      setEditing(false);
    } catch (e: any) {
      alert('Failed to save: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // Delete showcase
  const handleDelete = async () => {
    if (!showcase || !confirm('Are you sure you want to delete this showcase? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteShowcase(showcase.id);
      window.location.href = '/profile?tab=showcases';
    } catch (e: any) {
      alert('Failed to delete: ' + (e.message || 'Unknown error'));
      setDeleting(false);
    }
  };

  // Load user projects when opening the add picker
  const openAddPicker = async () => {
    setShowAddPicker(true);
    if (userProjects.length > 0) return; // Already loaded
    setLoadingUserProjects(true);
    try {
      const all = await getUserProjects(currentUid!);
      setUserProjects(all as FullProject[]);
    } catch {
      setUserProjects([]);
    } finally {
      setLoadingUserProjects(false);
    }
  };

  // Remove a project from edit list
  const removeProject = (docId: string) => {
    setEditProjectDocIds(prev => prev.filter(id => id !== docId));
  };

  // Add a project to edit list
  const addProject = (docId: string) => {
    if (!editProjectDocIds.includes(docId)) {
      setEditProjectDocIds(prev => [...prev, docId]);
    }
  };

  // Get project name by docId from allFetchedProjects or userProjects
  const getProjectName = (docId: string): string => {
    const found = allFetchedProjects.find(p => p.id === docId) || userProjects.find(p => p.id === docId);
    return found?.name || docId;
  };

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
      <div className="space-y-4 sm:space-y-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="inline-block mb-3 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full uppercase tracking-wider">
                {showcase.type === 'locations' ? 'Location Showcase' : 'Project Showcase'}
              </div>
              {editing ? (
                <>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="block w-full text-3xl md:text-4xl font-bold text-gray-900 mb-3 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Showcase title"
                  />
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    className="block w-full text-gray-600 text-base bg-white border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Description (optional)"
                    rows={3}
                  />
                </>
              ) : (
                <>
                  <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3">{showcase.title}</h1>
                  {showcase.description && (
                    <p className="text-gray-600 text-base leading-relaxed max-w-2xl">{showcase.description}</p>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 flex-wrap sm:flex-nowrap shrink-0">
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">Showcase Code</div>
                <div className="font-mono font-bold text-lg text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
                  {showcase.showcaseId}
                </div>
              </div>
              {/* Edit / Save / Cancel buttons */}
              {isOwner && !editing && (
                <button
                  onClick={startEditing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition"
                >
                  <PencilIcon className="w-4 h-4 text-orange-600" />
                  Edit
                </button>
              )}
              {isOwner && editing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 shadow-sm transition"
                  >
                    <CheckIcon className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={saving || deleting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 shadow-sm transition"
                    title="Delete showcase"
                  >
                    <TrashIcon className="w-4 h-4" />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Share link */}
          <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">Share:</span>
            {/* Copy link button */}
            <button
              onClick={() => {
                const url = `${window.location.origin}/showcase/${showcase.showcaseId}`;
                navigator.clipboard.writeText(url).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }).catch(() => {});
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                linkCopied
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {linkCopied ? (
                <><CheckIcon className="w-4 h-4" /> Copied!</>
              ) : (
                <><ClipboardDocumentIcon className="w-4 h-4" /> Copy link</>
              )}
            </button>
            {/* Native share button — only shown when Web Share API is available */}
            {typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function' && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/showcase/${showcase.showcaseId}`;
                  (navigator as any).share({ title: showcase.title, url }).catch(() => {});
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 transition"
              >
                <ShareIcon className="w-4 h-4" /> Share
              </button>
            )}
          </div>
        </div>

        {/* Edit mode: project list management */}
        {editing && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Projects in Showcase</h2>
              <button
                onClick={openAddPicker}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
              >
                <PlusIcon className="w-4 h-4" />
                Add Project
              </button>
            </div>

            {/* Current projects list */}
            {editProjectDocIds.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">No projects — click &quot;Add Project&quot; to include some.</p>
            ) : (
              <div className="space-y-2">
                {editProjectDocIds.map(docId => (
                  <div key={docId} className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {(() => {
                        const proj = allFetchedProjects.find(p => p.id === docId) || userProjects.find(p => p.id === docId);
                        return proj?.coverPhotoUrl ? (
                          <Image src={proj.coverPhotoUrl} width={40} height={40} style={{ objectFit: 'cover' }} className="w-10 h-10 rounded-lg shrink-0" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                            <RectangleGroupIcon className="w-5 h-5 text-orange-300" />
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">{getProjectName(docId)}</div>
                        {(() => {
                          const proj = allFetchedProjects.find(p => p.id === docId) || userProjects.find(p => p.id === docId);
                          return proj?.projectId ? (
                            <div className="text-xs text-gray-400 font-mono">{proj.projectId}</div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeProject(docId)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Remove from showcase"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add project picker */}
            {showAddPicker && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Select projects to add:</h3>
                {loadingUserProjects ? (
                  <p className="text-sm text-gray-400 py-2">Loading your projects...</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {userProjects
                      .filter(p => !editProjectDocIds.includes(p.id))
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => addProject(p.id)}
                          className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition text-left"
                        >
                          {p.coverPhotoUrl ? (
                            <Image src={p.coverPhotoUrl} width={32} height={32} style={{ objectFit: 'cover' }} className="w-8 h-8 rounded shrink-0" alt="" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center shrink-0">
                              <RectangleGroupIcon className="w-4 h-4 text-orange-300" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                            {p.projectId && <div className="text-xs text-gray-400 font-mono">{p.projectId}</div>}
                          </div>
                          <PlusIcon className="w-4 h-4 text-orange-500 shrink-0" />
                        </button>
                      ))}
                    {userProjects.filter(p => !editProjectDocIds.includes(p.id)).length === 0 && (
                      <p className="col-span-full text-sm text-gray-500 italic py-2">All your projects are already in this showcase.</p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setShowAddPicker(false)}
                  className="mt-3 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  Close picker
                </button>
              </div>
            )}
          </div>
        )}

        {/* Count */}
        {!editing && (
          <div className="flex items-center gap-2">
            {showcase.type === 'locations' ? (
              <>
                <MapPinIcon className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-semibold text-gray-700">
                  {locations.length} {locations.length === 1 ? 'Location' : 'Locations'}
                </span>
              </>
            ) : (
              <>
                <RectangleGroupIcon className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-semibold text-gray-700">
                  {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                </span>
              </>
            )}
          </div>
        )}

        {/* Content — Projects or Locations */}
        {!editing && (
          showcase.type === 'locations' ? (
            locations.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <MapPinIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500">No locations in this showcase yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {locations.map((loc) => (
                  <LocationCard key={`${loc.orgDbId}-${loc.locationId}`} location={loc} />
                ))}
              </div>
            )
          ) : (
            projects.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <RectangleGroupIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500">No projects in this showcase yet.</p>
              </div>
            ) : (
              <LocationGroupedProjects projects={projects} showcaseCode={showcase.showcaseId} />
            )
          )
        )}
      </div>
    </PageShell>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a stable location key, human-readable name, and address for a project. */
function locationInfo(project: FullProject): { key: string; name: string; address: string } {
  const loc = project.location;
  const locName = (project as any).locationName || '';
  const isSensitive = loc?.sensitiveLocation;
  const town    = isSensitive ? '' : (loc?.town || loc?.name || '');
  const country = loc?.country || '';
  
  // For sensitive locations, only show country
  const address = isSensitive 
    ? `${country} (exact location hidden for safety)`
    : [town, country].filter(Boolean).join(', ');
  
  // Use locationName as the primary grouping key, fall back to town+country
  const key = locName || [town, country].filter(Boolean).join('||');
  return { key, name: locName, address };
}

/** Group projects by location key, preserving insertion order. */
function groupByLocation(
  projects: FullProject[],
): { key: string; name: string; address: string; items: FullProject[] }[] {
  const map = new Map<string, { key: string; name: string; address: string; items: FullProject[] }>();
  for (const p of projects) {
    const { key, name, address } = locationInfo(p);
    if (!map.has(key)) map.set(key, { key, name, address, items: [] });
    map.get(key)!.items.push(p);
  }
  return Array.from(map.values());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Format a number as a compact currency string. */
function formatCurrency(amount: number, currency?: string): string {
  const code = currency || 'GBP';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString()}`;
  }
}

function ProjectCard({ project, showcaseCode }: { project: FullProject; showcaseCode: string }) {
  const suffix = showcaseCode ? `?from=showcase&code=${showcaseCode}` : '';
  const budget = (project as any).totalBudget as number | undefined;
  const pledged = (project as any).amountPledged as number | undefined;
  const amountRaised = (project as any).amountRaised as number | undefined;
  const currency = (project as any).currency as string | undefined;
  const phases = (project as any).budgetPhases as any[] | undefined;
  const currentPhaseId = (project as any).currentPhaseId as string | undefined;
  const currentPhase = phases && currentPhaseId ? phases.find(ph => ph.id === currentPhaseId) : null;
  const hasFunding = typeof budget === 'number' && budget > 0;
  const progressPct = hasFunding && typeof pledged === 'number' ? Math.min(100, Math.round((pledged / budget) * 100)) : 0;

  return (
    <a
      href={`/projects/${project.projectId || project.id}/profile${suffix}`}
      className="group rounded-2xl overflow-hidden border border-gray-200 bg-white hover:shadow-lg transition flex flex-col"
    >
      {project.coverPhotoUrl ? (
        <div className="relative w-full h-44 bg-gray-100">
          <Image
            fill
            src={project.coverPhotoUrl}
            alt={project.name}
            sizes="(max-width: 640px) 100vw, 50vw"
            style={{ objectFit: 'cover' }}
          />
        </div>
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

        {/* Fundraising target */}
        {hasFunding && (
          <div className="mt-auto mb-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <CurrencyDollarIcon className="w-3.5 h-3.5" />
                Fundraising Target
              </span>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(budget!, currency)}</span>
            </div>
            {typeof pledged === 'number' && pledged > 0 && (
              <>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatCurrency(pledged, currency)} pledged</span>
                  <span>{progressPct}%</span>
                </div>
              </>
            )}
            {typeof amountRaised === 'number' && amountRaised > 0 && (
              <div className="flex items-center justify-between text-xs mt-1.5">
                <span className="text-gray-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  Raised
                </span>
                <span className="font-semibold text-green-700">{formatCurrency(amountRaised, currency)}</span>
              </div>
            )}
            {currentPhase && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Current Phase</span>
                  <span className="text-xs font-semibold text-blue-700 truncate max-w-[140px] text-right">{currentPhase.name}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-400">Phase target</span>
                  <span className="text-xs font-bold text-gray-800">{formatCurrency(Number(currentPhase.target || 0), currency)}</span>
                </div>
                {typeof currentPhase.raised === 'number' && currentPhase.raised > 0 && (
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-gray-400">Phase raised</span>
                    <span className="text-xs font-semibold text-green-700">{formatCurrency(currentPhase.raised, currency)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {((project as any).locationName || project.location?.name || project.location?.town) && (
          <div className="mt-auto mb-2">
            {((project as any).locationName) && (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <MapPinIcon className="w-4 h-4 text-orange-500 shrink-0" />
                {(project as any).locationName}
              </div>
            )}
            {(project.location?.town || project.location?.name) && (
              <div className={`text-xs text-gray-400 ${(project as any).locationName ? 'pl-[22px]' : 'flex items-center gap-1'}`}>
                {!(project as any).locationName && <MapPinIcon className="w-3.5 h-3.5 shrink-0" />}
                {project.location.town || project.location.name}
                {project.location.country ? `, ${project.location.country}` : ''}
              </div>
            )}
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

/** Find the first valid lat/lng from a list of projects. */
function findGroupCoords(projects: FullProject[]): { lat: number; lng: number } | null {
  for (const p of projects) {
    const loc = p.location;
    
    // If sensitive location, use country center
    if (loc?.sensitiveLocation && loc.country) {
      const center = getCountryCenter(loc.country);
      if (center) return { lat: center.lat, lng: center.lng };
    }
    
    const lat = loc?.latitude;
    const lng = loc?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

function ProjectGridWithMap({ projects, showcaseCode }: { projects: FullProject[]; showcaseCode: string }) {
  const coords = findGroupCoords(projects);

  return (
    <div className="flex gap-6 items-stretch">
      {/* Project cards — 2 columns, wrapping to extra rows */}
      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        {projects.map(p => (
          <div key={p.id} className="w-full">
            <ProjectCard project={p} showcaseCode={showcaseCode} />
          </div>
        ))}
      </div>

      {/* Map — right side, stretches to full height of card grid, hidden on mobile */}
      {coords && (
        <div className="hidden lg:block w-72 xl:w-80 shrink-0 relative min-h-[360px]">
          <div className="absolute inset-0">
            <MapPreview lat={coords.lat} lng={coords.lng} className="w-full h-full rounded-2xl shadow-sm" zoom={10} />
          </div>
        </div>
      )}
    </div>
  );
}

function LocationGroupedProjects({ projects, showcaseCode }: { projects: FullProject[]; showcaseCode: string }) {
  const groups = groupByLocation(projects);

  // Single group (same or no location) — grid with map
  if (groups.length <= 1) {
    return <ProjectGridWithMap projects={projects} showcaseCode={showcaseCode} />;
  }

  return (
    <div className="space-y-12">
      {groups.map(group => (
        <section key={group.key || '__no_location__'}>
          {/* Section heading — location name big, address small underneath */}
          <div className="mb-6 pb-3 border-b-2 border-black">
            <div className="flex items-start gap-2">
              <MapPinIcon className="w-5 h-5 text-gray-800 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-black uppercase tracking-wide leading-none">
                  {group.name || group.address || 'Other'}
                </h2>
                {group.name && group.address && (
                  <p className="text-sm text-gray-500 mt-1">{group.address}</p>
                )}
              </div>
              <span className="ml-auto text-sm font-semibold text-gray-500 shrink-0">
                {group.items.length} {group.items.length === 1 ? 'project' : 'projects'}
              </span>
            </div>
          </div>
          <ProjectGridWithMap projects={group.items} showcaseCode={showcaseCode} />
        </section>
      ))}
    </div>
  );
}

// ─── Location Card ───────────────────────────────────────────────────────────

function LocationCard({ location }: { location: ShowcaseLocation }) {
  const loc = location.location;
  const hasCoords = loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
  const isSensitive = loc?.sensitiveLocation;
  const displayTown = isSensitive ? undefined : loc?.town;
  const displayCountry = loc?.country;
  
  // Get map coordinates - if sensitive, use country center
  let mapCoords: { lat: number; lng: number; zoom: number } | null = null;
  if (hasCoords && !isSensitive) {
    mapCoords = { lat: loc.latitude!, lng: loc.longitude!, zoom: loc.zoom || 13 };
  } else if (isSensitive && displayCountry) {
    const center = getCountryCenter(displayCountry);
    if (center) mapCoords = { lat: center.lat, lng: center.lng, zoom: center.zoom || 6 };
  }

  const projects = location.projects ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Top row: 66% text | 33% map */}
      <div className="flex flex-col sm:flex-row">
        {/* Left — text content (66%) */}
        <div className="flex-1 p-6 space-y-4 min-w-0">
          {/* Header */}
          <div>
            <div className="flex items-start gap-2 mb-2">
              <MapPinIcon className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{location.locationName}</h3>
                <p className="text-sm text-gray-600">{location.orgName}</p>
              </div>
            </div>
            {(displayTown || displayCountry) && (
              <p className="text-sm text-gray-500 mt-1">
                {[displayTown, displayCountry].filter(Boolean).join(', ')}
                {isSensitive && ' (exact location hidden for safety)'}
              </p>
            )}
          </div>

          {/* Vision */}
          {location.vision && (
            <div>
              <h4 className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">Vision</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{location.vision}</p>
            </div>
          )}

          {/* What We Do */}
          {location.whatWeDo && (
            <div>
              <h4 className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">What We Do</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{location.whatWeDo}</p>
            </div>
          )}
        </div>

        {/* Right — map (33%) */}
        {mapCoords && (
          <div className="relative sm:w-[33%] flex-shrink-0 h-56 sm:h-auto min-h-[200px] bg-gray-100 sm:rounded-tr-2xl sm:rounded-br-2xl overflow-hidden">
            <MapPreview
              lat={mapCoords.lat}
              lng={mapCoords.lng}
              zoom={mapCoords.zoom}
              className="w-full h-full"
            />
            {isSensitive && (
              <div className="absolute top-2 right-2 bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded">
                General area only
              </div>
            )}
          </div>
        )}
      </div>

      {/* Projects below — only shown if any exist */}
      {projects.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-5">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Projects ({projects.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map(p => (
              <a
                key={p.id}
                href={`/projects/${(p as any).projectId || p.id}`}
                className="group flex gap-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-orange-50 hover:border-orange-200 transition p-3"
              >
                {(p as any).coverPhotoUrl && (
                  <img
                    src={(p as any).coverPhotoUrl}
                    alt={(p as any).name}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate group-hover:text-orange-700 transition">
                    {(p as any).name}
                  </div>
                  {(p as any).strapline && (
                    <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{(p as any).strapline}</div>
                  )}
                  <div className="mt-1 text-[10px] font-mono text-gray-400">{(p as any).projectId}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
