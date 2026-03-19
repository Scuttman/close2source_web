"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrgProjectsMap from './OrgProjectsMap';
import { storage } from '../src/lib/firebase';
import { getAuth } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { generateCode } from '../src/lib/codes';
import { subscribeOrgProjects, getProjectByCode, createProjectWithCredits } from '@/lib/dal';

interface OrgProjectsTabProps {
	org: any; // organization document (with id, orgId, name, ownerUid, etc.)
	isOwner: boolean;
	currentUser: any; // firebase user
}

// Helper to generate a random 7-letter uppercase string (mirrors register page)
function generateProjectId(){
	return generateCode('project');
}

export default function OrgProjectsTab({ org, isOwner, currentUser }: OrgProjectsTabProps){
	const router = useRouter();
	const [projects, setProjects] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const [locationFilter, setLocationFilter] = useState<string|null>(null);
	const [showModePicker, setShowModePicker] = useState(false);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	// Cover photo immediate upload state
	const [coverPhotoUploading, setCoverPhotoUploading] = useState(false);
	const [coverPhotoProgress, setCoverPhotoProgress] = useState<number|null>(null);
	const [coverPhotoUrl, setCoverPhotoUrl] = useState<string>('');
	const [coverPhotoError, setCoverPhotoError] = useState<string>('');
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState('');

	// Real-time subscription to projects linked to this org (using organizationId == org.orgId for consistency with ProjectOverview linkage)
	useEffect(()=> {
		if(!org?.orgId) return;
		const cacheKey = `org_projects_${org.orgId}`;
		const cached = sessionStorage.getItem(cacheKey);
		if(cached) {
			try { setProjects(JSON.parse(cached)); setLoading(false); } catch{}
		} else {
			setLoading(true);
		}
		const unsub = subscribeOrgProjects(org.orgId, (rows) => {
			const sorted = [...rows].sort((a:any,b:any)=> {
				const an = (a.name||'').toLowerCase(); const bn = (b.name||'').toLowerCase();
				if(an && bn) return an.localeCompare(bn);
				if(an) return -1; if(bn) return 1;
				return (a.projectId||'').localeCompare(b.projectId||'');
			});
			setProjects(sorted as any);
			sessionStorage.setItem(cacheKey, JSON.stringify(sorted));
			setLoading(false);
		}, ()=> setLoading(false));
		return ()=> unsub();
	}, [org?.orgId]);

	async function handleCreate(){
		setError('');
		if(!currentUser) { setError('You must be logged in.'); return; }
		if(!isOwner) { setError('Only the organization owner can create projects here.'); return; }
		if(!name || !description || !coverPhotoUrl){ setError('All fields required (ensure cover photo uploaded).'); return; }
		setCreating(true);
		try {
			// Generate unique projectId (up to 10 attempts)
			let projectId = ''; let unique=false;
			for(let attempt=0; attempt<10 && !unique; attempt++){
				projectId = generateProjectId();
				const existing = await getProjectByCode(projectId);
				if(!existing) unique = true;
			}
			if(!unique) throw new Error('Could not generate a unique project ID, try again.');

			// Inherit org theme (only copy defined values) so project starts visually consistent
			const THEME_KEYS = [
				'themeHeaderBg','themeHeaderText','themeAccent','themeAccentText','themeAccentHover',
				'themeTabActiveBg','themeTabActiveText','themeTabInactiveText','themeWidgetTitleColor'
			] as const;
			const inheritedTheme: Record<string, any> = {};
			THEME_KEYS.forEach(k=> { if(org && typeof (org as any)[k] === 'string' && (org as any)[k]) inheritedTheme[k] = (org as any)[k]; });
			if(!inheritedTheme.themeAccent && org?.themeHeaderBg) inheritedTheme.themeAccent = org.themeHeaderBg;
			if(!inheritedTheme.themeTabActiveBg && inheritedTheme.themeAccent) inheritedTheme.themeTabActiveBg = inheritedTheme.themeAccent;

			// Create project via DAL (deducts credits atomically)
			await createProjectWithCredits({
				uid: currentUser.uid,
				projectData: {
					name,
					description,
					coverPhotoUrl,
					users: [{ uid: currentUser.uid, role: 'Admin' }],
					createdBy: currentUser.uid,
					projectId,
					location: null,
					organizationId: org.orgId,
					organizationName: org.name || null,
					organizationLogoUrl: org.logoUrl || null,
					originatingOrganizationId: org.orgId,
					originatingOrganizationDbId: org.id,
					...inheritedTheme,
				},
			});
			// Reset form
			setName(''); setDescription(''); setCoverPhotoUrl(''); setShowCreate(false);
		} catch(e:any){ setError(e.message || 'Create failed'); }
		finally { setCreating(false); }
	}

	async function handleCoverSelect(file: File){
		if(!file) return;
		setCoverPhotoError('');
		// Optional basic size limit (e.g., 5MB) - adjust as needed
		if(file.size > 8*1024*1024){ setCoverPhotoError('File too large (max 8MB)'); return; }
		// If replacing an existing uploaded image, attempt cleanup (best-effort)
		const previousUrl = coverPhotoUrl;
		setCoverPhotoUrl('');
		setCoverPhotoUploading(true);
		setCoverPhotoProgress(0);
		try {
			const ext = file.name.split('.').pop() || 'jpg';
			// Use timestamp path (no project id yet). We keep even if user cancels (could add garbage collection later).
			const storagePath = `projects/covers/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
			const storageRef = ref(storage, storagePath);
			const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
			task.on('state_changed', snap=> {
				setCoverPhotoProgress(Math.round((snap.bytesTransferred / snap.totalBytes)*100));
			}, err=> {
				setCoverPhotoError(err?.message || 'Upload failed');
				setCoverPhotoUploading(false);
				setCoverPhotoProgress(null);
			}, async ()=> {
				try {
					const url = await getDownloadURL(task.snapshot.ref);
					setCoverPhotoUrl(url);
					setCoverPhotoUploading(false);
					setCoverPhotoProgress(null);
					// Attempt delete of previous (ignore failures)
					if(previousUrl){
						try {
							const match = previousUrl.match(/\/o\/([^?]+)/); if(match){ const encoded = decodeURIComponent(match[1]); const idx = encoded.indexOf('projects%2F'); if(idx>=0){ const rel = encoded.substring(idx).replace(/%2F/g,'/'); await deleteObject(ref(storage, rel)); } }
						} catch{/* ignore */}
					}
				} catch(e:any){ setCoverPhotoError(e?.message || 'Failed to finalize upload'); setCoverPhotoUploading(false); }
			});
		} catch(e:any){ setCoverPhotoError(e.message || 'Upload failed'); setCoverPhotoUploading(false); setCoverPhotoProgress(null); }
	}

	return (
		<>
		<div className='flex flex-col gap-6'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h2 className='text-lg font-semibold' style={{ color:'var(--org-widget-title-color, var(--org-accent, #FF6A1A))' }}>Our Projects</h2>
					<p className='text-xs text-gray-500 mt-1'>Projects linked to this organization. Creating here will auto-link & store originating ownership.</p>
				</div>
				{isOwner && (
					<button
						onClick={() => {
							if (showCreate || showModePicker) {
								setShowCreate(false); setShowModePicker(false);
							} else {
								setShowModePicker(true);
							}
						}}
						className='px-3 py-2 rounded text-white text-xs font-semibold'
						style={{ background:'var(--org-accent, #FF6A1A)', color:'var(--org-accent-text,#fff)' }}
					>
						{(showCreate || showModePicker) ? 'Cancel' : 'Register Project'}
					</button>
				)}
			</div>

			{/* Mode picker */}
			{showModePicker && isOwner && (
				<div className='bg-white border border-brand-main/10 rounded-xl p-5 shadow-sm'>
					<p className='text-sm font-semibold mb-4' style={{ color:'var(--org-widget-title-color, var(--org-accent,#FF6A1A))' }}>How would you like to register your project?</p>
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
						{/* AI Chat */}
						<button
							type='button'
							onClick={() => {
								// Close mode picker
								setShowModePicker(false);
								// Navigate to AI registration page
								router.push(`/projects/register-ai?orgId=${org?.orgId || org?.id}&orgName=${encodeURIComponent(org?.name || 'your organization')}`);
							}}
							className='group text-left border-2 border-orange-200 hover:border-orange-500 rounded-xl p-5 transition-colors bg-orange-50 hover:bg-orange-100'
						>
							<div className='flex items-center gap-2 mb-2'>
								<svg xmlns='http://www.w3.org/2000/svg' className='w-5 h-5 text-orange-500' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.8'><path strokeLinecap='round' strokeLinejoin='round' d='M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z'/></svg>
								<span className='text-sm font-bold text-orange-700'>AI-Guided Chat</span>
							</div>
							<p className='text-xs text-orange-700/80'>Let ChatGPT guide you through each section. It will ask questions, improve your writing for grammar &amp; fluency, and generate a polished profile ready to publish.</p>
							<div className='mt-3 text-[11px] font-semibold text-orange-600 group-hover:underline'>Start AI chat →</div>
						</button>
						{/* Manual form */}
						<button
							type='button'
							onClick={() => { setShowModePicker(false); setShowCreate(true); }}
							className='group text-left border-2 border-gray-200 hover:border-brand-main/50 rounded-xl p-5 transition-colors bg-white hover:bg-brand-main/5'
						>
							<div className='flex items-center gap-2 mb-2'>
								<svg xmlns='http://www.w3.org/2000/svg' className='w-5 h-5 text-gray-500' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='1.8'><path strokeLinecap='round' strokeLinejoin='round' d='M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z'/><path strokeLinecap='round' strokeLinejoin='round' d='M19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'/></svg>
								<span className='text-sm font-bold text-gray-700'>Manual Form</span>
							</div>
							<p className='text-xs text-gray-500'>Fill in the form fields yourself. Faster if you already have everything prepared.</p>
							<div className='mt-3 text-[11px] font-semibold text-gray-500 group-hover:underline'>Open form →</div>
						</button>
					</div>
				</div>
			)}
			{showCreate && isOwner && (
				<div className='bg-white border border-brand-main/10 rounded-xl p-5 shadow-sm'>
					<h3 className='text-sm font-semibold mb-3' style={{ color:'var(--org-widget-title-color, var(--org-accent,#FF6A1A))' }}>New Project</h3>
					<div className='space-y-3'>
						<div>
							<label className='block text-[11px] font-semibold uppercase tracking-wide mb-1' style={{ color:'var(--org-tab-inactive-text, #475569)' }}>Name</label>
							<input value={name} onChange={e=> setName(e.target.value)} className='w-full border rounded px-3 py-2 text-sm' placeholder='Project name' />
						</div>
						<div>
							<label className='block text-[11px] font-semibold uppercase tracking-wide mb-1' style={{ color:'var(--org-tab-inactive-text, #475569)' }}>Description</label>
							<textarea value={description} onChange={e=> setDescription(e.target.value)} className='w-full border rounded px-3 py-2 text-sm min-h-[80px]' placeholder='Brief description' />
						</div>
						<div>
							<label className='block text-[11px] font-semibold uppercase tracking-wide mb-1' style={{ color:'var(--org-tab-inactive-text, #475569)' }}>Cover Photo</label>
							<div className='flex items-start gap-4'>
								<div className='w-40'>
									<div className='relative w-40 h-28 rounded border border-dashed border-brand-main/30 flex items-center justify-center overflow-hidden bg-brand-main/5'>
										{!coverPhotoUrl && !coverPhotoUploading && (
											<button type='button' onClick={()=> document.getElementById('org-cover-photo-input')?.click()} className='text-[11px] font-medium text-brand-main hover:underline'>Select Image</button>
										)}
										{coverPhotoUploading && (
											<div className='flex flex-col items-center justify-center gap-2 text-brand-main'>
												<div className='w-10 h-10 rounded-full border-2 border-brand-main border-t-transparent animate-spin' />
												<span className='text-[11px] font-semibold'>{coverPhotoProgress ?? 0}%</span>
											</div>
										)}
										{coverPhotoUrl && !coverPhotoUploading && (
											<img src={coverPhotoUrl} alt='Cover' className='absolute inset-0 w-full h-full object-cover' />
										)}
										{coverPhotoUrl && !coverPhotoUploading && (
											<div className='absolute top-1 right-1 flex gap-1'>
												<button type='button' onClick={()=> document.getElementById('org-cover-photo-input')?.click()} className='px-2 py-1 rounded bg-black/60 text-white text-[10px] font-semibold'>Replace</button>
												<button type='button' onClick={async()=> {
													if(!coverPhotoUrl) return; const toRemove = coverPhotoUrl; setCoverPhotoUrl('');
													try { const match = toRemove.match(/\/o\/([^?]+)/); if(match){ const encoded = decodeURIComponent(match[1]); const idx = encoded.indexOf('projects%2F'); if(idx>=0){ const rel = encoded.substring(idx).replace(/%2F/g,'/'); await deleteObject(ref(storage, rel)); } } } catch {/* ignore */}
												}} className='px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold'>×</button>
											</div>
										)}
									</div>
								</div>
								<div className='flex-1 text-[10px] text-gray-500 space-y-2'>
									<p>An image representing the project (required). Upload happens immediately for preview.</p>
									{coverPhotoError && <div className='text-red-600 font-medium'>{coverPhotoError}</div>}
									<button type='button' onClick={()=> document.getElementById('org-cover-photo-input')?.click()} disabled={coverPhotoUploading} className='px-3 py-1.5 rounded text-xs font-semibold' style={{ background:'var(--org-accent, #FF6A1A)', color:'var(--org-accent-text,#fff)', opacity: coverPhotoUploading? .6:1 }}>{coverPhotoUrl? 'Change Image' : 'Select Image'}</button>
								</div>
							</div>
							<input id='org-cover-photo-input' type='file' accept='image/*' hidden onChange={e=> { const f=e.target.files?.[0]; if(f) handleCoverSelect(f); if(e.target) e.target.value=''; }} />
						</div>
						<div className='flex items-center gap-3 pt-1'>
							<button disabled={creating || !coverPhotoUrl} onClick={handleCreate} className='px-4 py-2 rounded text-xs font-semibold disabled:opacity-50'
								style={{ background:'var(--org-accent, #FF6A1A)', color:'var(--org-accent-text,#fff)', opacity: (!coverPhotoUrl || creating)? .6:1 }}>{creating? 'Registering...' : 'Register (50 Credits)'}</button>
							<button type='button' disabled={creating} onClick={()=> setShowCreate(false)} className='px-3 py-2 rounded text-xs font-semibold'
								style={{ background:'var(--org-accent-hover,#e75e12)', color:'var(--org-accent-text,#fff)', opacity: creating? .6: 1 }}>Close</button>
							{error && <span className='text-[11px] text-red-600'>{error}</span>}
						</div>
					</div>
				</div>
			)}
			<div className='flex-1 min-h-0'>
				<div className='bg-white border border-brand-main/10 rounded-xl p-5 shadow-sm h-full flex flex-col'>
					{loading && <div className='text-xs text-gray-500'>Loading projects...</div>}
					{!loading && !projects.length && <div className='text-xs text-gray-500'>No projects yet.</div>}
					{!loading && projects.length>0 && (() => {
						// Non-owners only see live + public projects
						const visible = isOwner
							? projects
							: projects.filter(p => (p.status ?? 'live') === 'live' && (p.visibility ?? 'public') === 'public');
						if (!visible.length) return <div className='text-xs text-gray-500'>No projects yet.</div>;
					// Unique location names for filter chips
					const locationNames = Array.from(new Set(
						visible.map((p: any) => p.locationName).filter(Boolean)
					)) as string[];
					const hasMultipleLocations = locationNames.length > 1;
					// Cards use filtered list; map always shows all visible pins
					const displayed = locationFilter
						? visible.filter((p: any) => p.locationName === locationFilter)
						: visible;
					return (
					<div className='flex gap-4 items-start'>
						{/* Project cards — 2 columns */}
						<div className='flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start'>
						{displayed.map((p: any)=> {
									const isDraft = (p.status ?? 'live') === 'draft';
									const isLive = (p.status ?? 'live') === 'live';
									const isPrivate = (p.visibility ?? 'public') === 'private';
									const isPublic = (p.visibility ?? 'public') === 'public';
									const budget = p.totalBudget ? `${p.currency || '$'}${p.totalBudget.toLocaleString()}` : null;
									return (
										<a key={p.id} href={`/projects/${p.projectId || p.id}/proposal`} className='group relative rounded-lg overflow-hidden border border-brand-main/10 bg-white hover:shadow-md transition flex flex-col'>
											{p.coverPhotoUrl && <img src={p.coverPhotoUrl} alt={p.name} className='w-full h-40 object-cover' />}
											<div className='p-3 flex-1 flex flex-col'>
												<div className='text-sm font-semibold text-brand-dark mb-1 line-clamp-1'>{p.name}</div>
												{p.locationName && (
													<div className='text-[11px] text-gray-400 flex items-center gap-0.5 mb-1 line-clamp-1'>
														<svg xmlns='http://www.w3.org/2000/svg' className='w-3 h-3 flex-shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z'/><circle cx='12' cy='10' r='3'/></svg>
														{p.locationName}
													</div>
												)}
												{budget && currentUser && (
													<div className='text-[11px] text-gray-600 flex items-center gap-0.5 mb-1'>
														<svg xmlns='http://www.w3.org/2000/svg' className='w-3 h-3 flex-shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='10'/><path d='M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8'/><path d='M12 18V6'/></svg>
														<span className='font-medium'>{budget}</span>
													</div>
												)}
												{p.description && <div className='text-[11px] text-gray-600 line-clamp-3 flex-1'>{p.description}</div>}
												<div className='mt-2 flex items-center justify-between flex-wrap gap-1'>
													<span className='inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-brand-main/10 text-brand-main'>{p.projectId}</span>
													<div className='flex items-center gap-1 flex-wrap'>
														{currentUser && isOwner && isDraft && <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200'>Draft</span>}
														{currentUser && isOwner && isLive && <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200'>Live</span>}
														{currentUser && isOwner && isPrivate && <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200'>Private</span>}
														{currentUser && isOwner && isPublic && <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200'>Public</span>}
														{p.showOnOrganizationOverview && <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200'>Showcase</span>}
														{p.createdAt?.seconds && <span className='text-[10px] text-gray-400'>{new Date(p.createdAt.seconds*1000).toLocaleDateString()}</span>}
													</div>
												</div>
											</div>
										</a>
									);
								})}
							</div>
						{/* Map column — hidden on small screens, ~1/3 width */}
						<div className='hidden lg:flex flex-col gap-3 flex-shrink-0 self-start sticky top-4' style={{ width: '32%' }}>
							{/* Title */}
							<div>
								<h3 className='text-sm font-semibold text-brand-dark'>Our Project Locations</h3>
								{hasMultipleLocations && <p className='text-[10px] text-gray-400 mt-0.5'>Click a location to filter</p>}
							</div>
							{/* Filter chips — only shown when 2+ distinct locations */}
							{hasMultipleLocations && (
								<div className='flex flex-wrap gap-1.5'>
									<button
										onClick={() => setLocationFilter(null)}
										className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition ${
											locationFilter === null
												? 'bg-brand-main text-white border-brand-main'
												: 'bg-white text-gray-600 border-gray-300 hover:border-brand-main hover:text-brand-main'
										}`}
									>All</button>
									{locationNames.map(loc => (
										<button
											key={loc}
											onClick={() => setLocationFilter(locationFilter === loc ? null : loc)}
											className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition ${
												locationFilter === loc
													? 'bg-brand-main text-white border-brand-main'
													: 'bg-white text-gray-600 border-gray-300 hover:border-brand-main hover:text-brand-main'
											}`}
										>{loc}</button>
									))}
								</div>
							)}
							{/* Map — zooms to filtered location when a chip is active */}
							<div style={{ aspectRatio: '1 / 2', minHeight: 360 }}>
								<OrgProjectsMap
									projects={locationFilter ? visible.filter((p: any) => p.locationName === locationFilter) : visible}
									className='h-full w-full'
								/>
								</div>
							</div>
						</div>
					);
					})()}
				</div>
			</div>
		</div>
		</>
	);
}

