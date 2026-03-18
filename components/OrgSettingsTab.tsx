"use client";
import { useState, useRef, useEffect } from 'react';
import { doc, updateDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db, storage } from '../src/lib/firebase';
import { ClipboardDocumentIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon, LinkIcon } from '@heroicons/react/24/outline';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

interface OrgSettingsTabProps {
	org: any;
	enrichedTeam: any[];
	isOwner: boolean;
	editMode: boolean;
	onOrgUpdate: (patch: Record<string, any>) => void;
}

function MemberAccessSection({ org, isOwner, onOrgUpdate }: { org: any; isOwner: boolean; onOrgUpdate: (patch: Record<string, any>) => void }) {
	const [showPin, setShowPin] = useState(false);
	const [regenerating, setRegenerating] = useState(false);
	const [copied, setCopied] = useState<'code' | 'pin' | 'invite' | null>(null);
	const [generatingInvite, setGeneratingInvite] = useState(false);
	const [inviteLink, setInviteLink] = useState<string | null>(null);

	async function regeneratePin() {
		if (!confirm('Regenerate the join PIN? The old PIN will stop working immediately.')) return;
		setRegenerating(true);
		try {
			const newPin = String(Math.floor(1000 + Math.random() * 9000));
			await updateDoc(doc(db, 'organizations', org.id), { joinPin: newPin });
			onOrgUpdate({ joinPin: newPin });
		} catch { /* ignore */ }
		finally { setRegenerating(false); }
	}

	function copy(text: string, which: 'code' | 'pin' | 'invite') {
		navigator.clipboard.writeText(text).then(() => {
			setCopied(which);
			setTimeout(() => setCopied(null), 2000);
		});
	}

	async function generateInviteLink() {
		setGeneratingInvite(true);
		try {
			const inviteRef = await addDoc(collection(db, 'orgInvites'), {
				orgId: org.orgId,
				orgDbId: org.id,
				orgName: org.name || org.orgId,
				email: '',
				status: 'pending',
				createdAt: new Date(),
			});
			const link = `${window.location.origin}/org/invite/${inviteRef.id}`;
			setInviteLink(link);
			navigator.clipboard.writeText(link).then(() => {
				setCopied('invite');
				setTimeout(() => setCopied(null), 3000);
			});
		} catch (e) {
			console.error('Failed to generate invite', e);
		} finally {
			setGeneratingInvite(false);
		}
	}

	if (!isOwner) return null;

	return (
		<section className='bg-white border border-brand-main/10 rounded-xl p-6 shadow-sm'>
			<h3 className='text-lg font-semibold text-brand-main mb-1'>Member Access</h3>
			<p className='text-xs text-gray-500 mb-4'>Share the Organization Code and PIN with people you want to invite. They can use these to join via their dashboard.</p>
			<div className='flex flex-col sm:flex-row gap-4'>
				{/* Code */}
				<div className='flex-1'>
					<label className='block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide'>Organization Code</label>
					<div className='flex items-center gap-2'>
						<span className='flex-1 font-mono text-lg font-bold tracking-widest bg-gray-50 border rounded-lg px-3 py-2 text-brand-main'>{org.orgId || '—'}</span>
						<button
							type='button'
							onClick={() => copy(org.orgId, 'code')}
							className='p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500'
							title='Copy code'
						>
							{copied === 'code' ? <span className='text-green-600 text-xs font-semibold px-1'>Copied!</span> : <ClipboardDocumentIcon className='w-4 h-4' />}
						</button>
					</div>
				</div>
				{/* PIN */}
				<div className='flex-1'>
					<label className='block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide'>Join PIN</label>
					<div className='flex items-center gap-2'>
						<span className='flex-1 font-mono text-lg font-bold tracking-widest bg-gray-50 border rounded-lg px-3 py-2 text-brand-main'>
							{org.joinPin ? (showPin ? org.joinPin : '••••') : <span className='text-gray-400 text-sm font-normal'>Not set</span>}
						</span>
						{org.joinPin && (
							<button type='button' onClick={() => setShowPin(v => !v)} className='p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500' title={showPin ? 'Hide PIN' : 'Show PIN'}>
								{showPin ? <EyeSlashIcon className='w-4 h-4' /> : <EyeIcon className='w-4 h-4' />}
							</button>
						)}
						{org.joinPin && (
							<button type='button' onClick={() => copy(org.joinPin, 'pin')} className='p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500' title='Copy PIN'>
								{copied === 'pin' ? <span className='text-green-600 text-xs font-semibold px-1'>Copied!</span> : <ClipboardDocumentIcon className='w-4 h-4' />}
							</button>
						)}
						<button type='button' onClick={regeneratePin} disabled={regenerating} className='p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500 disabled:opacity-50' title='Regenerate PIN'>
							<ArrowPathIcon className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
						</button>
					</div>
					{!org.joinPin && (
						<p className='text-xs text-amber-600 mt-1'>Click regenerate to create a PIN for this organization.</p>
					)}
				</div>
			</div>			{/* Invite Link */}
			<div className='mt-5 pt-5 border-t border-gray-100'>
				<label className='block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide'>Shareable Invite Link</label>
				<p className='text-xs text-gray-500 mb-3'>Generate a one-click invite link to share directly. Anyone with the link can join the organization.</p>
				<div className='flex items-center gap-2'>
					{inviteLink && (
						<span className='flex-1 font-mono text-xs bg-gray-50 border rounded-lg px-3 py-2 text-gray-700 truncate'>{inviteLink}</span>
					)}
					<button
						type='button'
						onClick={inviteLink ? () => copy(inviteLink, 'invite') : generateInviteLink}
						disabled={generatingInvite}
						className='flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-main text-white text-sm font-semibold hover:bg-brand-main/90 transition disabled:opacity-50'
					>
						{generatingInvite ? (
							<ArrowPathIcon className='w-4 h-4 animate-spin' />
						) : copied === 'invite' ? (
							<><ClipboardDocumentIcon className='w-4 h-4' /><span>Copied!</span></>
						) : inviteLink ? (
							<><ClipboardDocumentIcon className='w-4 h-4' /><span>Copy Link</span></>
						) : (
							<><LinkIcon className='w-4 h-4' /><span>Generate Invite Link</span></>
						)}
					</button>
					{inviteLink && (
						<button
							type='button'
							onClick={() => { setInviteLink(null); generateInviteLink(); }}
							disabled={generatingInvite}
							className='p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500 disabled:opacity-50'
							title='Generate new invite link'
						>
							<ArrowPathIcon className='w-4 h-4' />
						</button>
					)}
				</div>
			</div>		</section>
	);
}

