"use client";

import React, { useState, useRef, useCallback } from "react";
import { PencilIcon, TrashIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { getAuth } from "firebase/auth";
import { db, storage } from "../src/lib/firebase"; // relative to components folder
import ImageUploadGrid, { ImageUploadEntry } from './ImageUploadGrid';

interface FundingNeed {
  id: string;
  title: string;
  description: string;
  targetAmount?: number; // optional numeric goal
  currency?: string; // e.g. USD
  createdAt: string;
  author: string;
  images?: string[]; // uploaded image URLs
}

interface GivingLink {
  id: string;
  label: string;
  url: string;
  createdAt: string;
  author: string;
  country?: string; // dynamic grouping key
  type?: 'paypal' | 'generic';
  currency?: string; // for paypal donate
  paypalEmail?: string; // stored for reference
}

interface Props {
  individual: any;
  onUpdate?: (data: { fundingNeeds: FundingNeed[]; givingLinks: GivingLink[] }) => void;
  readOnly?: boolean;
}

// Comprehensive ISO 4217 currency codes list (common + extended) for funding needs & PayPal donations.
// Duplicate codes are automatically removed while preserving first occurrence order.
const RAW_CURRENCIES: string[] = [
  'USD','EUR','GBP','AUD','CAD','NZD','CHF','JPY','CNY','HKD','SGD','ZAR','KES','NGN','GHS','UGX','TZS','ETB','XAF','XOF','MAD','EGP','INR','PHP','IDR','MYR','THB','VND','KRW','BRL','MXN','ARS','CLP','COP','PEN',
  // Extended set
  'AED','AFN','ALL','AMD','ANG','AOA','ARS','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BSD','BTN','BWP','BYN','BZD','CDF','CHE','CHW','CLF','CNH','CRC','CUC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','ERN','ESP','FJD','FKP','GEL','GIP','GMD','GNF','GTQ','GYD','HNL','HRK','HTG','HUF','IMP','IRR','ISK','JEP','JMD','JOD','KGS','KHR','KMF','KPW','KWD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MZN','NAD','NIO','NOK','NPR','OMR','PAB','PGK','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SHP','SLL','SOS','SRD','SSP','STN','SVC','SYP','SZL','TND','TOP','TRY','TTD','TWD','UAH','UYU','UZS','VES','VUV','WST','XCD','XPF','YER','ZMW'
];
const CURRENCIES: string[] = Array.from(new Set(RAW_CURRENCIES));

export default function IndividualFinanceTab({ individual, onUpdate, readOnly=false }: Props) {
  const auth = getAuth();
  const user = auth.currentUser;

  const fundingNeeds: FundingNeed[] = Array.isArray(individual.fundingNeeds) ? individual.fundingNeeds : [];
  const givingLinks: GivingLink[] = Array.isArray(individual.givingLinks) ? individual.givingLinks : [];

  const [needTitle, setNeedTitle] = useState("");
  const [needDesc, setNeedDesc] = useState("");
  const [needTarget, setNeedTarget] = useState("");
  const [needCurrency, setNeedCurrency] = useState("USD");
  const [addingNeed, setAddingNeed] = useState(false);
  // Pre-uploaded image management
  const [needImages, setNeedImages] = useState<ImageUploadEntry[]>([]);
  const needIdRef = useRef<string>(uuid());

  const uploadPathBuilder = useCallback((file: File, entryId: string) => `individuals/${individual.id}/fundingNeeds/${needIdRef.current}/${Date.now()}_${file.name}`, [individual.id]);

  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCountry, setLinkCountry] = useState("");
  const [isPayPal, setIsPayPal] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalCurrency, setPaypalCurrency] = useState("USD");
  const [addingLink, setAddingLink] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string|null>(null);
  const [editing, setEditing] = useState(false); // saving state for edit
  const [editLabel, setEditLabel] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editIsPayPal, setEditIsPayPal] = useState(false);
  const [editPaypalEmail, setEditPaypalEmail] = useState("");
  const [editPaypalCurrency, setEditPaypalCurrency] = useState("USD");
  const [editUrl, setEditUrl] = useState("");

  function uuid(){ return crypto.randomUUID? crypto.randomUUID(): Math.random().toString(36).slice(2); }

  async function persist(updatedNeeds: FundingNeed[], updatedLinks: GivingLink[]) {
    try {
      // Update unified profilePosts as well
      const existingUpdates = Array.isArray(individual.updates)? individual.updates: [];
      const prayers = Array.isArray(individual.prayerRequests)? individual.prayerRequests: [];
      let profilePosts: any[] = Array.isArray(individual.profilePosts)? individual.profilePosts: [];
      // Remove prior funding posts (we'll rebuild) but keep update/prayer posts
      profilePosts = profilePosts.filter(p=> p.type!=='funding');
  existingUpdates.forEach((u:any)=> profilePosts.push({ type:'update', showInUpdatesFeed:true, ...u }));
  const updateIds = new Set(existingUpdates.map((u:any)=> u.id));
  prayers.forEach((p:any)=> profilePosts.push({ type:'prayer', showInUpdatesFeed:updateIds.has(p.id), ...p }));
  updatedNeeds.forEach((f:any)=> profilePosts.push({ type:'funding', showInUpdatesFeed:false, ...f }));
      profilePosts.sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
      await updateDoc(doc(db, "individuals", individual.id), { fundingNeeds: updatedNeeds, givingLinks: updatedLinks, profilePosts });
    } catch(e) { /* silent */ }
  }

  async function addNeed() {
    if(readOnly || !needTitle.trim()) return;
    setAddingNeed(true);
    try {
      // Only include images that finished uploading successfully
      const completed = needImages.filter(i=> i.status==='done' && i.url).map(i=> i.url!) || [];
      const item: FundingNeed = {
        id: needIdRef.current,
        title: needTitle.trim(),
        description: needDesc.trim(),
        targetAmount: needTarget ? Number(needTarget) : undefined,
        currency: needTarget ? needCurrency : undefined,
        createdAt: new Date().toISOString(),
        author: user?.displayName || user?.email || user?.uid || 'Unknown',
        images: completed.length? completed: undefined
      };
  const updatedNeeds = [item, ...fundingNeeds];
  onUpdate?.({ fundingNeeds: updatedNeeds, givingLinks });
  await persist(updatedNeeds, givingLinks);
      // reset form including images
      setNeedTitle(""); setNeedDesc(""); setNeedTarget(""); setNeedImages([]);
      needIdRef.current = uuid();
    } finally { setAddingNeed(false); }
  }

  async function addLink() {
  if(readOnly || !linkLabel.trim()) return;
    if(!isPayPal && !linkUrl.trim()) return;
    if(isPayPal && !paypalEmail.trim() && !linkUrl.trim()) return; // require either email or explicit URL
    setAddingLink(true);
    try {
      const rawLabel = linkLabel.trim();
      const country = linkCountry.trim();
      let finalUrl = linkUrl.trim();
      let type: 'paypal' | 'generic' = 'generic';
      let currency: string | undefined;
      let storedPaypalEmail: string | undefined;
      if(isPayPal) {
        type = 'paypal';
        if(paypalEmail.trim()) {
          storedPaypalEmail = paypalEmail.trim();
          currency = paypalCurrency;
          const business = encodeURIComponent(storedPaypalEmail);
          finalUrl = `https://www.paypal.com/donate?business=${business}&currency_code=${currency}`;
        } else if(finalUrl) {
          // normalize existing url if needed
          finalUrl = normalizePayPalInput(rawLabel || 'PayPal', finalUrl);
        }
      } else {
        finalUrl = normalizePayPalInput(rawLabel, finalUrl);
      }
      const link: GivingLink = {
        id: uuid(),
        label: rawLabel,
        url: finalUrl,
        createdAt: new Date().toISOString(),
        author: user?.displayName || user?.email || user?.uid || 'Unknown',
        country: country || undefined,
        type,
        currency,
        paypalEmail: storedPaypalEmail
      };
      const updatedLinks = [link, ...givingLinks];
      onUpdate?.({ fundingNeeds, givingLinks: updatedLinks });
      await persist(fundingNeeds, updatedLinks);
      setLinkLabel(""); setLinkUrl(""); setLinkCountry(""); setIsPayPal(false); setPaypalEmail("");
    } finally { setAddingLink(false); }
  }

  function beginEditLink(l: GivingLink) {
    if(readOnly) return;
    setEditingLinkId(l.id);
    setEditLabel(l.label);
    setEditCountry(l.country || "");
    const isPP = l.type === 'paypal' || /paypal/i.test(l.label) || /paypal\./i.test(l.url);
    setEditIsPayPal(isPP);
    setEditPaypalEmail(l.paypalEmail || "");
    setEditPaypalCurrency(l.currency || 'USD');
    setEditUrl(l.url);
  }

  function cancelEditLink(){
    setEditingLinkId(null);
    setEditing(false);
  }

  async function saveEditLink(){
    if(!editingLinkId) return;
    if(readOnly) return;
    setEditing(true);
    try {
      const existing = givingLinks.find(l=>l.id===editingLinkId);
      if(!existing) { cancelEditLink(); return; }
      let finalUrl = editUrl.trim();
      let type: 'paypal' | 'generic' = editIsPayPal? 'paypal':'generic';
      let currency: string | undefined = editIsPayPal? editPaypalCurrency: existing.currency;
      let paypalEmail: string | undefined = editIsPayPal? (editPaypalEmail.trim()|| existing.paypalEmail): undefined;
      if(editIsPayPal){
        if(editPaypalEmail.trim()){
          const business = encodeURIComponent(editPaypalEmail.trim());
            finalUrl = `https://www.paypal.com/donate?business=${business}&currency_code=${editPaypalCurrency}`;
        } else if(finalUrl){
          finalUrl = normalizePayPalInput(editLabel, finalUrl);
        }
      } else {
        finalUrl = normalizePayPalInput(editLabel, finalUrl);
        currency = undefined;
        paypalEmail = undefined;
      }
      const updatedLinks = givingLinks.map(l=> l.id===editingLinkId ? {
        ...l,
        label: editLabel.trim(),
        country: editCountry.trim()|| undefined,
        url: finalUrl,
        type,
        currency,
        paypalEmail
      } : l);
      onUpdate?.({ fundingNeeds, givingLinks: updatedLinks });
      await persist(fundingNeeds, updatedLinks);
      cancelEditLink();
    } finally { setEditing(false); }
  }

  async function deleteLink(id: string){
    if(readOnly) return;
    const updatedLinks = givingLinks.filter(l=>l.id!==id);
    onUpdate?.({ fundingNeeds, givingLinks: updatedLinks });
    await persist(fundingNeeds, updatedLinks);
    if(editingLinkId===id) cancelEditLink();
  }

  // If the link is PayPal-related, attempt to normalize shorthand (username, email) to a proper PayPal donate URL.
  function normalizePayPalInput(label: string, url: string): string {
    const isLikelyPayPal = /paypal/i.test(label) || /paypal\./i.test(url);
    if(!isLikelyPayPal) return url;
    // Already a full https PayPal link
    if(/^https?:\/\//i.test(url) && /paypal\./i.test(url)) return url;
    // If it's a paypal.me style username (no spaces, no @, short)
    if(/^[a-zA-Z0-9_.-]{3,}$/i.test(url) && !/@/.test(url)) {
      return `https://paypal.me/${url}`;
    }
    // If it's an email, construct a donate link using old style business param
    if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url)) {
      const business = encodeURIComponent(url);
      return `https://www.paypal.com/donate?business=${business}&currency_code=USD`;
    }
    // Fallback: ensure it has https://
    if(!/^https?:\/\//i.test(url)) return `https://${url}`;
    return url;
  }

  function resolveLink(l: GivingLink): { href: string; isPayPal: boolean } {
    const isPayPal = l.type==='paypal' || /paypal/i.test(l.label) || /paypal\./i.test(l.url);
    return { href: normalizePayPalInput(l.label, l.url), isPayPal };
  }

  function prettyAmount(n?: number, currency?: string) {
    if(!n) return null;
    try { return new Intl.NumberFormat(undefined,{ style:'currency', currency: currency||'USD'}).format(n); } catch { return `${n} ${currency||''}`; }
  }

  return (
    <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm">
      <h2 className="font-bold mb-6">Funding & Support</h2>
  {/* Error popup now handled inside ImageUploadGrid */}
  <div className="grid md:grid-cols-2 gap-10">
        {/* Funding Needs */}
        <div>
          <h3 className="font-semibold text-brand-main mb-3">Funding Needs</h3>
          {!readOnly && (
          <div className="mb-4 p-4 border border-brand-main/10 rounded-lg bg-brand-main/5">
            <input
              value={needTitle}
              onChange={e=>setNeedTitle(e.target.value)}
              placeholder={user?"Need title (e.g. Travel to outreach)":"Sign in to add needs"}
              disabled={!user || addingNeed}
              className="w-full border rounded px-3 py-2 text-sm mb-2"
            />
            <textarea
              value={needDesc}
              onChange={e=>setNeedDesc(e.target.value)}
              placeholder="Description / details"
              disabled={!user || addingNeed}
              className="w-full border rounded px-3 py-2 text-sm mb-2 h-24 resize-none"
            />
            <div className="mb-3">
              <ImageUploadGrid
                disabled={readOnly || !user || addingNeed}
                onChange={setNeedImages}
                pathBuilder={uploadPathBuilder}
                resetKey={needIdRef.current}
                maxFiles={12}
                maxWidth={200}
                squareSize={80}
              />
            </div>
            <div className="flex gap-2 mb-3">
              <input
                value={needTarget}
                onChange={e=>setNeedTarget(e.target.value.replace(/[^0-9.]/g,''))}
                placeholder="Target amount"
                disabled={!user || addingNeed}
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              <select value={needCurrency} onChange={e=>setNeedCurrency(e.target.value)} disabled={!user || addingNeed} className="w-28 border rounded px-2 py-2 text-sm">
                {CURRENCIES.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={addNeed}
              disabled={!user || addingNeed || !needTitle.trim() || needImages.some(i=>i.status==='uploading')}
              className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50"
            >{needImages.some(i=>i.status==='uploading')? 'Uploading images...' : 'Add Need'}</button>
          </div>
          )}
          {fundingNeeds.length ? (
            <ul className="space-y-3">
              {fundingNeeds.map(n => {
                const hasImages = Array.isArray(n.images) && n.images.length>0;
                const single = hasImages && n.images!.length===1;
                return (
                  <li key={n.id} className="border border-brand-main/10 rounded-lg p-4 bg-brand-main/5">
                    {single ? (
                      <div className="flex items-start gap-4">
                        <a href={n.images![0]} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded overflow-hidden border bg-white flex-shrink-0">
                          <img src={n.images![0]} alt={n.title+ ' image'} className="object-cover w-full h-full" />
                        </a>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-brand-main mb-1 truncate">{n.title}</div>
                          {n.description && <div className="text-sm text-brand-dark whitespace-pre-wrap mb-2">{n.description}</div>}
                          {(n.targetAmount) && (
                            <div className="text-xs text-gray-600">Goal: {prettyAmount(n.targetAmount, n.currency)}</div>
                          )}
                          <div className="text-[11px] text-gray-400 mt-1">Posted {new Date(n.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-brand-main mb-1">{n.title}</div>
                          {n.description && <div className="text-sm text-brand-dark whitespace-pre-wrap mb-2">{n.description}</div>}
                          {hasImages && (
                            <div className="mb-2">
                              <div className="flex flex-wrap gap-2">
                                {n.images!.map((src,i)=>(
                                  <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded overflow-hidden border bg-white">
                                    <img src={src} alt={n.title+ ' image '+(i+1)} className="object-cover w-full h-full" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {(n.targetAmount) && (
                            <div className="text-xs text-gray-600">Goal: {prettyAmount(n.targetAmount, n.currency)}</div>
                          )}
                          <div className="text-[11px] text-gray-400 mt-1">Posted {new Date(n.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <div className="text-gray-400 italic text-sm">No funding needs listed.</div>}
        </div>

        {/* Giving Links */}
        <div>
          <h3 className="font-semibold text-brand-main mb-3">Ways to Give</h3>
          {!readOnly && (
          <div className="mb-4 p-4 border border-brand-main/10 rounded-lg bg-brand-main/5">
            <input
              value={linkLabel}
              onChange={e=>setLinkLabel(e.target.value)}
              placeholder={user?"Label (e.g. PayPal, Bank Transfer)":"Sign in to add links"}
              disabled={!user || addingLink}
              className="w-full border rounded px-3 py-2 text-sm mb-2"
            />
            <div className="flex flex-col md:flex-row gap-2 mb-2">
              <input
                value={linkCountry}
                onChange={e=>setLinkCountry(e.target.value)}
                placeholder="Country / Region (e.g. USA, UK)"
                disabled={!user || addingLink}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-xs text-brand-dark whitespace-nowrap">
                <input type="checkbox" checked={isPayPal} disabled={!user || addingLink} onChange={e=>setIsPayPal(e.target.checked)} /> PayPal
              </label>
            </div>
            {!isPayPal && (
              <input
                value={linkUrl}
                onChange={e=>setLinkUrl(e.target.value)}
                placeholder="https://..."
                disabled={!user || addingLink}
                className="w-full border rounded px-3 py-2 text-sm mb-2"
              />
            )}
            {isPayPal && (
              <div className="mb-2 grid md:grid-cols-2 gap-2">
                <input
                  value={paypalEmail}
                  onChange={e=>setPaypalEmail(e.target.value)}
                  placeholder="PayPal email (or leave blank to use URL)"
                  disabled={!user || addingLink}
                  className="border rounded px-3 py-2 text-sm"
                />
                <select
                  value={paypalCurrency}
                  onChange={e=>setPaypalCurrency(e.target.value)}
                  disabled={!user || addingLink}
                  className="border rounded px-3 py-2 text-sm"
                >
                  {CURRENCIES.map(c=> <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  value={linkUrl}
                  onChange={e=>setLinkUrl(e.target.value)}
                  placeholder="Optional full PayPal link (overrides email)"
                  disabled={!user || addingLink}
                  className="md:col-span-2 border rounded px-3 py-2 text-sm"
                />
              </div>
            )}
            <button
              onClick={addLink}
              disabled={!user || addingLink || !linkLabel.trim() || (!isPayPal && !linkUrl.trim()) || (isPayPal && !paypalEmail.trim() && !linkUrl.trim())}
              className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50"
            >Add Link</button>
          </div>
          )}
          {givingLinks.length ? (
            <div className="space-y-6">
              {Object.entries(groupGivingLinks(givingLinks)).map(([country, links]) => (
                <div key={country}>
                  <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">{country}</h4>
                  <ul className="space-y-3">
                    {links.map(l => {
                      const { href, isPayPal } = resolveLink(l);
                      const isEditing = editingLinkId===l.id;
                      if(isEditing){
                        return (
                          <li key={l.id} className="border border-brand-main/10 rounded-lg p-4 bg-white flex flex-col gap-3">
                            <div className="grid md:grid-cols-2 gap-2">
                              <input value={editLabel} onChange={e=>setEditLabel(e.target.value)} className="border rounded px-2 py-1 text-xs" placeholder="Label" />
                              <input value={editCountry} onChange={e=>setEditCountry(e.target.value)} className="border rounded px-2 py-1 text-xs" placeholder="Country" />
                              <label className="flex items-center gap-2 text-[11px]">
                                <input type="checkbox" checked={editIsPayPal} onChange={e=>setEditIsPayPal(e.target.checked)} /> PayPal
                              </label>
                              {editIsPayPal && (
                                <select value={editPaypalCurrency} onChange={e=>setEditPaypalCurrency(e.target.value)} className="border rounded px-2 py-1 text-xs w-full">
                                  {CURRENCIES.map(c=> <option key={c} value={c}>{c}</option>)}
                                </select>
                              )}
                              {editIsPayPal && (
                                <input value={editPaypalEmail} onChange={e=>setEditPaypalEmail(e.target.value)} className="border rounded px-2 py-1 text-xs md:col-span-2" placeholder="PayPal email (optional)" />
                              )}
                              <input value={editUrl} onChange={e=>setEditUrl(e.target.value)} className="border rounded px-2 py-1 text-xs md:col-span-2" placeholder={editIsPayPal? 'Optional full PayPal URL':'URL'} />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={cancelEditLink} className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center gap-1"><XMarkIcon className="w-4 h-4"/>Cancel</button>
                              <button onClick={saveEditLink} disabled={editing || !editLabel.trim()} className="px-2 py-1 text-xs rounded bg-brand-main text-white hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1"><CheckIcon className="w-4 h-4"/>{editing? 'Saving...':'Save'}</button>
                            </div>
                          </li>
                        );
                      }
                      return (
                        <li key={l.id} className="border border-brand-main/10 rounded-lg p-4 bg-white flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-brand-main truncate flex items-center gap-2">
                              <span>{l.label}</span>
                              {isPayPal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#003087] text-white">PayPal</span>}
                            </div>
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-dark underline break-all">{href}</a>
                            {l.country && <div className="text-[10px] text-gray-500 mt-1">{l.country}</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <a href={href} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs rounded bg-brand-main text-white font-semibold hover:bg-brand-dark whitespace-nowrap">Give</a>
                            {!readOnly && (
                              <>
                                <button onClick={()=>beginEditLink(l)} className="p-1 rounded hover:bg-brand-main/10 text-brand-main" title="Edit"><PencilIcon className="w-4 h-4"/></button>
                                <button onClick={()=>deleteLink(l.id)} className="p-1 rounded hover:bg-red-50 text-red-600" title="Delete"><TrashIcon className="w-4 h-4"/></button>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : <div className="text-gray-400 italic text-sm">No giving links yet.</div>}
        </div>
      </div>
    </div>
  );
}

function groupGivingLinks(links: GivingLink[]): Record<string, GivingLink[]> {
  const map: Record<string, GivingLink[]> = {};
  links.forEach(l => {
    const key = (l.country || 'Other').trim() || 'Other';
    if(!map[key]) map[key] = [];
    map[key].push(l);
  });
  // sort groups alphabetically, preserve insertion order inside
  return Object.fromEntries(Object.keys(map).sort((a,b)=> a.localeCompare(b)).map(k=>[k,map[k]]));
}
