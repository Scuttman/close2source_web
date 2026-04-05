'use client';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getIndividualByCode, createNewsletter, updateNewsletter, getNewsletterByCode } from "@/lib/dal";
import { NewsletterDoc, NewsletterProject, NewsletterSupportMethod } from "@/lib/dal/types";
import { generateCode } from "@/lib/codes";
import { MapPinIcon, ArrowLeftIcon, GlobeAltIcon, PencilIcon, SparklesIcon, TrashIcon, CheckIcon, NewspaperIcon, PhotoIcon, PlusIcon, XMarkIcon, EnvelopeIcon, PhoneIcon, HeartIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import AITextarea from "../../components/AITextarea";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { resizeImageFile, IMAGE_MAX_BANNER, IMAGE_MAX_THUMB } from "@/lib/imageResize";

function ProjectImageUploader({ currentUrl, onUploadPath }: { currentUrl?: string, onUploadPath: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const resized = await resizeImageFile(file, IMAGE_MAX_BANNER);
      const storageRef = ref(storage, `newsletters/projects/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, resized);
      
      uploadTask.on(
        "state_changed",
        () => {},
        (err) => { console.error(err); setUploading(false); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          onUploadPath(url);
          setUploading(false);
        }
      );
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  return (
    <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 flex flex-col items-center justify-center min-h-[120px]">
      {uploading ? (
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-main mb-2" />
      ) : currentUrl ? (
        <div className="relative w-full h-32">
          <img src={currentUrl} className="w-full h-full object-cover rounded" alt="Project" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
             <span className="text-white text-sm">Change Image</span>
          </div>
        </div>
      ) : (
        <>
          <PhotoIcon className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">Upload Project Image</span>
        </>
      )}
      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} disabled={uploading} />
    </div>
  );
}

function NewsletterEditorInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("id") || ""; 
  const newsletterId = searchParams.get("n") || ""; // optional, if editing existing

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [individual, setIndividual] = useState<any>(null);
  const [docId, setDocId] = useState<string>(""); 
  const [ncode, setNcode] = useState<string>("");

  const [title, setTitle] = useState("My Update");
  const [introduction, setIntroduction] = useState("");
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split("T")[0]);
  const [introPhotos, setIntroPhotos] = useState<string[]>([]);
  // Now explicitly matches NewsletterProject[]
  const [projects, setProjects] = useState<{ id: string, heading: string, body: string, images: string[], links?: { label: string; url: string }[] }[]>([]);
  const [familyUpdates, setFamilyUpdates] = useState<{ id: string, heading: string, body: string, images: string[], links?: { label: string; url: string }[] }[]>([]);
  const [prayerPoints, setPrayerPoints] = useState<string[]>([]);
  const [financialNeeds, setFinancialNeeds] = useState<string[]>([]);
  const [supportMethods, setSupportMethods] = useState<NewsletterSupportMethod[]>([]);
  const [headerBgUrl, setHeaderBgUrl] = useState('');
  const [headerUploading, setHeaderUploading] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [contacts, setContacts] = useState<{ id: string; name: string; facebook: string; whatsapp: string; email: string }[]>([]);

  useEffect(() => {
    if (!code) { setError("No individual profile code provided."); setLoading(false); return; }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const indResult = await getIndividualByCode(code) as any;
        if (!indResult) { if (!cancelled) { setError("Profile not found."); setLoading(false); } return; }
        if (!cancelled) setIndividual(indResult);

        if (!newsletterId) {
            setTitle(indResult.name + " Update - " + new Date().toLocaleDateString());
            setIntroduction(indResult.bio || indResult.story || "");
            
            const pr = Array.isArray(indResult.prayerRequests) ? indResult.prayerRequests : [];
            setPrayerPoints(pr.map((p: any) => p.text || p.title || "").filter(Boolean));

            const fn = Array.isArray(indResult.fundingNeeds) ? indResult.fundingNeeds : [];
            setFinancialNeeds(fn.map((f: any) => f.title + ": " + (f.currency || "$") + f.targetAmount + " - " + (f.description || "")));

            const gl = Array.isArray(indResult.givingLinks) ? indResult.givingLinks : [];
            setSupportMethods(gl.map((g: any) => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                title: g.label || "Donate", 
                description: g.country || "", 
                link: g.url || "",
            })));
        } else {
            const existing = await getNewsletterByCode(newsletterId) as any;
            if (existing && !cancelled) {
                setDocId(existing.id);
                setNcode(existing.newsletterId || newsletterId);
                setTitle(existing.title || "My Update");
                setIntroduction(existing.introduction || "");
                setLetterDate(existing.letterDate || (existing.publishedAt ? existing.publishedAt.split("T")[0] : new Date().toISOString().split("T")[0]));
                setIntroPhotos(existing.introPhotos || []);
                setHeaderBgUrl(existing.headerBgUrl || '');
                setProjects(existing.currentProjects || existing.projects || []);
                setFamilyUpdates(existing.familyUpdates || []);
                setPrayerPoints(existing.prayerPoints || []);
                setFinancialNeeds(existing.financialNeeds || []);
                setSupportMethods(existing.supportMethods || []);
                setThankYouMessage(existing.thankYouMessage || '');
                // Load contacts, migrating old single-field format if needed
                const loadedContacts = Array.isArray(existing.contacts) ? existing.contacts : [];
                if (loadedContacts.length === 0 && (existing.facebookUrl || existing.whatsappNumber || existing.newsletterEmail)) {
                    loadedContacts.push({ id: Date.now().toString(), name: '', facebook: existing.facebookUrl || '', whatsapp: existing.whatsappNumber || '', email: existing.newsletterEmail || '' });
                }
                setContacts(loadedContacts);
            }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [code, newsletterId]);

  const handleSave = async (published: boolean) => {
    if (!individual) return;
    setSaving(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Must be logged in to save.");

      let currentCode = ncode || generateCode("newsletter");

      const publishedAt = published ? new Date().toISOString() : undefined;

      const data = {
        newsletterId: currentCode,
        individualId: code,
        ownerUid: user.uid,
        title,
        status: (published ? "published" : "draft") as "published" | "draft",
        ...(publishedAt ? { publishedAt } : {}),
        
        ...(headerBgUrl ? { headerBgUrl } : {}),
        ...(individual.coverPhotoUrl ? { coverPhotoUrl: individual.coverPhotoUrl } : {}),
        ...(individual.photoURL ? { photoURL: individual.photoURL } : {}),
        ...(individual.isFamily !== undefined ? { isFamily: individual.isFamily } : {}),
        personName: individual.name,
        ...(individual.serviceLocation ? { serviceLocation: individual.serviceLocation } : {}),
        ...((individual.sendingOrganization || individual.organization) ? { sendingOrganization: individual.sendingOrganization || individual.organization } : {}),

        introduction,
        letterDate,
        ...(introPhotos.length > 0 ? { introPhotos } : {}),
        currentProjects: projects,
        ...(familyUpdates.length > 0 ? { familyUpdates } : {}),
        prayerPoints,
        financialNeeds,
        supportMethods,
        ...(thankYouMessage ? { thankYouMessage } : {}),
        ...(contacts.length > 0 ? { contacts } : {}),
        
        ...(individual.contactEmail || individual.email ? { contactEmail: individual.contactEmail || individual.email } : {}),
        ...(individual.contactPhone || individual.phone ? { contactPhone: individual.contactPhone || individual.phone } : {}),
        ...(individual.website || individual.contactWebsite ? { contactWebsite: individual.website || individual.contactWebsite } : {}),
      };

      if (docId) {
        await updateNewsletter(docId, data);
        alert(published ? "Newsletter Published!" : "Draft Saved!");
        if (published) router.push("/n/" + currentCode);
      } else {
        const newId = await createNewsletter(data);
        setDocId(newId);
        setNcode(currentCode);
        alert("Newsletter Created! Your share code is: " + currentCode);
        if (published) router.push("/n/" + currentCode);
      }
    } catch (e: any) {
        console.error(e);
        alert("Failed to save: " + e.message);
    } finally {
        setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading editor...</div>;
  if (error || !individual) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
            <Link href={"/individuals/profile?id=" + code} className="text-gray-500 hover:text-gray-900 transition flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg">
                <ArrowLeftIcon className="w-4 h-4"/> Back to Dashboard
            </Link>
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <PencilIcon className="w-5 h-5 text-brand-main"/> Newsletter Editor
            </h1>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => handleSave(false)} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm flex items-center gap-2">
                <CheckIcon className="w-4 h-4"/> {saving ? "Saving..." : "Save Draft"}
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-brand-main rounded-lg hover:bg-brand-dark transition shadow-sm flex items-center gap-2">
                <GlobeAltIcon className="w-4 h-4"/> {saving ? "Publishing..." : "Publish & Share"}
            </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-8 px-4">
        {ncode && (
           <div className="bg-green-50 text-green-800 p-4 rounded-xl mb-6 shadow-sm border border-green-200 flex items-center justify-between">
              <div>
                  <p className="font-bold">Newsletter Share Code: <span className="font-mono text-lg bg-green-100 px-2 py-0.5 rounded tracking-widest">{ncode}</span></p>
                  <p className="text-sm mt-1 opacity-90">Anyone can view your newsletter using this code.</p>
              </div>
              <Link href={"/n/" + ncode} target="_blank" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-semibold transition shadow-sm flex items-center gap-1">
                 View Live <ArrowLeftIcon className="w-4 h-4 rotate-135"/>
              </Link>
           </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="relative h-48 bg-gray-900 flex items-center justify-center group overflow-hidden">
                 {(headerBgUrl || individual.coverPhotoUrl) && <img src={headerBgUrl || individual.coverPhotoUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition duration-500" />}
                 {/* Header image upload overlay */}
                 <label className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-semibold rounded-lg cursor-pointer transition backdrop-blur-sm border border-white/20">
                     {headerUploading ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> : <PhotoIcon className="w-3.5 h-3.5" />}
                     {headerUploading ? 'Uploading...' : headerBgUrl ? 'Change Header' : 'Add Header Image'}
                     <input type="file" accept="image/*" className="hidden" disabled={headerUploading} onChange={async (e) => {
                         if (!e.target.files?.length) return;
                         setHeaderUploading(true);
                         try {
                             const file = e.target.files[0];
                             const resized = await resizeImageFile(file, IMAGE_MAX_BANNER);
                             const storageRef = ref(storage, `newsletters/headers/${Date.now()}_${file.name}`);
                             const uploadTask = uploadBytesResumable(storageRef, resized);
                             uploadTask.on('state_changed', () => {}, (err) => { console.error(err); setHeaderUploading(false); }, async () => {
                                 const url = await getDownloadURL(uploadTask.snapshot.ref);
                                 setHeaderBgUrl(url);
                                 setHeaderUploading(false);
                             });
                         } catch (err) {
                             console.error(err);
                             setHeaderUploading(false);
                         }
                     }} />
                 </label>
                 {headerBgUrl && (
                     <button type="button" onClick={() => setHeaderBgUrl('')} className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-1.5 bg-black/50 hover:bg-red-600/80 text-white text-xs font-semibold rounded-lg transition backdrop-blur-sm border border-white/20">
                         <XMarkIcon className="w-3.5 h-3.5" /> Remove
                     </button>
                 )}
                 <div className="relative z-10 text-center text-white px-4 flex flex-col items-center">
                     <p className="text-sm font-semibold text-white/80 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <NewspaperIcon className="w-4 h-4"/> update
                     </p>
                     <h2 className="text-3xl font-bold mb-3">{individual.name}</h2>
                     <input type="text" value={title} onChange={e=>setTitle(e.target.value)} className="bg-black/40 backdrop-blur-md text-white text-center border border-white/20 focus:border-brand-main focus:bg-black/60 focus:outline-none px-4 py-2 rounded-lg text-lg w-full max-w-md transition shadow-inner" placeholder="Newsletter Title" />
                 <input type="date" value={letterDate} onChange={e=>setLetterDate(e.target.value)} className="mt-2 bg-black/30 backdrop-blur-md text-white/80 text-center border border-white/20 focus:border-brand-main focus:bg-black/50 focus:outline-none px-3 py-1.5 rounded-lg text-sm transition shadow-inner" title="Letter date" />
                 </div>
            </div>

            <div className="p-8 space-y-12">
                <section>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5"><SparklesIcon className="w-4 h-4 text-brand-main"/> Letter &amp; Introduction — write as a personal letter to your supporters</p>
                    <div className="flex gap-4 items-start">
                      <div className="flex-1 min-w-0">
                        <AITextarea value={introduction} onChange={setIntroduction} rows={14} placeholder={`Dear friends,\n\nI hope this update finds you well...\n\nWith gratitude,\n${individual.name}`} aiContext={"Drafting a personal ministry letter for " + individual.name} />
                      </div>
                      <div className="w-1/5 shrink-0 flex flex-col gap-2">
                        {introPhotos.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img src={url} alt="" className="w-full rounded-lg object-cover aspect-square" />
                            <button
                              onClick={() => setIntroPhotos(introPhotos.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
                              title="Remove photo"
                            ><XMarkIcon className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <label className="relative border-2 border-dashed border-gray-300 rounded-lg p-2 text-center hover:bg-gray-50 cursor-pointer flex flex-col items-center justify-center min-h-[60px] transition">
                          <PhotoIcon className="w-5 h-5 text-gray-400 mb-1" />
                          <span className="text-xs text-gray-500">Add Photo</span>
                          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                            if (!e.target.files?.length) return;
                            const file = e.target.files[0];
                            try {
                              const resized = await resizeImageFile(file, IMAGE_MAX_THUMB);
                              const storageRef = ref(storage, `newsletters/intro/${Date.now()}_${file.name}`);
                              const task = uploadBytesResumable(storageRef, resized);
                              task.on("state_changed", () => {}, console.error, async () => {
                                const url = await getDownloadURL(task.snapshot.ref);
                                setIntroPhotos(prev => [...prev, url]);
                              });
                            } catch (err) { console.error(err); }
                          }} />
                        </label>
                      </div>
                    </div>
                </section>

                <section>
                    <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <h3 className="text-xl font-bold text-gray-800">Family Updates</h3>
                        <button onClick={() => setFamilyUpdates([...familyUpdates, { id: Date.now().toString(), images: [], body: "", heading: "", links: [] }])} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                            <PlusIcon className="w-4 h-4"/> Add Family Update
                        </button>
                    </div>

                    <div className="space-y-6">
                        {familyUpdates.map((item, idx) => (
                            <div key={item.id} className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm relative group hover:border-brand-main/50 transition">
                                <button title="Delete" onClick={() => setFamilyUpdates(familyUpdates.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition opacity-0 group-hover:opacity-100"><TrashIcon className="w-5 h-5"/></button>

                                <div className="mb-5 border-b border-gray-100 pb-4">
                                     <input type="text" placeholder="Family Update Headline..." className="w-full px-4 py-2 border-2 border-transparent bg-gray-50 focus:bg-white focus:border-brand-main rounded-lg block font-semibold text-gray-800 text-lg transition outline-none" value={item.heading} onChange={(e) => { const n = [...familyUpdates]; n[idx].heading = e.target.value; setFamilyUpdates(n); }} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="col-span-1">
                                         <ProjectImageUploader currentUrl={item.images?.[0]} onUploadPath={(url) => { const n = [...familyUpdates]; n[idx].images = [url]; setFamilyUpdates(n); }} />
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-3">
                                         <AITextarea
                                           value={item.body}
                                           onChange={(val) => { const n = [...familyUpdates]; n[idx].body = val; setFamilyUpdates(n); }}
                                           rows={6}
                                           placeholder="Share a personal family update — celebrations, milestones, challenges, or anything you'd like your supporters to know and pray for..."
                                           aiContext={`Writing a personal family update for a ministry newsletter. The topic is: "${item.heading || 'family life'}". The writer is ${individual.name}, serving in ${individual.serviceLocation || 'the mission field'}. Write in a warm, personal, faith-filled tone suitable for ministry supporters.`}
                                         />
                                         {/* External links */}
                                         <div className="mt-2 space-y-2">
                                           {(item.links || []).map((link, lIdx) => (
                                             <div key={lIdx} className="flex items-center gap-2 group">
                                               <input type="text" placeholder="Link label (e.g. Watch the video)" value={link.label} onChange={(e) => { const n = [...familyUpdates]; n[idx].links![lIdx].label = e.target.value; setFamilyUpdates(n); }} className="flex-1 border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-main rounded-lg px-3 py-2 text-sm outline-none transition" />
                                               <input type="url" placeholder="https://" value={link.url} onChange={(e) => { const n = [...familyUpdates]; n[idx].links![lIdx].url = e.target.value; setFamilyUpdates(n); }} className="flex-1 border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-main rounded-lg px-3 py-2 text-sm font-mono outline-none transition" />
                                               <button onClick={() => { const n = [...familyUpdates]; n[idx].links = (n[idx].links || []).filter((_: any, i: number) => i !== lIdx); setFamilyUpdates(n); }} className="text-gray-300 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition"><TrashIcon className="w-4 h-4" /></button>
                                             </div>
                                           ))}
                                           <button onClick={() => { const n = [...familyUpdates]; n[idx].links = [...(n[idx].links || []), { label: "", url: "" }]; setFamilyUpdates(n); }} className="text-xs font-semibold text-brand-main hover:text-brand-dark flex items-center gap-1 px-2 py-1 bg-white hover:bg-brand-main/5 border border-brand-main/20 rounded-lg transition mt-1"><PlusIcon className="w-3.5 h-3.5" /> Add Link</button>
                                         </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <h3 className="text-xl font-bold text-gray-800">Ministry Updates</h3>
                        <button onClick={() => setProjects([...projects, { id: Date.now().toString(), images: [], body: "", heading: "", links: [] }])} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                            <PlusIcon className="w-4 h-4"/> Add Ministry Report
                        </button>
                    </div>
                    
                    <div className="space-y-6">
                        {projects.map((proj, idx) => (
                            <div key={proj.id} className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm relative group hover:border-brand-main/50 transition">
                                <button title="Delete Project" onClick={() => setProjects(projects.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition opacity-0 group-hover:opacity-100"><TrashIcon className="w-5 h-5"/></button>
                                
                                <div className="mb-5 border-b border-gray-100 pb-4">
                                     <input type="text" placeholder="Ministry Report Headline..." className="w-full px-4 py-2 border-2 border-transparent bg-gray-50 focus:bg-white focus:border-brand-main rounded-lg block font-semibold text-gray-800 text-lg transition outline-none" value={proj.heading} onChange={(e) => { const newP = [...projects]; newP[idx].heading = e.target.value; setProjects(newP); }} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="col-span-1">
                                         <ProjectImageUploader currentUrl={proj.images?.[0]} onUploadPath={(url) => { const newP = [...projects]; newP[idx].images = [url]; setProjects(newP); }} />
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-3">
                                         <AITextarea
                                           value={proj.body}
                                           onChange={(val) => { const newP = [...projects]; newP[idx].body = val; setProjects(newP); }}
                                           rows={6}
                                           placeholder="Share what God has been doing through this area of ministry — what progress has been made, what challenges have been faced, and what you're trusting Him for next..."
                                           aiContext={`Writing a ministry update report for a newsletter. The report is about: "${proj.heading || 'a ministry focus area'}". The writer is ${individual.name}, serving in ${individual.serviceLocation || 'the mission field'}. Write in a warm, personal, faith-filled tone suitable for ministry supporters.`}
                                         />
                                         {/* External links */}
                                         <div className="mt-2 space-y-2">
                                           {(proj.links || []).map((link, lIdx) => (
                                             <div key={lIdx} className="flex items-center gap-2 group">
                                               <input
                                                 type="text"
                                                 placeholder="Link label (e.g. Watch the video)"
                                                 value={link.label}
                                                 onChange={(e) => { const newP = [...projects]; newP[idx].links![lIdx].label = e.target.value; setProjects(newP); }}
                                                 className="flex-1 border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-main rounded-lg px-3 py-2 text-sm outline-none transition"
                                               />
                                               <input
                                                 type="url"
                                                 placeholder="https://"
                                                 value={link.url}
                                                 onChange={(e) => { const newP = [...projects]; newP[idx].links![lIdx].url = e.target.value; setProjects(newP); }}
                                                 className="flex-1 border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-main rounded-lg px-3 py-2 text-sm font-mono outline-none transition"
                                               />
                                               <button onClick={() => { const newP = [...projects]; newP[idx].links = (newP[idx].links || []).filter((_, i) => i !== lIdx); setProjects(newP); }} className="text-gray-300 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition"><TrashIcon className="w-4 h-4" /></button>
                                             </div>
                                           ))}
                                           <button
                                             onClick={() => { const newP = [...projects]; newP[idx].links = [...(newP[idx].links || []), { label: "", url: "" }]; setProjects(newP); }}
                                             className="text-xs font-semibold text-brand-main hover:text-brand-dark flex items-center gap-1 px-2 py-1 bg-white hover:bg-brand-main/5 border border-brand-main/20 rounded-lg transition mt-1"
                                           ><PlusIcon className="w-3.5 h-3.5" /> Add Link
                                           </button>
                                         </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-b border-gray-100 py-8">
                    <section>
                        <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">Prayer & Praise</h3>
                        <div className="space-y-3 bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                            {prayerPoints.map((pt, idx) => (
                                <div key={idx} className="flex items-start gap-3 group">
                                    <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 text-xs font-bold mt-1 border border-orange-200">{idx+1}</div>
                                    <textarea rows={2} className="flex-1 w-full border-0 border-b-2 border-orange-200 px-3 py-2 text-sm bg-white focus:bg-white focus:border-brand-main focus:outline-none rounded-t shadow-sm transition resize-none text-gray-700" value={pt} onChange={(e) => { const np = [...prayerPoints]; np[idx] = e.target.value; setPrayerPoints(np); }} />
                                    <button onClick={() => setPrayerPoints(prayerPoints.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 p-2 mt-1 opacity-0 group-hover:opacity-100 transition"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            ))}
                            <button onClick={()=>setPrayerPoints([...prayerPoints, ""])} className="text-sm font-semibold text-brand-main hover:text-brand-dark px-2 py-1.5 flex items-center gap-1 bg-white hover:bg-orange-100 rounded-lg border border-orange-200 transition mt-2"><PlusIcon className="w-4 h-4"/> Add Prayer Point</button>
                        </div>
                    </section>
                    
                    <section>
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Financial Needs</h3>
                        <div className="space-y-3 bg-green-50/50 p-4 rounded-xl border border-green-100">
                            {financialNeeds.map((pt, idx) => (
                                <div key={idx} className="flex items-start gap-3 group">
                                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 text-xs font-bold mt-1 border border-green-200">$</div>
                                    <textarea rows={2} className="flex-1 w-full border-0 border-b-2 border-green-200 px-3 py-2 text-sm bg-white focus:bg-white focus:border-green-500 focus:outline-none rounded-t shadow-sm transition resize-none text-gray-700" value={pt} onChange={(e) => { const np = [...financialNeeds]; np[idx] = e.target.value; setFinancialNeeds(np); }} />
                                    <button onClick={() => setFinancialNeeds(financialNeeds.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 p-2 mt-1 opacity-0 group-hover:opacity-100 transition"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            ))}
                            <button onClick={()=>setFinancialNeeds([...financialNeeds, ""])} className="text-sm font-semibold text-green-700 hover:text-green-800 px-2 py-1.5 flex items-center gap-1 bg-white hover:bg-green-100 rounded-lg border border-green-200 transition mt-2"><PlusIcon className="w-4 h-4"/> Add Financial Need</button>
                        </div>
                    </section>
                </div>

                <section>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Ways To Support & Partner</h3>
                     <div className="space-y-4">
                        {supportMethods.map((sm, idx) => (
                            <div key={sm.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col sm:flex-row items-center sm:items-start gap-4 shadow-sm relative group">
                                <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm"><GlobeAltIcon className="w-6 h-6 text-gray-400"/></div>
                                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <input className="w-full border-2 border-transparent focus:border-brand-main focus:bg-white bg-white rounded-lg px-3 py-2 text-sm font-semibold shadow-sm outline-none transition" placeholder="Title/Label" value={sm.title} onChange={e=>{ const nsm=[...supportMethods]; nsm[idx].title=e.target.value; setSupportMethods(nsm); }}/>
                                        <input className="w-full px-3 py-2 text-sm outline-none font-mono focus:border-brand-main border rounded-lg shadow-sm" placeholder="Destination URL (https://)" value={sm.link||""} onChange={e=>{ const nsm=[...supportMethods]; nsm[idx].link=e.target.value; setSupportMethods(nsm); }}/>
                                    </div>
                                    <div className="space-y-3 h-full">
                                        <textarea className="w-full flex-1 border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-main focus:ring-1 focus:ring-brand-main resize-none transition" placeholder="Description/Note" value={sm.description||""} onChange={e=>{ const nsm=[...supportMethods]; nsm[idx].description=e.target.value; setSupportMethods(nsm); }}/>
                                    </div>
                                </div>
                                <button onClick={() => setSupportMethods(supportMethods.filter((_, i) => i !== idx))} className="absolute -top-3 -right-3 bg-white text-gray-400 hover:text-red-500 p-1.5 rounded-full border border-gray-200 shadow hover:border-red-200 hover:bg-red-50 transition"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        ))}
                        <button onClick={()=>setSupportMethods([...supportMethods, {id: Date.now().toString(), title:"", description:"", link:""}])} className="text-sm font-semibold border-2 border-dashed border-gray-300 rounded-xl w-full py-4 text-gray-500 hover:text-gray-800 hover:border-gray-400 hover:bg-gray-50 transition flex items-center justify-center gap-2"><PlusIcon className="w-5 h-5"/> Add Partner Link</button>
                    </div>
                </section>

                <section>
                    <div className="flex items-center gap-2 mb-4 border-b pb-2">
                        <HeartIcon className="w-5 h-5 text-pink-400"/>
                        <h3 className="text-xl font-bold text-gray-800">Thank You Message</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Write a personal closing note to thank your supporters.</p>
                    <AITextarea
                        value={thankYouMessage}
                        onChange={setThankYouMessage}
                        rows={5}
                        placeholder="Thank you for your faithfulness and partnership in this ministry. Your prayers and support mean more than words can express..."
                        aiContext={`Writing a warm, personal thank you closing message for a ministry support newsletter from ${individual.name}. It should express genuine gratitude to supporters, prayer partners, and financial givers. Keep it heartfelt and faith-filled.`}
                    />
                </section>

                <section>
                    <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <div className="flex items-center gap-2">
                            <EnvelopeIcon className="w-5 h-5 text-brand-main"/>
                            <h3 className="text-xl font-bold text-gray-800">Contacts</h3>
                        </div>
                        <button onClick={() => setContacts([...contacts, { id: Date.now().toString(), name: '', facebook: '', whatsapp: '', email: '' }])} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                            <PlusIcon className="w-4 h-4"/> Add Person
                        </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Add a card for each person (e.g. yourself, your spouse). Fill in whichever contact methods apply.</p>
                    <div className="space-y-4">
                        {contacts.map((contact, idx) => (
                            <div key={contact.id} className="border border-gray-200 rounded-2xl p-5 bg-gray-50 relative group hover:border-brand-main/40 transition">
                                <button onClick={() => setContacts(contacts.filter((_, i) => i !== idx))} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100">
                                    <TrashIcon className="w-4 h-4"/>
                                </button>
                                <input
                                    type="text"
                                    placeholder="Person's name (e.g. Sarah, Chris & Sarah)"
                                    value={contact.name}
                                    onChange={e => { const n = [...contacts]; n[idx].name = e.target.value; setContacts(n); }}
                                    className="w-full mb-4 px-3 py-2 border-2 border-transparent bg-white focus:bg-white focus:border-brand-main rounded-lg font-semibold text-gray-800 text-sm outline-none transition"
                                />
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">f</div>
                                        <input type="url" placeholder="Facebook URL (https://facebook.com/...)" value={contact.facebook} onChange={e => { const n = [...contacts]; n[idx].facebook = e.target.value; setContacts(n); }} className="flex-1 bg-white border border-blue-200 focus:border-blue-400 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none transition" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shrink-0 text-white"><PhoneIcon className="w-4 h-4"/></div>
                                        <input type="tel" placeholder="WhatsApp number with country code (+1 234...)" value={contact.whatsapp} onChange={e => { const n = [...contacts]; n[idx].whatsapp = e.target.value; setContacts(n); }} className="flex-1 bg-white border border-green-200 focus:border-green-400 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none transition" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-brand-main flex items-center justify-center shrink-0 text-white"><EnvelopeIcon className="w-4 h-4"/></div>
                                        <input type="email" placeholder="Email address" value={contact.email} onChange={e => { const n = [...contacts]; n[idx].email = e.target.value; setContacts(n); }} className="flex-1 bg-white border border-orange-200 focus:border-brand-main rounded-lg px-3 py-2 text-sm font-mono focus:outline-none transition" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {contacts.length === 0 && (
                            <button onClick={() => setContacts([{ id: Date.now().toString(), name: '', facebook: '', whatsapp: '', email: '' }])} className="text-sm font-semibold border-2 border-dashed border-gray-300 rounded-xl w-full py-4 text-gray-500 hover:text-gray-800 hover:border-gray-400 hover:bg-gray-50 transition flex items-center justify-center gap-2">
                                <PlusIcon className="w-5 h-5"/> Add Your First Contact
                            </button>
                        )}
                    </div>
                </section>
            </div>
        </div>
      </div>
    </div>
  );
}

export default function NewsletterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading interface...</div>}>
      <NewsletterEditorInner />
    </Suspense>
  );
}