export default function OrgSettingsTab({ org, enrichedTeam, isOwner, editMode, onOrgUpdate }: OrgSettingsTabProps){
	const [ownerTransferTarget, setOwnerTransferTarget] = useState('');
	const [ownerTransferBusy, setOwnerTransferBusy] = useState(false);
	const [ownerTransferMsg, setOwnerTransferMsg] = useState('');
		const [ownerDisplayName, setOwnerDisplayName] = useState<string>('');

	// Background controls
	const [bgUploading, setBgUploading] = useState(false);
	const [bgProgress, setBgProgress] = useState<number|null>(null);
	const [bgError, setBgError] = useState('');
	const bgInputRef = useRef<HTMLInputElement|null>(null);
	const [bgBrightness, setBgBrightness] = useState<number>(typeof org.backgroundBrightness === 'number' ? org.backgroundBrightness : 1);
	const [bgBrightnessSaving, setBgBrightnessSaving] = useState(false);
	const [bgBrightnessSavedAt, setBgBrightnessSavedAt] = useState<number>(0);
	const [bgBlur, setBgBlur] = useState<number>(typeof org.backgroundBlur === 'number' ? org.backgroundBlur : 0);
	const [bgBlurSaving, setBgBlurSaving] = useState(false);
	const [bgBlurSavedAt, setBgBlurSavedAt] = useState<number>(0);
	// Background fade overlay (darkening layer) 0 = none, 0.8 = strong
	const [bgFade, setBgFade] = useState<number>(typeof org.backgroundFade === 'number' ? org.backgroundFade : 0.4);
	const [bgFadeSaving, setBgFadeSaving] = useState(false);
	const [bgFadeSavedAt, setBgFadeSavedAt] = useState<number>(0);
		// Theme customization
			// Site default palette (orange theme) – only persist if user changes
			const DEFAULTS = {
				headerBg: '#FF6A1A', // brand.main
				headerText: '#FFFFFF',
				accent: '#FF6A1A',
				accentText: '#FFFFFF',
				accentHover: '#e75e12', // slightly darker shade
				tabActiveBg: '#FF6A1A',
				tabActiveText: '#FFFFFF',
				tabInactiveText: '#475569',
				widgetTitleColor: '#FF6A1A'
			} as const;
			const [themeHeaderBg, setThemeHeaderBg] = useState<string>(org.themeHeaderBg || DEFAULTS.headerBg);
			const [themeHeaderText, setThemeHeaderText] = useState<string>(org.themeHeaderText || DEFAULTS.headerText);
			const [themeAccent, setThemeAccent] = useState<string>(org.themeAccent || DEFAULTS.accent);
			const [themeAccentText, setThemeAccentText] = useState<string>(org.themeAccentText || DEFAULTS.accentText);
			const [themeAccentHover, setThemeAccentHover] = useState<string>(org.themeAccentHover || DEFAULTS.accentHover);
			const [themeTabActiveBg, setThemeTabActiveBg] = useState<string>(org.themeTabActiveBg || DEFAULTS.tabActiveBg);
			const [themeTabActiveText, setThemeTabActiveText] = useState<string>(org.themeTabActiveText || DEFAULTS.tabActiveText);
			const [themeTabInactiveText, setThemeTabInactiveText] = useState<string>(org.themeTabInactiveText || DEFAULTS.tabInactiveText);
			const [themeWidgetTitleColor, setThemeWidgetTitleColor] = useState<string>(org.themeWidgetTitleColor || DEFAULTS.widgetTitleColor);
		const [themeSaving, setThemeSaving] = useState(false);
		const [themeSavedAt, setThemeSavedAt] = useState<number>(0);

	// Permissions (tab access) similar to IndividualSettingsTab
	type AccessLevel = 'public' | 'supporter' | 'representative' | 'owner';
	const ROLE_ORDER: AccessLevel[] = ['public','supporter','representative','owner'];
	interface TabPermission { view: AccessLevel[]; edit: AccessLevel[]; }
	type AccessSettings = Record<string, TabPermission>;
	const DEFAULT_PERMISSIONS: AccessSettings = {
		overview: { view: ['public','supporter','representative','owner'], edit: ['owner'] },
		projects: { view: ['public','supporter','representative','owner'], edit: ['owner','representative'] },
		updates: { view: ['supporter','representative','owner'], edit: ['owner','representative'] },
		team: { view: ['supporter','representative','owner'], edit: ['owner','representative'] },
		finance: { view: ['representative','owner'], edit: ['owner'] }
	};
	function normalizeAccess(raw:any): AccessSettings {
		if(!raw || typeof raw !== 'object') return DEFAULT_PERMISSIONS;
		const out: AccessSettings = { ...DEFAULT_PERMISSIONS };
		Object.entries(raw).forEach(([k,v])=>{
			if(!(k in out)) return;
			if(v && typeof v==='object'){
				const view = Array.isArray((v as any).view)? (v as any).view.filter((r:AccessLevel)=> ROLE_ORDER.includes(r)) : out[k].view;
				const edit = Array.isArray((v as any).edit)? (v as any).edit.filter((r:AccessLevel)=> ROLE_ORDER.includes(r)) : out[k].edit;
				out[k] = { view: view.length? view: out[k].view, edit: edit.length? edit: out[k].edit };
			}
		});
		return out;
	}
	const [accessSettings, setAccessSettings] = useState<AccessSettings>(normalizeAccess(org.accessSettings));
	const [permissionsSaving, setPermissionsSaving] = useState(false);
	const [permissionsSavedAt, setPermissionsSavedAt] = useState<number>(0);
	// Visibility toggle state (default true if undefined)
	const [publicVisible, setPublicVisible] = useState<boolean>(org.publicVisible !== false);
	const [visibilitySaving, setVisibilitySaving] = useState(false);
	const [visibilitySavedAt, setVisibilitySavedAt] = useState<number>(0);
	useEffect(()=> { setAccessSettings(normalizeAccess(org.accessSettings)); }, [org.accessSettings]);
	function toggleView(tab:string, role:AccessLevel){ setAccessSettings(s=> ({ ...s, [tab]: { ...s[tab], view: s[tab].view.includes(role)? s[tab].view.filter(r=> r!==role): [...s[tab].view, role].sort((a,b)=> ROLE_ORDER.indexOf(a)-ROLE_ORDER.indexOf(b)) }})); }
	function toggleEdit(tab:string, role:AccessLevel){ if(role==='public') return; setAccessSettings(s=> ({ ...s, [tab]: { ...s[tab], edit: s[tab].edit.includes(role)? s[tab].edit.filter(r=> r!==role): [...s[tab].edit, role].sort((a,b)=> ROLE_ORDER.indexOf(a)-ROLE_ORDER.indexOf(b)) }})); }
	function sanitizePerms(inSet:AccessSettings): AccessSettings { const copy:AccessSettings = {} as any; Object.entries(inSet).forEach(([k,v])=> { const view = Array.from(new Set(v.view)).filter(r=> ROLE_ORDER.includes(r)); const edit = Array.from(new Set(v.edit)).filter(r=> ROLE_ORDER.includes(r) && view.includes(r)); copy[k] = { view, edit }; }); return copy; }
	async function savePermissions(){ if(!isOwner) return; setPermissionsSaving(true); try { const clean = sanitizePerms(accessSettings); await updateDoc(doc(db,'organizations', org.id), { accessSettings: clean }); onOrgUpdate({ accessSettings: clean }); setPermissionsSavedAt(Date.now()); } catch {/* ignore */} finally { setPermissionsSaving(false); } }

	useEffect(()=> { if(typeof org.backgroundBrightness === 'number') setBgBrightness(org.backgroundBrightness); }, [org.backgroundBrightness]);
	useEffect(()=> { if(typeof org.backgroundBlur === 'number') setBgBlur(org.backgroundBlur); }, [org.backgroundBlur]);
	useEffect(()=> { if(typeof org.backgroundFade === 'number') setBgFade(org.backgroundFade); }, [org.backgroundFade]);
			useEffect(()=> { setThemeHeaderBg(org.themeHeaderBg || DEFAULTS.headerBg); }, [org.themeHeaderBg]);
			useEffect(()=> { setThemeHeaderText(org.themeHeaderText || DEFAULTS.headerText); }, [org.themeHeaderText]);
			useEffect(()=> { setThemeAccent(org.themeAccent || DEFAULTS.accent); }, [org.themeAccent]);
			useEffect(()=> { setThemeAccentText(org.themeAccentText || DEFAULTS.accentText); }, [org.themeAccentText]);
			useEffect(()=> { setThemeAccentHover(org.themeAccentHover || DEFAULTS.accentHover); }, [org.themeAccentHover]);
			useEffect(()=> { setThemeTabActiveBg(org.themeTabActiveBg || (org.themeAccent || DEFAULTS.tabActiveBg)); }, [org.themeTabActiveBg, org.themeAccent]);
			useEffect(()=> { setThemeTabActiveText(org.themeTabActiveText || DEFAULTS.tabActiveText); }, [org.themeTabActiveText]);
			useEffect(()=> { setThemeTabInactiveText(org.themeTabInactiveText || DEFAULTS.tabInactiveText); }, [org.themeTabInactiveText]);
			useEffect(()=> { setThemeWidgetTitleColor(org.themeWidgetTitleColor || DEFAULTS.widgetTitleColor); }, [org.themeWidgetTitleColor]);
		// Resolve owner's display name (prefer enrichedTeam entry, else fetch user doc)
		useEffect(()=> {
			if(!org?.ownerUid) { setOwnerDisplayName(''); return; }
			// Try enriched team first
			const fromTeam = enrichedTeam.find(m=> m.uid === org.ownerUid);
			if(fromTeam){
				setOwnerDisplayName(fromTeam.name || fromTeam.email || fromTeam.uid || '');
				return;
			}
			let cancelled = false;
			(async()=> {
				try {
					const snap = await getDoc(doc(db,'users', org.ownerUid));
					if(!snap.exists()) { if(!cancelled) setOwnerDisplayName(org.ownerUid); return; }
					const data:any = snap.data();
					const full = [data.name, data.surname].filter(Boolean).join(' ').trim();
					const display = full || data.displayName || data.email || org.ownerUid;
					if(!cancelled) setOwnerDisplayName(display);
				} catch { if(!cancelled) setOwnerDisplayName(org.ownerUid); }
			})();
			return ()=> { cancelled = true; };
		}, [org.ownerUid, JSON.stringify(enrichedTeam.map(m=> m.uid))]);
	useEffect(()=> {
		if(!isOwner || !editMode) return;
		const h = setTimeout(async ()=> {
			try {
				setBgBrightnessSaving(true);
				await updateDoc(doc(db,'organizations', org.id), { backgroundBrightness: bgBrightness });
				onOrgUpdate({ backgroundBrightness: bgBrightness });
				setBgBrightnessSavedAt(Date.now());
			} catch {/* ignore */}
			finally { setBgBrightnessSaving(false); }
		}, 500);
		return ()=> clearTimeout(h);
	}, [bgBrightness, isOwner, editMode]);
	useEffect(()=> {
		if(!isOwner || !editMode) return;
		const h = setTimeout(async ()=> {
			try {
				setBgBlurSaving(true);
				await updateDoc(doc(db,'organizations', org.id), { backgroundBlur: bgBlur });
				onOrgUpdate({ backgroundBlur: bgBlur });
				setBgBlurSavedAt(Date.now());
			} catch {/* ignore */}
			finally { setBgBlurSaving(false); }
		}, 500);
		return ()=> clearTimeout(h);
	}, [bgBlur, isOwner, editMode]);
	useEffect(()=> {
		if(!isOwner || !editMode) return;
		const h = setTimeout(async ()=> {
			try {
				setBgFadeSaving(true);
				await updateDoc(doc(db,'organizations', org.id), { backgroundFade: bgFade });
				onOrgUpdate({ backgroundFade: bgFade });
				setBgFadeSavedAt(Date.now());
			} catch {/* ignore */}
			finally { setBgFadeSaving(false); }
		}, 500);
		return ()=> clearTimeout(h);
	}, [bgFade, isOwner, editMode]);
	useEffect(()=> {
		if(!isOwner || !editMode) return;
		const h = setTimeout(async ()=> {
			try {
				setVisibilitySaving(true);
				await updateDoc(doc(db,'organizations', org.id), { publicVisible });
				onOrgUpdate({ publicVisible });
				setVisibilitySavedAt(Date.now());
			} catch {/* ignore */} finally { setVisibilitySaving(false); }
		}, 400);
		return ()=> clearTimeout(h);
	}, [publicVisible, isOwner, editMode]);

	if(!isOwner){
		return <div className='bg-white border border-brand-main/10 rounded-xl p-6 text-sm text-gray-600'>You don't have permission to view these settings.</div>;
	}

	return (
		<div className='space-y-8'>
			{/* Member Access — org code + join PIN */}
			<MemberAccessSection org={org} isOwner={isOwner} onOrgUpdate={onOrgUpdate} />
			{/* Background Image */}
			<section className='bg-white border border-brand-main/10 rounded-xl p-6 shadow-sm'>
				<h3 className='text-lg font-semibold text-brand-main mb-2'>Background Image</h3>
				<p className='text-xs text-gray-600 mb-4'>Overrides the default site backdrop. Use a wide image (≥1600px). Auto-optimized to ≤2MB.</p>
				<div className='flex flex-col md:flex-row gap-6'>
					<div className='md:w-72 w-full'>
						<div
							className='relative group rounded-lg overflow-hidden border border-brand-main/20 bg-brand-main/5 aspect-video flex items-center justify-center cursor-pointer hover:border-brand-main/60 transition'
							onClick={()=> { if(isOwner && editMode && !bgUploading) bgInputRef.current?.click(); }}
							role={isOwner && editMode ? 'button' : undefined}
							aria-label={isOwner && editMode ? (org.backgroundUrl? 'Change background image' : 'Upload background image') : undefined}
							tabIndex={isOwner && editMode ? 0 : -1}
							onKeyDown={e=> { if((e.key==='Enter'|| e.key===' ') && isOwner && editMode && !bgUploading){ e.preventDefault(); bgInputRef.current?.click(); } }}
						>
							{org.backgroundUrl ? <img src={org.backgroundUrl} alt='Background' className='absolute inset-0 w-full h-full object-cover' /> : (
								<div className='text-[11px] text-gray-400 flex flex-col items-center justify-center text-center px-4'>
									<span>{isOwner && editMode ? 'Upload background image' : 'No background set'}</span>
								</div>
							)}
							{(isOwner && editMode) && (
								<>
									<input
										type='file'
										className='hidden'
										accept='image/png,image/jpeg,image/webp'
										ref={bgInputRef}
										onChange={async e=> {
											const file = e.target.files?.[0]; if(!file) return; setBgError(''); setBgUploading(true); setBgProgress(0);
											try {
												async function processBg(f:File): Promise<Blob>{
													const dataUrl: string = await new Promise((resolve, reject)=> { const fr = new FileReader(); fr.onerror=()=> reject(new Error('Read error')); fr.onload=()=> resolve(fr.result as string); fr.readAsDataURL(f); });
													const img: HTMLImageElement = await new Promise((resolve, reject)=> { const im = new Image(); im.onload=()=> resolve(im); im.onerror=()=> reject(new Error('Image load failed')); im.src = dataUrl; });
													const maxWidth = 2000; let { naturalWidth: w, naturalHeight: h } = img; if(w > maxWidth){ const scale = maxWidth / w; w = maxWidth; h = Math.round(h * scale); }
													const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); if(!ctx) return f;
													ctx.drawImage(img,0,0,w,h);
													const qualities = [0.85,0.75,0.65];
													for(const q of qualities){
														const blob: Blob = await new Promise(res=> canvas.toBlob(b=> res(b as Blob),'image/webp', q));
														if(blob.size <= 2*1024*1024 || q===qualities[qualities.length-1]) return blob;
													}
													return f;
												}
												const processed = await processBg(file);
												if(processed.size > 2*1024*1024) throw new Error('Image remains over 2MB after optimization');
												const ext = processed.type==='image/webp'? 'webp' : (file.name.split('.').pop() || 'jpg');
												const r = ref(storage, `organizations/${org.id}/background.${ext}`);
												const prev = org.backgroundUrl as string | undefined;
												const task = uploadBytesResumable(r, processed, { contentType: processed.type || file.type });
												task.on('state_changed', snap=> { setBgProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)); }, err=> { setBgError(err?.message || 'Upload failed'); setBgUploading(false); setBgProgress(null); }, async ()=> {
													try {
														const url = await getDownloadURL(task.snapshot.ref);
														if(prev && prev !== url){
															try {
																const match = prev.match(/\/o\/([^?]+)/); if(match){ const encoded = decodeURIComponent(match[1]).replace(/%2F/g,'/'); const objectPath = encoded.includes('organizations/')? encoded.substring(encoded.indexOf('organizations/')): encoded; const newPath = `organizations/${org.id}/background.${ext}`; if(objectPath !== newPath){ await deleteObject(ref(storage, objectPath)); } }
															} catch {/* ignore */}
														}
														await updateDoc(doc(db,'organizations', org.id), { backgroundUrl: url });
														onOrgUpdate({ backgroundUrl: url });
													} catch(e:any){ setBgError(e.message || 'Upload failed'); }
													finally { setBgUploading(false); setBgProgress(null); }
												});
											} catch(e:any){ setBgError(e.message || 'Upload failed'); setBgUploading(false); setBgProgress(null); }
											finally { if(e.target) e.target.value=''; }
										}}
									/>
									{!bgUploading && <div className='absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition'>{org.backgroundUrl? 'Change' : 'Upload'}</div>}
									{bgUploading && (
										<div className='absolute inset-0 flex flex-col items-center justify-center bg-black/40'>
											<div className='w-12 h-12 rounded-full border-2 border-white/60 border-t-transparent animate-spin mb-1' />
											<span className='text-[11px] font-semibold text-white'>{bgProgress!==null? `${bgProgress}%` : '...'}</span>
										</div>
									)}
									{org.backgroundUrl && !bgUploading && (
										<button
											type='button'
											onClick={async ev=> { ev.preventDefault(); ev.stopPropagation(); if(!confirm('Remove background image?')) return; setBgUploading(true); setBgError(''); try { try { const match = org.backgroundUrl.match(/\/o\/([^?]+)/); if(match){ const encoded = decodeURIComponent(match[1]).replace(/%2F/g,'/'); const objectPath = encoded.includes('organizations/')? encoded.substring(encoded.indexOf('organizations/')): encoded; await deleteObject(ref(storage, objectPath)); } } catch {/* ignore */} await updateDoc(doc(db,'organizations', org.id), { backgroundUrl: null }); onOrgUpdate({ backgroundUrl: null }); } catch(e:any){ setBgError(e.message || 'Remove failed'); } finally { setBgUploading(false); } }}
											className='absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full shadow flex items-center justify-center text-xs hover:bg-red-700'
											aria-label='Remove background'
										>×</button>
									)}
								</>
							)}
						</div>
						{bgError && <div className='mt-2 text-[10px] text-red-600'>{bgError}</div>}
						{bgUploading && bgProgress!==null && <div className='mt-2 text-[10px] text-gray-500'>Uploading {bgProgress}%</div>}
						{(isOwner && editMode) && <div className='mt-2 text-[10px] text-gray-400'>Recommended wide (16:9). Max 2MB.</div>}
					</div>
					<div className='flex-1 text-xs text-gray-600 space-y-2'>
						<p>Appears behind the entire organization page. Choose imagery representative of your mission. Avoid text-heavy images.</p>
						{org.backgroundUrl && <p className='text-green-700 font-medium'>Background image active.</p>}
						<div className='pt-2 border-t border-brand-main/10'>
							<div className='flex items-center justify-between mb-1'>
								<span className='font-medium text-brand-main text-[11px] tracking-wide uppercase'>Brightness</span>
								<span className='text-[10px] text-gray-500'>{bgBrightness.toFixed(2)}x</span>
							</div>
							<div className='flex items-center gap-3'>
								<input type='range' min={0.2} max={2.5} step={0.05} value={bgBrightness} disabled={!isOwner || !editMode} onChange={e=> setBgBrightness(parseFloat(e.target.value))} className='flex-1 accent-brand-main' aria-label='Background brightness' />
								<button type='button' disabled={!isOwner || !editMode || Math.abs(bgBrightness-1) < 0.01 || bgBrightnessSaving} onClick={()=> setBgBrightness(1)} className='px-2 py-1 rounded bg-white border border-brand-main/30 text-[10px] text-brand-main disabled:opacity-40'>Reset</button>
							</div>
							{(isOwner && editMode) && <div className='mt-1 text-[10px] text-gray-500 h-4'>{bgBrightnessSaving ? 'Saving…' : (bgBrightnessSavedAt ? 'Saved' : '')}</div>}
							<div className='mt-4 flex items-center justify-between mb-1'>
								<span className='font-medium text-brand-main text-[11px] tracking-wide uppercase'>Blur</span>
								<span className='text-[10px] text-gray-500'>{bgBlur.toFixed(0)}px</span>
							</div>
							<div className='flex items-center gap-3'>
								<input type='range' min={0} max={30} step={1} value={bgBlur} disabled={!isOwner || !editMode} onChange={e=> setBgBlur(parseInt(e.target.value,10))} className='flex-1 accent-brand-main' aria-label='Background blur' />
								<button type='button' disabled={!isOwner || !editMode || bgBlur===0 || bgBlurSaving} onClick={()=> setBgBlur(0)} className='px-2 py-1 rounded bg-white border border-brand-main/30 text-[10px] text-brand-main disabled:opacity-40'>Reset</button>
							</div>
							{(isOwner && editMode) && <div className='mt-1 text-[10px] text-gray-500 h-4'>{bgBlurSaving ? 'Saving…' : (bgBlurSavedAt ? 'Saved' : '')}</div>}
												<div className='mt-4 flex items-center justify-between mb-1'>
													<span className='font-medium text-brand-main text-[11px] tracking-wide uppercase'>Fade Overlay (White)</span>
													<span className='text-[10px] text-gray-500'>{bgFade.toFixed(2)}</span>
												</div>
												<div className='flex items-center gap-3'>
													<input type='range' min={0} max={0.9} step={0.05} value={bgFade} disabled={!isOwner || !editMode} onChange={e=> setBgFade(parseFloat(e.target.value))} className='flex-1 accent-brand-main' aria-label='Background fade overlay' />
													<button type='button' disabled={!isOwner || !editMode || Math.abs(bgFade-0.4)<0.01 || bgFadeSaving} onClick={()=> setBgFade(0.4)} className='px-2 py-1 rounded bg-white border border-brand-main/30 text-[10px] text-brand-main disabled:opacity-40'>Reset</button>
												</div>
												{(isOwner && editMode) && <div className='mt-1 text-[10px] text-gray-500 h-4'>{bgFadeSaving ? 'Saving…' : (bgFadeSavedAt ? 'Saved' : '')}</div>}
						</div>
					</div>
				</div>
			</section>

			{/* Theme & Permissions */}
			<div className='bg-white border border-brand-main/10 rounded-xl p-6 space-y-8 text-sm text-brand-dark'>
				<section>
					<h3 className='text-lg font-semibold text-brand-main mb-4'>Theme & Colors</h3>
					<p className='text-[11px] text-gray-600 mb-4'>Customize how your organization profile looks. These colors apply instantly for all viewers.</p>
					<div className='grid md:grid-cols-2 gap-4 text-[11px]'>
						<ColorInput label='Header Background' value={themeHeaderBg} onChange={setThemeHeaderBg} />
						<ColorInput label='Header Text' value={themeHeaderText} onChange={setThemeHeaderText} />
						<ColorInput label='Accent (Buttons / Active Tab)' value={themeAccent} onChange={setThemeAccent} />
						<ColorInput label='Accent Text' value={themeAccentText} onChange={setThemeAccentText} />
						<ColorInput label='Accent Hover' value={themeAccentHover} onChange={setThemeAccentHover} />
						<ColorInput label='Active Tab Background' value={themeTabActiveBg} onChange={setThemeTabActiveBg} />
						<ColorInput label='Active Tab Text' value={themeTabActiveText} onChange={setThemeTabActiveText} />
						<ColorInput label='Inactive Tab Text' value={themeTabInactiveText} onChange={setThemeTabInactiveText} />
						<ColorInput label='Widget Title Color' value={themeWidgetTitleColor} onChange={setThemeWidgetTitleColor} />
					</div>
					<div className='mt-4 flex items-center gap-3'>
						<button type='button' disabled={!isOwner || !editMode || themeSaving} onClick={async()=> {
							if(!isOwner) return; setThemeSaving(true);
							try {
								const patch = { themeHeaderBg, themeHeaderText, themeAccent, themeAccentText, themeAccentHover, themeTabActiveBg, themeTabActiveText, themeTabInactiveText, themeWidgetTitleColor };
								await updateDoc(doc(db,'organizations', org.id), patch);
								onOrgUpdate(patch);
								setThemeSavedAt(Date.now());
							} catch {/* ignore */}
							finally { setThemeSaving(false); }
						}} className='px-4 py-2 rounded text-xs font-semibold shadow' style={{ background:'var(--org-accent, #2563eb)', color:'var(--org-accent-text,#fff)' }}>{themeSaving? 'Saving…':'Save Theme'}</button>
						<button type='button' disabled={!isOwner || !editMode || themeSaving} onClick={()=> {
							setThemeHeaderBg(DEFAULTS.headerBg);
							setThemeHeaderText(DEFAULTS.headerText);
							setThemeAccent(DEFAULTS.accent);
							setThemeAccentText(DEFAULTS.accentText);
							setThemeAccentHover(DEFAULTS.accentHover);
							setThemeTabActiveBg(DEFAULTS.tabActiveBg);
							setThemeTabActiveText(DEFAULTS.tabActiveText);
							setThemeTabInactiveText(DEFAULTS.tabInactiveText);
							setThemeWidgetTitleColor(DEFAULTS.widgetTitleColor);
						}} className='px-4 py-2 rounded border text-xs font-semibold' style={{ borderColor:'var(--org-accent, #2563eb)', color:'var(--org-accent, #2563eb)' }}>Reset</button>
						<div className='text-[10px] text-gray-500 h-4'>{themeSaving? 'Saving…' : (themeSavedAt? 'Saved' : '')}</div>
					</div>
				</section>
			</div>
			{/* Permissions (separate card) */}
			<div className='bg-white border border-brand-main/10 rounded-xl p-6 space-y-6 text-sm text-brand-dark'>
				<h3 className='text-lg font-semibold text-brand-main mb-4'>Permissions</h3>
				<p className='text-[11px] text-gray-600'>Select which roles can view and edit each tab. Edit roles must also have view access. Public cannot edit.</p>
				<div className='space-y-4'>
					{Object.keys(DEFAULT_PERMISSIONS).map(tab=> (
						<div key={tab} className='border rounded px-3 py-3'>
							<div className='font-medium text-sm mb-2 capitalize'>{tab}</div>
							<div className='flex flex-col md:flex-row gap-4 md:gap-8'>
								<div className='flex-1'>
									<div className='text-[11px] font-semibold mb-1 text-brand-main'>View</div>
									<div className='flex flex-wrap gap-3'>
										{ROLE_ORDER.map(r=> (
											<label key={r} className='flex items-center gap-1 text-[11px]'>
												<input type='checkbox' disabled={!isOwner || !editMode} checked={accessSettings[tab].view.includes(r)} onChange={()=> toggleView(tab,r)} /> {r}
											</label>
										))}
									</div>
								</div>
								<div className='flex-1'>
									<div className='text-[11px] font-semibold mb-1 text-brand-main'>Edit</div>
									<div className='flex flex-wrap gap-3'>
										{ROLE_ORDER.map(r=> (
											<label key={r} className='flex items-center gap-1 text-[11px] opacity-90'>
												<input type='checkbox' disabled={!isOwner || !editMode || r==='public'} checked={accessSettings[tab].edit.includes(r)} onChange={()=> toggleEdit(tab,r)} /> {r}
											</label>
										))}
									</div>
									<div className='text-[10px] text-gray-400 mt-1'>Edit requires view.</div>
								</div>
							</div>
						</div>
					))}
				</div>
				<div className='flex items-center gap-4 pt-2'>
					<button type='button' onClick={savePermissions} disabled={!isOwner || !editMode || permissionsSaving} className='px-4 py-2 rounded bg-brand-main text-white text-xs font-semibold disabled:opacity-50'>{permissionsSaving? 'Saving…' : 'Save Permissions'}</button>
					<div className='text-[10px] text-gray-500 h-4'>{permissionsSaving? 'Saving…' : (permissionsSavedAt? 'Saved' : '')}</div>
				</div>
			</div>
			{/* Ownership (separate card) */}
			<div className='bg-white border border-brand-main/10 rounded-xl p-6 text-sm text-brand-dark'>
				<h3 className='text-lg font-semibold text-brand-main mb-3'>Ownership</h3>
				<p className='text-xs text-gray-600 mb-4'>Current Owner: <span className='font-semibold text-brand-dark'>{ownerDisplayName || '—'}</span></p>
				<div className='space-y-2'>
					<label className='block text-[11px] font-semibold uppercase tracking-wide text-brand-main'>Transfer Ownership</label>
					<select value={ownerTransferTarget} onChange={e=> { setOwnerTransferTarget(e.target.value); setOwnerTransferMsg(''); }} className='border rounded px-3 py-2 text-sm w-full max-w-sm'>
						<option value=''>— Select Team Member —</option>
						{enrichedTeam.filter(m=> m.uid && m.uid !== org.ownerUid).map(m=> (<option key={m.uid} value={m.uid}>{m.name || m.email || m.uid}</option>))}
					</select>
					<button type='button' disabled={!ownerTransferTarget || ownerTransferBusy} onClick={async()=> { if(!ownerTransferTarget) return; if(!confirm('Transfer ownership to this member? This gives them full control.')) return; setOwnerTransferBusy(true); setOwnerTransferMsg(''); try { await updateDoc(doc(db,'organizations', org.id), { ownerUid: ownerTransferTarget }); setOwnerTransferMsg('Ownership transferred. Reloading...'); setTimeout(()=> { setOwnerTransferBusy(false); }, 600); } catch(e:any){ setOwnerTransferMsg(e.message || 'Transfer failed'); setOwnerTransferBusy(false); } }} className='mt-2 inline-flex items-center px-4 py-2 rounded bg-brand-main text-white text-xs font-semibold hover:bg-brand-dark disabled:opacity-50'>{ownerTransferBusy? 'Transferring...' : 'Transfer'}</button>
					{ownerTransferMsg && <div className='text/[11px] text-gray-600 mt-1'>{ownerTransferMsg}</div>}
					{(!enrichedTeam.some(m=> m.uid && m.uid !== org.ownerUid)) && <div className='text-[11px] text-gray-500 mt-1'>Add at least one registered user to the team to enable transfer.</div>}
				</div>
			</div>
			{/* Visibility (separate card) */}
			<div className='bg-white border border-brand-main/10 rounded-xl p-6 text-sm text-brand-dark'>
				<h3 className='text-lg font-semibold text-brand-main mb-3'>Visibility</h3>
				<p className='text-xs text-gray-600 mb-4'>Control whether your organization appears in public organization listings and searches. You can still share the direct link when hidden.</p>
				<label className='flex items-center gap-3 text-sm font-medium'>
					<input type='checkbox' disabled={!isOwner || !editMode} checked={publicVisible} onChange={e=> setPublicVisible(e.target.checked)} />
					<span>{publicVisible ? 'Publicly Listed' : 'Hidden (Unlisted)'}</span>
				</label>
				<div className='mt-2 text-[10px] text-gray-500 h-4'>{visibilitySaving? 'Saving…' : (visibilitySavedAt? 'Saved' : '')}</div>
				{!publicVisible && <div className='mt-2 text-[11px] text-amber-600'>Hidden: only people with the direct link can view (subject to tab permissions).</div>}
			</div>
		</div>
	);
}

	function ColorInput({ label, value, onChange }: { label:string; value:string; onChange:(v:string)=>void }){
		return (
			<label className='flex items-center gap-2 font-medium'>
				<span className='w-36'>{label}</span>
				<input type='color' value={value} onChange={e=> onChange(e.target.value)} className='h-8 w-12 border rounded p-0 cursor-pointer' />
				<input type='text' value={value} onChange={e=> onChange(e.target.value)} className='flex-1 border rounded px-2 py-1 text-[11px] font-mono' />
				<span className='h-6 w-6 rounded border shadow-inner' style={{ background:value }}></span>
			</label>
		);
	}

