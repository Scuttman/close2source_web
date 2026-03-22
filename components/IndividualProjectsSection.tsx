"use client";
import { useEffect, useState } from 'react';
import OrgProjectsMap from './OrgProjectsMap';
import { subscribeUserProjects } from '@/lib/dal';

interface IndividualProjectsSectionProps {
  ownerUid: string;
  isOwner: boolean;
  currentUser: any;
}

export default function IndividualProjectsSection({
  ownerUid,
  isOwner,
  currentUser,
}: IndividualProjectsSectionProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerUid) return;
    setLoading(true);
    const unsub = subscribeUserProjects(
      ownerUid,
      (data) => {
        setProjects(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [ownerUid]);

  // Non-owners only see live + public projects
  const visible = isOwner
    ? projects
    : projects.filter(
        (p: any) =>
          (p.status ?? 'live') === 'live' && (p.visibility ?? 'public') === 'public',
      );

  if (!loading && visible.length === 0) return null;

  // Unique location names for filter chips
  const locationNames = Array.from(
    new Set(visible.map((p: any) => p.locationName).filter(Boolean)),
  ) as string[];
  const hasMultipleLocations = locationNames.length > 1;

  // Cards use filtered list; map always shows all visible pins
  const displayed = locationFilter
    ? visible.filter((p: any) => p.locationName === locationFilter)
    : visible;

  return (
    <div className="bg-white border border-brand-main/10 rounded-xl p-5 shadow-sm">
      <h2 className="text-base font-bold text-brand-dark mb-4">Projects</h2>

      {loading && <div className="text-xs text-gray-500">Loading projects…</div>}

      {!loading && visible.length > 0 && (
        <div className="flex gap-4 items-start">
          {/* Project cards — 2 columns */}
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
            {displayed.map((p: any) => {
              const isDraft = (p.status ?? 'live') === 'draft';
              const isLive = (p.status ?? 'live') === 'live';
              const isPrivate = (p.visibility ?? 'public') === 'private';
              const isPublic = (p.visibility ?? 'public') === 'public';
              const curr = p.currency || '$';
              const budget = p.totalBudget
                ? `${curr}${Number(p.totalBudget).toLocaleString()}`
                : null;
              const amountRaised =
                typeof p.amountRaised === 'number' && p.amountRaised > 0
                  ? p.amountRaised
                  : null;
              const phases: any[] | undefined = Array.isArray(p.budgetPhases)
                ? p.budgetPhases
                : undefined;
              const currentPhase =
                phases && p.currentPhaseId
                  ? phases.find((ph: any) => ph.id === p.currentPhaseId)
                  : null;

              return (
                <a
                  key={p.id}
                  href={`/projects/${p.projectId || p.id}`}
                  className="group relative rounded-lg overflow-hidden border border-brand-main/10 bg-white hover:shadow-md transition flex flex-col"
                >
                  {p.coverPhotoUrl && (
                    <img
                      src={p.coverPhotoUrl}
                      alt={p.name}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="text-sm font-semibold text-brand-dark mb-1 line-clamp-1">
                      {p.name}
                    </div>
                    {p.locationName && (
                      <div className="text-[11px] text-gray-400 flex items-center gap-0.5 mb-1 line-clamp-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3 h-3 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {p.locationName}
                      </div>
                    )}
                    {budget && currentUser && (
                      <div className="mb-1 space-y-0.5">
                        <div className="text-[11px] text-gray-600 flex items-center gap-0.5">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3 h-3 flex-shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                            <path d="M12 18V6" />
                          </svg>
                          <span className="font-medium">{budget}</span>
                          <span className="text-gray-400 ml-0.5">target</span>
                        </div>
                        {amountRaised && (
                          <div className="text-[11px] text-green-700 flex items-center gap-0.5">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-3 h-3 flex-shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                              <polyline points="17 6 23 6 23 12" />
                            </svg>
                            <span className="font-medium">
                              {curr}{amountRaised.toLocaleString()}
                            </span>
                            <span className="text-green-600 ml-0.5">raised</span>
                          </div>
                        )}
                        {currentPhase && (
                          <div className="text-[11px] text-blue-700 flex items-center gap-0.5">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-3 h-3 flex-shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                              <line x1="4" y1="22" x2="4" y2="15" />
                            </svg>
                            <span className="truncate max-w-[80px]">{currentPhase.name}</span>
                            <span className="text-gray-400">·</span>
                            <span className="font-medium">
                              {curr}{Number(currentPhase.target || 0).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {p.description && (
                      <div className="text-[11px] text-gray-600 line-clamp-3 flex-1">
                        {p.description}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between flex-wrap gap-1">
                      <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-brand-main/10 text-brand-main">
                        {p.projectId}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {currentUser && isOwner && isDraft && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                            Draft
                          </span>
                        )}
                        {currentUser && isOwner && isLive && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                            Live
                          </span>
                        )}
                        {currentUser && isOwner && isPrivate && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Private
                          </span>
                        )}
                        {currentUser && isOwner && isPublic && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            Public
                          </span>
                        )}
                        {p.createdAt?.seconds && (
                          <span className="text-[10px] text-gray-400">
                            {new Date(p.createdAt.seconds * 1000).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          {/* Map column — hidden on small screens, ~1/3 width */}
          <div
            className="hidden lg:flex flex-col gap-3 flex-shrink-0 self-start sticky top-4"
            style={{ width: '32%' }}
          >
            <div>
              <h3 className="text-sm font-semibold text-brand-dark">Project Locations</h3>
              {hasMultipleLocations && (
                <p className="text-[10px] text-gray-400 mt-0.5">Click a location to filter</p>
              )}
            </div>
            {/* Filter chips — only shown when 2+ distinct locations */}
            {hasMultipleLocations && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setLocationFilter(null)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition ${
                    locationFilter === null
                      ? 'bg-brand-main text-white border-brand-main'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-main hover:text-brand-main'
                  }`}
                >
                  All
                </button>
                {locationNames.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setLocationFilter(locationFilter === loc ? null : loc)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition ${
                      locationFilter === loc
                        ? 'bg-brand-main text-white border-brand-main'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-brand-main hover:text-brand-main'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            )}
            {/* Map */}
            <div style={{ aspectRatio: '1 / 2', minHeight: 360 }}>
              <OrgProjectsMap
                projects={
                  locationFilter
                    ? visible.filter((p: any) => p.locationName === locationFilter)
                    : visible
                }
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
