import { useEffect, useState } from "react";
import Link from "next/link";
import { getNewslettersByIndividual, deleteNewsletter } from "@/lib/dal";
import { NewsletterDoc } from "@/lib/dal/types";
import { NewspaperIcon, PlusIcon, TrashIcon, CheckCircleIcon, ClockIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { getAuth } from "firebase/auth";

export default function IndividualNewslettersSection({ individual, canEdit }: { individual: any, canEdit: boolean }) {
  const [newsletters, setNewsletters] = useState<(NewsletterDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const profileCode = individual?.individualId || individual?.code;
    const uid = individual?.ownerUid || individual?.ownerId || individual?.ownerUID || individual?.owner || getAuth().currentUser?.uid;
    if (!profileCode || !uid) { setLoading(false); return; }

    setLoading(true);
    getNewslettersByIndividual(profileCode, uid).then(data => {
      setNewsletters(data.sort((a,b) => new Date(b.createdAt as any || 0).getTime() - new Date(a.createdAt as any || 0).getTime()));
    }).catch(e => console.error("Error loading newsletters:", e))
      .finally(() => setLoading(false));
  }, [individual]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to permanently delete this newsletter?")) return;
    try {
      await deleteNewsletter(id);
      setNewsletters(newsletters.filter(n => n.id !== id));
    } catch (err) {
      alert("Failed to delete newsletter.");
    }
  };

  // Don't hide during initial load — wait until loading is done before deciding to omit
  if (!loading && !canEdit && newsletters.filter(n => n.status === 'published').length === 0) return null;
  // Never render at all if there's genuinely no profile data yet
  if (!individual) return null;

  const profileCode = individual?.individualId || individual?.code || "";
  const displayList = canEdit ? newsletters : newsletters.filter(n => n.status === 'published');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 mt-8">
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gray-50/50">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <NewspaperIcon className="w-6 h-6 text-brand-main" /> Updates & Newsletters
          </h2>
          <p className="text-sm text-gray-500 mt-1">Full-page interactive updates shared with supporters.</p>
        </div>
        {canEdit && (
          <Link
            href={`/newsletter?id=${profileCode}`}
            className="shrink-0 px-4 py-2 bg-brand-main text-white font-medium rounded-lg text-sm transition hover:bg-brand-dark flex items-center gap-2 shadow-sm"
          >
            <PlusIcon className="w-4 h-4" /> Draft New Update
          </Link>
        )}
      </div>

      <div className="p-6">
        {loading ? (
          <div className="animate-pulse space-y-4">
             <div className="h-20 bg-gray-100 rounded-lg w-full"></div>
          </div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
             <NewspaperIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
             <h3 className="text-gray-500 font-medium">No newsletters {canEdit ? "created" : "published"} yet.</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {displayList.map(nl => (
                <div key={nl.id} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-4 hover:border-gray-300 transition group bg-white shadow-sm hover:shadow">
                   <div className="flex items-start justify-between gap-2">
                       <h3 className="font-bold text-gray-800 leading-tight">{nl.title || "Untitled Update"}</h3>
                       <div className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 border ${nl.status === 'published' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                           {nl.status === 'published' ? <CheckCircleIcon className="w-3 h-3"/> : <ClockIcon className="w-3 h-3"/>}
                           {nl.status === 'published' ? 'Published' : 'Draft'}
                       </div>
                   </div>
                   
                   <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">
                      {nl.introduction || "No introduction provided."}
                   </p>

                   <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-100">
                      {nl.status === 'published' && nl.newsletterId && (
                         <Link target="_blank" href={`/n/${nl.newsletterId}`} className="text-xs font-semibold px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition flex items-center gap-1">
                             <MagnifyingGlassIcon className="w-4 h-4" /> View Live
                         </Link>
                      )}
                      
                      {canEdit && (
                         <>
                            <Link href={`/newsletter?id=${nl.individualId || profileCode}&n=${nl.newsletterId}`} className="text-xs font-semibold px-3 py-1.5 bg-brand-main/10 hover:bg-brand-main/20 text-brand-main rounded transition">
                                Edit
                            </Link>
                            <button onClick={(e) => handleDelete(nl.id, e)} className="ml-auto text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition border border-transparent hover:border-red-100">
                               <TrashIcon className="w-4 h-4" />
                            </button>
                         </>
                      )}
                   </div>
                </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}