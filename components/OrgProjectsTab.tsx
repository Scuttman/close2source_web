"use client";
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../src/lib/firebase';
import { getAuth } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { generateCode } from '../src/lib/codes';

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
	const [projects, setProjects] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
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
		if(!org?.orgId) return; setLoading(true);
		const qy = query(collection(db,'projects'), where('organizationId','==', org.orgId));
		const unsub = onSnapshot(qy, snap=> {
			const rows = snap.docs.map(d=> ({ id: d.id, ...d.data() }));
			rows.sort((a:any,b:any)=> {
				const an = (a.name||'').toLowerCase(); const bn = (b.name||'').toLowerCase();
				if(an && bn) return an.localeCompare(bn);
				if(an) return -1; if(bn) return 1;
				return (a.projectId||'').localeCompare(b.projectId||'');
			});
			setProjects(rows);
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
			const projectsCol = collection(db,'projects');
			let projectId = ''; let unique=false;
			for(let attempt=0; attempt<10 && !unique; attempt++){
				projectId = generateProjectId();
				const { query: qFn, where: wFn, getDocs } = await import('firebase/firestore');
				const snap = await getDocs(qFn(projectsCol, wFn('projectId','==', projectId)));
				if(snap.empty) unique = true;
			}
			if(!unique) throw new Error('Could not generate a unique project ID, try again.');

			// Transaction: create project & deduct user credits (same cost 50) but also embed org ownership reference snapshot
			await runTransaction(db, async(transaction)=> {
				const userRef = doc(db,'users', currentUser.uid);
				const userSnap = await transaction.get(userRef);
				if(!userSnap.exists()) throw new Error('User profile not found.');
				const userData = userSnap.data();
				if((userData.credits||0) < 50) throw new Error('Not enough credits.');
				const newProjectRef = doc(projectsCol);
				// Inherit org theme (only copy defined values) so project starts visually consistent
				const THEME_KEYS = [
					'themeHeaderBg','themeHeaderText','themeAccent','themeAccentText','themeAccentHover',
					'themeTabActiveBg','themeTabActiveText','themeTabInactiveText','themeWidgetTitleColor'
				] as const;
				const inheritedTheme: Record<string, any> = {};
				THEME_KEYS.forEach(k=> { if(org && typeof (org as any)[k] === 'string' && (org as any)[k]) inheritedTheme[k] = (org as any)[k]; });
				// Provide sensible fallbacks when some org fields missing
				if(!inheritedTheme.themeAccent && org?.themeHeaderBg) inheritedTheme.themeAccent = org.themeHeaderBg;
				if(!inheritedTheme.themeTabActiveBg && inheritedTheme.themeAccent) inheritedTheme.themeTabActiveBg = inheritedTheme.themeAccent;
				transaction.set(newProjectRef, {
					name,
						description,
						coverPhotoUrl,
						users: [{ uid: currentUser.uid, role: 'Admin' }],
						createdAt: serverTimestamp(),
						createdBy: currentUser.uid,
						projectId,
						location: null,
						// Organization linkage (use stable orgId string, plus display name & logo for denormalized quick access)
						organizationId: org.orgId,
						organizationName: org.name || null,
						organizationLogoUrl: org.logoUrl || null,
						// Persist original owning organization id to preserve ownership even if organization owner changes later
						originatingOrganizationId: org.orgId,
						originatingOrganizationDbId: org.id,
						...inheritedTheme,
				});
				transaction.update(userRef, { credits: (userData.credits||0) - 50 });
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
		<div className='flex flex-col gap-6'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h2 className='text-lg font-semibold' style={{ color:'var(--org-widget-title-color, var(--org-accent, #FF6A1A))' }}>Our Projects</h2>
					<p className='text-xs text-gray-500 mt-1'>Projects linked to this organization. Creating here will auto-link & store originating ownership.</p>
				</div>
				{isOwner && (
					<button onClick={()=> setShowCreate(v=> !v)} className='px-3 py-2 rounded text-white text-xs font-semibold'
						style={{ background:'var(--org-accent, #FF6A1A)', color:'var(--org-accent-text,#fff)' }}>
						{showCreate? 'Cancel' : 'Register Project'}
					</button>
				)}
			</div>
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
					{!loading && projects.length>0 && (
						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
							{projects.map(p=> (
								<a key={p.id} href={`/projects/${p.projectId || p.id}`} className='group relative rounded-lg overflow-hidden border border-brand-main/10 bg-white hover:shadow-md transition flex flex-col'>
									{p.coverPhotoUrl && <img src={p.coverPhotoUrl} alt={p.name} className='w-full h-40 object-cover' />}
									<div className='p-3 flex-1 flex flex-col'>
										<div className='text-sm font-semibold text-brand-dark mb-1 line-clamp-1'>{p.name}</div>
										{p.description && <div className='text-[11px] text-gray-600 line-clamp-3 flex-1'>{p.description}</div>}
										<div className='mt-2 flex items-center justify-between'>
											<span className='inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-brand-main/10 text-brand-main'>{p.projectId}</span>
											{p.createdAt?.seconds && <span className='text-[10px] text-gray-400'>{new Date(p.createdAt.seconds*1000).toLocaleDateString()}</span>}
										</div>
									</div>
								</a>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

