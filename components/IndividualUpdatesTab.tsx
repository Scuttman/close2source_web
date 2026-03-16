"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../src/lib/firebase';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import ImageUploadGrid, { ImageUploadEntry } from './ImageUploadGrid';

// Props contract mirrors the state/handlers in the profile page so we can fully externalize the tab.
export interface IndividualUpdatesTabProps {
	individual: any;
	filteredUpdates: any[];
	searchValue: string;
	setSearchValue: (v: string) => void;
	tagFilter: string;
	setTagFilter: (v: string) => void;
	showPostModal: boolean;
	setShowPostModal: (v: boolean) => void;
	submitComment: (i: number) => Promise<void> | void;
	commentInputs: Record<number, string>;
	setCommentInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
	commentSubmitting: Record<number, boolean>;
	code: string; // individual id/code used when creating a new post
	onPostCreated: (u:any)=>void;
}

function SidebarSearchTags({ updates, searchValue, setSearchValue, tagFilter, setTagFilter, totalCount, visibleCount, canShowMore, onShowMore }: any) {
	const allTags = useMemo(() => {
		const s = new Set<string>();
		(updates || []).forEach((u: any) => Array.isArray(u?.tags) && u.tags.forEach((t: string) => s.add(t)));
		return Array.from(s).sort();
	}, [updates]);
	return (
		<div className="bg-white rounded-xl border border-brand-main/10 p-4 mb-4 shadow-sm">
			<input value={searchValue} onChange={e=>setSearchValue(e.target.value)} placeholder="Search posts..." className="w-full border rounded px-3 py-2 mb-3 text-sm" />
			<div className="mb-2 font-semibold text-brand-main text-xs">Filter by tag</div>
			<div className="flex flex-wrap gap-2">
				{allTags.length === 0 && <span className="text-gray-400 text-xs">No tags</span>}
				{allTags.map(tag => (
					<span key={tag} onClick={()=>setTagFilter(tagFilter===tag? '': tag)} className={`bg-brand-main/10 text-brand-main text-xs px-2 py-1 rounded-full cursor-pointer hover:bg-brand-main/20 ${tagFilter===tag? 'ring-2 ring-brand-main':''}`}>#{tag}</span>
				))}
			</div>
			{canShowMore && (
				<button onClick={onShowMore} className="mt-4 w-full text-center text-xs font-semibold px-3 py-2 rounded bg-brand-main text-white hover:bg-brand-dark">
					Show more ({visibleCount} / {totalCount})
				</button>
			)}
		</div>
	);
}

export default function IndividualUpdatesTab(props: IndividualUpdatesTabProps) {
	const {
		individual,
		filteredUpdates,
		searchValue,
		setSearchValue,
		tagFilter,
		setTagFilter,
		showPostModal,
		setShowPostModal,
		submitComment,
		commentInputs,
		setCommentInputs,
		commentSubmitting,
		code,
		onPostCreated
	} = props;

	// Prefer unified profilePosts for displayed posts (any type) where showInUpdatesFeed true
	const profilePosts = Array.isArray(individual.profilePosts)? individual.profilePosts: [];
	const showablePosts = profilePosts.filter((p:any)=> p.showInUpdatesFeed);
	const rawFeed = Array.isArray(individual.feed) ? individual.feed : [];
	const fallbackFeedUpdates = rawFeed.filter((f:any)=> f.type==='update');
	const displayUpdates = showablePosts.length? showablePosts: (fallbackFeedUpdates.length? fallbackFeedUpdates: individual.updates || []);

	const updatesPanelRef = useRef<HTMLDivElement>(null);

	// Pagination state for updates list
	const [visibleCount, setVisibleCount] = useState(10);
	useEffect(()=>{ setVisibleCount(10); }, [searchValue, tagFilter, individual?.id]);
	const totalCount = filteredUpdates.length;
	const slicedUpdates = filteredUpdates.slice(0, visibleCount);
	const canShowMore = visibleCount < totalCount;

	// Lightbox viewer state
	const [lightboxImages, setLightboxImages] = useState<string[]|null>(null);
	const [lightboxIndex, setLightboxIndex] = useState(0);

	// Simple in-memory cache of loaded image URLs (persists across component lifetimes while page mounted)
	const loadedCacheRef = useRef<Set<string>>(new Set());

	async function handleDeletePost(post:any){
		if(!individual?.id) return;
		if(!confirm('Delete this post? This cannot be undone.')) return;
		try {
			const refDoc = doc(db,'individuals',individual.id);
			// Remove from legacy arrays & unified profilePosts if present
			const prevProfilePosts = Array.isArray(individual.profilePosts)? individual.profilePosts: [];
			const nextProfilePosts = prevProfilePosts.filter((p:any)=> p.id!==post.id);
			const prevFeed = Array.isArray(individual.feed)? individual.feed: [];
			const nextFeed = prevFeed.filter((f:any)=> f.id!==post.id);
			const prevUpdates = Array.isArray(individual.updates)? individual.updates: [];
			const nextUpdates = prevUpdates.filter((u:any)=> u.id!==post.id);
			await updateDoc(refDoc,{ profilePosts: nextProfilePosts, feed: nextFeed, updates: nextUpdates });
			// Delete any stored image paths (we stored path in imagesPaths when created) or derive from URL if pattern matches
			const imagePaths: string[] = Array.isArray(post.imagePaths)? post.imagePaths: [];
			if(imagePaths.length){
				await Promise.all(imagePaths.map(p=> deleteObject(storageRef(storage,p)).catch(()=>{})));
			}
		} catch(err){ /* ignore */ }
	}

	// Lazy image wrapper (mount only when in viewport, then persistent)
	const LazyImg: React.FC<{ src:string; alt:string; className?:string; fill?:boolean; sizes?:string; onClick?:()=>void }>= ({src, alt, className='', fill=false, sizes='(max-width:768px) 100vw, 50vw', onClick}) => {
		const containerRef = useRef<HTMLDivElement|null>(null);
		const [visible, setVisible] = useState(() => loadedCacheRef.current.has(src));
		useEffect(()=>{
			if(visible) return; // already visible / loaded
			const el = containerRef.current; if(!el) return;
			const obs = new IntersectionObserver((entries)=>{
				entries.forEach(e=>{
					if(e.isIntersecting){ setVisible(true); obs.disconnect(); }
				});
			}, { rootMargin: '200px 0px 200px 0px', threshold: 0.01 });
			obs.observe(el);
			return ()=> obs.disconnect();
		}, [visible]);
		return (
			<div
				ref={containerRef}
				onClick={onClick}
				className={(className + (onClick? ' cursor-pointer':'') + (fill? ' w-full h-full':'')).trim()}
				style={{ position: fill? 'relative': undefined }}
			>
				{visible ? (
					<Image
						src={src}
						alt={alt}
						fill={fill || undefined}
						width={fill? undefined: 800}
						height={fill? undefined: 600}
						className={fill? 'object-cover w-full h-full': 'object-cover w-full h-full'}
						loading="lazy"
						sizes={sizes}
						onLoad={()=> loadedCacheRef.current.add(src)}
					/>
				): (
					<div className="w-full h-full relative overflow-hidden rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse">
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="w-6 h-6 border-2 border-brand-main/30 border-t-brand-main rounded-full animate-spin" />
						</div>
					</div>
				)}
			</div>
		);
	};

	function openLightbox(images:string[], index:number){
		setLightboxImages(images);
		setLightboxIndex(index);
	}
	function closeLightbox(){ setLightboxImages(null); setLightboxIndex(0);} 
	function stepLightbox(delta:number){ if(!lightboxImages) return; setLightboxIndex(i=> (i+delta+lightboxImages.length)%lightboxImages.length); }

	// Keyboard controls for lightbox
	useEffect(()=>{
		if(!lightboxImages) return;
		function handler(e:KeyboardEvent){
			if(e.key==='Escape'){ e.preventDefault(); closeLightbox(); }
			else if(e.key==='ArrowRight'){ e.preventDefault(); stepLightbox(1); }
			else if(e.key==='ArrowLeft'){ e.preventDefault(); stepLightbox(-1); }
		}
		window.addEventListener('keydown', handler);
		return ()=> window.removeEventListener('keydown', handler);
	},[lightboxImages]);

	function renderImages(images:string[], type:string){
		// Sanitize: flatten, extract string urls, remove falsy / malformed
		const valid = (images||[]) 
			.map((v:any)=>{
				if(typeof v === 'string') return v.trim();
				if(v && typeof v==='object' && typeof v.url==='string') return v.url.trim();
				return '';
			})
			.filter(u=> u && /^(https?:)?\/\//.test(u));
		if(!valid.length) return null;
		const count = valid.length;
		// Single image full-width
		if(count===1){
			return (
				<div className="mb-3 relative group" onClick={()=>openLightbox(images,0)}>
					<LazyImg src={valid[0]} alt={type} className="w-full h-auto rounded border overflow-hidden" />
				</div>
			);
		}
		// We'll handle custom patterns for 2..5 and 6+ with overlay; using sanitized list 'valid'
		if(count===2){
			// Ensure visible height (aspect-video may not be available if plugin missing)
			return (
				<div className="mb-3 grid grid-cols-2 gap-2">
					{valid.map((src,idx)=>(
						<div key={idx} className="relative h-48 rounded overflow-hidden bg-gray-100" onClick={()=>openLightbox(valid,idx)}>
							<LazyImg src={src} alt={type+ ' image '+(idx+1)} fill />
						</div>
					))}
				</div>
			);
		}
		if(count===3){
			// Layout: first image left  (span 2 rows), two stacked on right
			return (
				<div className="mb-3 grid grid-cols-3 gap-2 h-56">
					<div className="col-span-2 row-span-2 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,0)}>
						<LazyImg src={valid[0]} alt={type+' image 1'} fill />
					</div>
					<div className="col-span-1 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,1)}>
						<LazyImg src={valid[1]} alt={type+' image 2'} fill />
					</div>
					<div className="col-span-1 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,2)}>
						<LazyImg src={valid[2]} alt={type+' image 3'} fill />
					</div>
				</div>
			);
		}
		if(count===4){
			return (
				<div className="mb-3 grid grid-cols-2 gap-2">
					{valid.map((src,idx)=>(
						<div key={idx} className="relative aspect-video rounded overflow-hidden" onClick={()=>openLightbox(valid,idx)}>
							<LazyImg src={src} alt={type+' image '+(idx+1)} fill />
						</div>
					))}
				</div>
			);
		}
		if(count===5){
			// Layout: big left (2 rows), 2 small top-right, 2 small bottom-right
			return (
				<div className="mb-3 grid grid-cols-3 gap-2 h-60">
					<div className="col-span-2 row-span-2 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,0)}>
						<LazyImg src={valid[0]} alt={type+' image 1'} fill />
					</div>
					{valid.slice(1).map((src,idx)=>(
						<div key={idx+1} className="relative rounded overflow-hidden h-28" onClick={()=>openLightbox(valid,idx+1)}>
							<LazyImg src={src} alt={type+' image '+(idx+2)} fill />
						</div>
					))}
				</div>
			);
		}
		// 6 or more: Use 5-layout plus overlay on last tile with +N
		const moreCount = count - 5;
		return (
			<div className="mb-3 grid grid-cols-3 gap-2 h-60">
				<div className="col-span-2 row-span-2 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,0)}>
					<LazyImg src={valid[0]} alt={type+' image 1'} fill />
				</div>
				{valid.slice(1,5).map((src,idx)=>(
					<div key={idx+1} className="relative rounded overflow-hidden h-28" onClick={()=>openLightbox(valid,idx+1)}>
						<LazyImg src={src} alt={type+' image '+(idx+2)} fill />
						{idx===3 && (valid.length - 5)>0 && (
							<button onClick={(e)=>{e.stopPropagation(); openLightbox(valid,0);}} className="absolute inset-0 bg-black/50 text-white text-xl font-semibold flex items-center justify-center">
								+{valid.length - 5}
							</button>
						)}
					</div>
				))}
			</div>
		);
	}

	// Slideshow renderer (landscape auto-advancing)
	const Slideshow: React.FC<{ images:string[] }>= ({ images }) => {
		const imgs = (images||[]).filter(Boolean);
		const [index, setIndex] = useState(0);
		const [paused, setPaused] = useState(false);
		useEffect(()=>{
			if(paused || imgs.length<=1) return;
			const id = setInterval(()=> setIndex(i=> (i+1)%imgs.length), 3000);
			return ()=> clearInterval(id);
		},[paused, imgs.length]);
		useEffect(()=>{ if(index>=imgs.length) setIndex(0); },[imgs.length,index]);
		if(!imgs.length) return null;
		return (
			<div className="mb-3 group relative rounded-xl overflow-hidden border bg-black/5" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
				<div className="relative w-full aspect-video bg-gray-100">
					{imgs.map((src,i)=>(
						<div key={i} className={`absolute inset-0 transition-opacity duration-700 ${i===index? 'opacity-100':'opacity-0'} flex items-center justify-center bg-black/5`}> 
							<LazyImg src={src} alt={'slide '+(i+1)} fill />
						</div>
					))}
					{/* Controls */}
					<button type="button" aria-label="Open image in lightbox" onClick={(e)=>{e.stopPropagation(); openLightbox(imgs,index);}} className="absolute top-2 right-2 bg-black/45 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">
						&#128269;
					</button>
					<button type="button" aria-label="Previous" onClick={(e)=>{e.stopPropagation(); setIndex(i=> (i-1+imgs.length)%imgs.length);}} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">‹</button>
					<button type="button" aria-label="Next" onClick={(e)=>{e.stopPropagation(); setIndex(i=> (i+1)%imgs.length);}} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">›</button>
					<button type="button" aria-label={paused? 'Play slideshow':'Pause slideshow'} onClick={(e)=>{e.stopPropagation(); setPaused(p=>!p);}} className="absolute bottom-2 right-2 bg-black/40 hover:bg-black/60 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">{paused? 'Play':'Pause'}</button>
					<div className="absolute bottom-2 left-2 flex gap-1">
						{imgs.map((_,i)=>(
							<button key={i} aria-label={`Go to slide ${i+1}`} onClick={(e)=>{e.stopPropagation(); setIndex(i);}} className={`w-2 h-2 rounded-full ${i===index? 'bg-white':'bg-white/40 hover:bg-white/70'}`} />
						))}
					</div>
				</div>
			</div>
		);
	};

	return (
		<>
		<div ref={updatesPanelRef} className="flex flex-col lg:flex-row gap-8">
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
					<h2 className="font-bold text-lg">Updates</h2>
					<button onClick={()=> setShowPostModal(!showPostModal)} className="inline-flex items-center gap-1 px-3 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark">
						{showPostModal? 'Close':' + New'}
					</button>
				</div>
				<div className="mb-4 lg:hidden">
					<SidebarSearchTags
						updates={displayUpdates}
						sourceUpdates={displayUpdates}
						searchValue={searchValue}
						setSearchValue={setSearchValue}
						tagFilter={tagFilter}
						setTagFilter={setTagFilter}
						totalCount={totalCount}
						visibleCount={visibleCount}
						canShowMore={canShowMore}
						onShowMore={()=> setVisibleCount(c=> Math.min(c+10, totalCount))}
					/>
				</div>
				{/* Mobile inline composer (appears above list) */}
				{showPostModal && (
					<div className="mb-6 lg:hidden">
						<InlineComposer
							individual={individual}
							code={code}
							onPostCreated={onPostCreated}
							onClose={()=> setShowPostModal(false)}
						/>
					</div>
				)}
				{slicedUpdates.length ? (
					<ul className="space-y-4">
							{slicedUpdates.map((u:any,i:number)=>{
							const type = u.type || 'update';
							const isPrayer = type==='prayer';
							const isFunding = type==='funding';
								const authUser = getAuth().currentUser;
								const canDelete = !!authUser && ( (u.author && (authUser.displayName===u.author || authUser.email===u.author)) || (individual?.ownerId && individual.ownerId===authUser.uid) || (individual?.ownerUID && individual.ownerUID===authUser.uid) );
							const containerClasses = isPrayer
								? 'bg-purple-50 border-purple-300'
								: isFunding
									? 'bg-amber-50 border-amber-300'
									: 'bg-white border-brand-main/10';
							return (
								<li key={i} className={`rounded-xl border p-4 shadow-sm ${containerClasses}`}>
									<div className="flex items-center justify-between mb-2">
										<div className="flex items-center gap-2">
											{u.authorPhotoUrl ? (
												<Image src={u.authorPhotoUrl} alt="avatar" width={32} height={32} className="rounded-full border object-cover" />
											): (
												<div className="w-8 h-8 rounded-full bg-brand-main/20 flex items-center justify-center text-brand-main font-bold">{(u.author||'U')[0]}</div>
											)}
											<span className="text-sm font-semibold text-brand-main flex items-center gap-2">
												{u.author || 'Unknown'}
												{isPrayer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600 text-white uppercase tracking-wide">Prayer</span>}
												{isFunding && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white uppercase tracking-wide">Funding</span>}
											</span>
										</div>
										<div className="flex items-center gap-3">
											<span className="text-xs text-gray-500">{u.createdAt? new Date(u.createdAt).toLocaleString():''}</span>
											{canDelete && (
												<button onClick={()=> handleDeletePost(u)} className="text-[10px] uppercase tracking-wide font-semibold text-red-600 hover:text-red-700 px-2 py-1 border border-red-500/40 rounded">Delete</button>
											)}
										</div>
									</div>
									{u.title && <div className="font-semibold mb-1">{u.title}</div>}
									{Array.isArray(u.images) && u.images.length>0 && (u.slideshow ? <Slideshow images={u.images} /> : renderImages(u.images, type))}
									<div className="text-sm text-brand-dark whitespace-pre-wrap">{u.text || u.description}</div>
									{isFunding && (u.targetAmount || u.currency) && (
										<div className="mt-2 text-xs font-medium text-amber-700">Goal: {u.targetAmount? `${u.currency||''} ${Number(u.targetAmount).toLocaleString()}`: 'N/A'}</div>
									)}
									{Array.isArray(u.tags) && u.tags.length>0 && (
										<div className="mt-2 flex flex-wrap gap-2">
											{u.tags.map((t:string,ti:number)=>(<span key={ti} onClick={()=>setTagFilter(tagFilter===t?'':t)} className={`px-2 py-1 rounded-full text-xs cursor-pointer bg-brand-main/10 text-brand-main hover:bg-brand-main/20 ${tagFilter===t?'ring-2 ring-brand-main':''}`}>#{t}</span>))}
										</div>
									)}
									{/* Reactions / responses area */}
									{type==='update' && (
										<div className="mt-3 flex gap-4 text-sm">
											<button className="text-brand-main hover:text-brand-dark flex items-center gap-1">🙏 {u.reactions?.pray ?? 0}</button>
											<button className="text-brand-main hover:text-brand-dark flex items-center gap-1">❤️ {u.reactions?.love ?? 0}</button>
										</div>
									)}
									{isPrayer && Array.isArray(u.responses) && (
										<div className="mt-3 flex gap-4 text-xs text-purple-700">
											<span>🙏 {u.responses.filter((r:any)=> r.type==='pray').length}</span>
											<span>🙌 {u.responses.filter((r:any)=> r.type==='amen').length}</span>
										</div>
									)}
									{/* Comments (updates use comments; prayer uses comments too) */}
									<div className="mt-4">
										<div className="text-xs font-semibold text-brand-main mb-2">Comments</div>
										<ul className="space-y-2 mb-3">
											{(u.comments||[]).map((c:any,ci:number)=>(
												<li key={ci} className="flex gap-2 items-start">
													<div className="w-7 h-7 rounded-full bg-brand-main/20 flex items-center justify-center text-brand-main text-xs font-bold border">{(c.author||'U')[0]}</div>
													<div>
														<div className="text-xs font-semibold text-brand-main">{c.author||'Unknown'} <span className="text-gray-400 font-normal">{c.createdAt? new Date(c.createdAt).toLocaleString():''}</span></div>
														<div className="text-sm text-brand-dark">{c.text}</div>
													</div>
												</li>
											))}
										</ul>
										<form onSubmit={e=>{e.preventDefault(); submitComment(i);}} className="flex gap-2">
											<input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Write a comment..." value={commentInputs[i]||''} onChange={e=>setCommentInputs(prev=>({...prev,[i]:e.target.value}))} disabled={commentSubmitting[i]} />
											<button disabled={commentSubmitting[i] || !(commentInputs[i]||'').trim()} className="px-3 py-1 rounded bg-brand-main text-white text-xs font-semibold disabled:opacity-50">Post</button>
										</form>
									</div>
								</li>
							);
						})}
					</ul>
				) : <div className="text-gray-400 italic">No updates yet.</div>}

			</div>
				<div className="w-full lg:w-72 lg:ml-4 flex-shrink-0 hidden lg:block">
					{showPostModal && (
						<div className="mb-6">
							<InlineComposer
								individual={individual}
								code={code}
								onPostCreated={onPostCreated}
								onClose={()=> setShowPostModal(false)}
							/>
						</div>
					)}
					<SidebarSearchTags
						updates={displayUpdates}
						searchValue={searchValue}
						setSearchValue={setSearchValue}
						tagFilter={tagFilter}
						setTagFilter={setTagFilter}
						totalCount={totalCount}
						visibleCount={visibleCount}
						canShowMore={canShowMore}
						onShowMore={()=> setVisibleCount(c=> Math.min(c+10, totalCount))}
					/>
				</div>
			{/* Inline composer appears in sidebar (lg) or above list (mobile) instead of modal */}
		</div>
		{/* Lightbox Portal */}
		{lightboxImages && typeof document!=='undefined' ? createPortal(
			<div className="fixed inset-0 z-[200] bg-black/90 flex flex-col" aria-modal="true" role="dialog">
				<div className="flex justify-between items-center p-3 sm:p-4 text-white text-xs sm:text-sm">
					<div className="font-medium tracking-wide">{lightboxIndex+1} / {lightboxImages!.length}</div>
					<div className="flex gap-2 sm:gap-3">
						<button onClick={()=>stepLightbox(-1)} className="px-2 sm:px-3 py-1 rounded bg-white/20 hover:bg-white/30">Prev</button>
						<button onClick={()=>stepLightbox(1)} className="px-2 sm:px-3 py-1 rounded bg-white/20 hover:bg-white/30">Next</button>
						<button onClick={closeLightbox} className="px-2 sm:px-3 py-1 rounded bg-white/20 hover:bg-white/30">Close</button>
					</div>
				</div>
				<div className="flex-1 flex items-center justify-center px-2 sm:px-6 pb-4" onClick={closeLightbox}>
					<Image src={lightboxImages![lightboxIndex]} alt={'image '+(lightboxIndex+1)} width={1600} height={1200} className="max-h-full max-w-full w-auto h-auto rounded shadow-2xl object-contain" />
				</div>
				<div className="flex gap-1 sm:gap-2 overflow-x-auto px-2 sm:px-4 pb-4 bg-black/60">
					{lightboxImages!.map((img,i)=>(
						<button key={i} onClick={(e)=>{e.stopPropagation(); setLightboxIndex(i);}} className={`h-14 w-16 sm:h-16 sm:w-20 flex-shrink-0 rounded overflow-hidden border ${i===lightboxIndex? 'ring-2 ring-white':''}`}> 
							<Image src={img} alt={'thumb '+(i+1)} width={160} height={120} className="object-cover w-full h-full" />
						</button>
					))}
				</div>
			</div>, document.body) : null}
			</>
		);
}

// Inline composer for creating a new update post (replaces modal UX)
function InlineComposer({ individual, code, onPostCreated, onClose }: { individual:any; code:string; onPostCreated:(u:any)=>void; onClose:()=>void }) {
	const auth = getAuth();
	const user = auth.currentUser;
	const [title, setTitle] = useState('');
	const [text, setText] = useState('');
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState('');
	const [imageEntries, setImageEntries] = useState<ImageUploadEntry[]>([]);
	const [resetImagesKey, setResetImagesKey] = useState(0);
	const [posting, setPosting] = useState(false);
	const [slideshow, setSlideshow] = useState(false);
	async function submit(e:React.FormEvent){
		e.preventDefault();
		if(!user || posting) return;
		const postedImages = imageEntries.filter(e=> e.status==='done' && e.url).map(e=> e.url as string);
		if(!text.trim() && postedImages.length===0) return;
		setPosting(true);
		try {
			const docId = individual.id;
			if(!docId) throw new Error('Missing profile id');
			const imageUrls = postedImages;
			// Derive storage paths from download URLs (Firebase encodes path after /o/)
			const imagePaths = imageEntries.filter(e=> e.status==='done' && e.url).map(e=>{
				try {
					if(!e.url) return '';
					const u = new URL(e.url);
					const marker = '/o/';
					const idx = u.pathname.indexOf(marker);
					if(idx>=0){
						const encoded = u.pathname.slice(idx+marker.length);
						return decodeURIComponent(encoded);
					}
				} catch {}
				return '';
			}).filter(Boolean);
			const newUpdate = {
				id: (crypto as any).randomUUID? (crypto as any).randomUUID(): Math.random().toString(36).slice(2),
				title: title.trim()||undefined,
				text: text.trim(),
				images: imageUrls,
				slideshow: slideshow && imageUrls.length>1 ? true: false,
				createdAt: new Date().toISOString(),
				author: user.displayName || user.email || user.uid,
				authorPhotoUrl: user.photoURL || null,
				tags,
				reactions: { pray:0, love:0 },
				comments: [],
				imagePaths
			};
			// Build updated arrays with backward fields + unified profilePosts
			const prevUpdates = Array.isArray(individual.updates)? individual.updates: [];
			const updatedUpdates = [newUpdate, ...prevUpdates];
			const feedEntry = { type:'update', ...newUpdate };
			const prevFeed = Array.isArray(individual.feed)? individual.feed: [];
			const updatedFeed = [feedEntry, ...prevFeed];
			const prevProfilePosts = Array.isArray(individual.profilePosts)? individual.profilePosts: [];
			const updatedProfilePosts = [{ type:'update', showInUpdatesFeed:true, ...newUpdate }, ...prevProfilePosts];
			const refDoc = doc(db, 'individuals', docId);
			const sanitize = (v:any):any => Array.isArray(v)? v.map(sanitize): (v && typeof v==='object'? Object.fromEntries(Object.entries(v).filter(([_,val])=> val!==undefined).map(([k,val])=> [k,sanitize(val)])): v);
			await updateDoc(refDoc, { updates: updatedUpdates.map(sanitize), feed: updatedFeed.map(sanitize), profilePosts: updatedProfilePosts.map(sanitize) });
			onPostCreated(newUpdate);
			setTitle(''); setText(''); setTags([]); setTagInput(''); setImageEntries([]); setSlideshow(false); setResetImagesKey(k=>k+1); onClose();
		} catch(err){ /* silent */ } finally { setPosting(false); }
	}

	function attemptAddTag(){
		const raw = tagInput.trim();
		if(!raw) return;
		let cleaned = raw.startsWith('#')? raw.slice(1): raw;
		cleaned = cleaned.replace(/[,\s]+$/,'');
		if(!cleaned) return;
		if(tags.includes(cleaned.toLowerCase())){ setTagInput(''); return; }
		setTags(prev=> [...prev, cleaned.toLowerCase()]);
		setTagInput('');
	}

	function removeTag(t:string){ setTags(prev=> prev.filter(x=> x!==t)); }
	return (
		<form onSubmit={submit} className="bg-white border border-brand-main/20 rounded-xl p-4 shadow-sm flex flex-col gap-2">
			<div className="text-sm font-semibold text-brand-main">Create Update</div>
			<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title (optional)" className="border rounded px-2 py-1 text-sm" disabled={posting || !user} />
			<textarea value={text} onChange={e=>setText(e.target.value)} placeholder={user? 'What\'s new?':'Sign in to post'} className="border rounded px-2 py-2 text-sm h-24 resize-none" disabled={posting || !user} />
			<div>
				<label className="sr-only">Add tag</label>
				<input
					value={tagInput}
					onChange={e=> setTagInput(e.target.value)}
					onKeyDown={e=>{
						if(e.key==='Enter' || e.key==='Tab'){ e.preventDefault(); attemptAddTag(); }
						if(e.key===',' ){ e.preventDefault(); attemptAddTag(); }
					}}
					placeholder={user? 'Type tag and press Enter':'Sign in to add tags'}
					className="border rounded px-2 py-1 text-xs w-full"
					disabled={posting || !user}
				/>
				{tags.length>0 && (
					<div className="mt-2 flex flex-wrap gap-2">
						{tags.map(t=> (
							<span key={t} className="inline-flex items-center gap-1 bg-brand-main/10 text-brand-main text-[11px] font-medium px-2 py-1 rounded-full">
								#{t}
								<button type="button" onClick={()=> removeTag(t)} className="ml-1 text-brand-main/70 hover:text-brand-main focus:outline-none" aria-label={`Remove tag ${t}`}>×</button>
							</span>
						))}
					</div>
				)}
			</div>
			<ImageUploadGrid
				disabled={posting || !user}
				maxFiles={8}
				maxWidth={500}
				resetKey={resetImagesKey}
				onChange={setImageEntries}
				pathBuilder={(file, entryId)=> `individuals/${individual?.id || 'unknown'}/updates/${user?.uid || 'anon'}/${Date.now()}_${entryId}_${file.name}`}
				addButtonClassName="w-24 h-24 border-2 border-dashed rounded flex items-center justify-center text-gray-400 hover:border-brand-main hover:text-brand-main text-3xl font-light"
				squareSize={96}
			/>
			<div className="flex items-center gap-2 text-xs mt-1 select-none">
				<input id="slideshow" type="checkbox" className="w-4 h-4" checked={slideshow} disabled={posting || !user || imageEntries.filter(e=> e.status==='done' && e.url).length<2} onChange={e=> setSlideshow(e.target.checked)} />
				<label htmlFor="slideshow" className={"cursor-pointer "+ (imageEntries.filter(e=> e.status==='done' && e.url).length<2? 'text-gray-400':'text-brand-main')}>Slideshow (2+ images)</label>
			</div>
			<div className="text-[10px] text-gray-400">Images auto-resized to max width 500px.</div>
			<div className="flex gap-2 mt-2">
				<button type="submit" disabled={posting || !user || (!text.trim() && imageEntries.filter(e=> e.status==='done' && e.url).length===0)} className="flex-1 px-3 py-1.5 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50">{posting? 'Posting...':'Post'}</button>
				<button type="button" onClick={onClose} disabled={posting} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
			</div>
		</form>
	);
}
