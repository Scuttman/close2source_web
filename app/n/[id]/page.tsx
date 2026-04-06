import { getNewsletterByCode, getIndividualByCode } from '@/lib/dal';
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { MapPinIcon, BuildingOfficeIcon, EnvelopeIcon, PhoneIcon, GlobeAltIcon, ArrowRightIcon, HeartIcon, ShareIcon } from "@heroicons/react/24/outline";

function formatLetterDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  const suffix = [11,12,13].includes(day % 100) ? "th"
    : day % 10 === 1 ? "st"
    : day % 10 === 2 ? "nd"
    : day % 10 === 3 ? "rd" : "th";
  const month = d.toLocaleString("en-GB", { month: "long" });
  return `${day}${suffix} ${month} ${d.getFullYear()}`;
}

interface Props { params: Promise<{ id: string }>; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = (await params).id;
  const newsletter = await getNewsletterByCode(code);
  if (!newsletter) return { title: "Newsletter Not Found" };
  const title = `${newsletter.personName || 'Newsletter Update'} — Ministry Newsletter`;
  const description = newsletter.introduction?.substring(0, 200) || "Ministry Update";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      // opengraph-image.tsx in this route segment auto-generates the OG image
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function PublicNewsletterPage({ params }: Props) {
  const code = (await params).id;
  const newsletter = await getNewsletterByCode(code, { noCache: true });
  if (!newsletter) notFound();

  let profilePhotoUrl = "";
  let fallbackGivingLinks: { title: string; description: string; link: string }[] = [];
  try {
      const ind = await getIndividualByCode(newsletter.individualId || "") as any;
      if (ind && ind.photoURL) profilePhotoUrl = ind.photoURL;
      if (ind && Array.isArray(ind.givingLinks) && ind.givingLinks.length > 0 && !(newsletter.supportMethods?.length)) {
        fallbackGivingLinks = ind.givingLinks.map((g: any) => ({
          title: g.label || "Donate",
          description: g.country || "",
          link: g.url || "",
        })).filter((g: any) => g.title || g.link);
      }
  } catch (e) {}

  const givingOptions = (newsletter.supportMethods?.length ?? 0) > 0
    ? newsletter.supportMethods
    : fallbackGivingLinks;

  return (
    <main className="min-h-screen bg-gray-50/50 print:bg-white">
      <div className="max-w-4xl mx-auto my-12 print:my-0 bg-white print:shadow-none shadow-2xl rounded-2xl print:rounded-none overflow-hidden border border-gray-100 print:border-none">
          <header className="relative h-64 md:h-80 bg-gray-900 group">
              {((newsletter as any).headerBgUrl || newsletter.coverPhotoUrl) && (
                  <img src={(newsletter as any).headerBgUrl || newsletter.coverPhotoUrl} alt="Header" className="absolute inset-0 w-full h-full object-cover opacity-60" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-0 left-0 right-0 p-8 flex items-end gap-6 z-10">
                  {profilePhotoUrl && (
                      <div className="hidden md:block shrink-0">
                          <img src={profilePhotoUrl} className="w-28 h-28 rounded-full border-4 border-white shadow-xl object-cover" alt="Profile" />
                      </div>
                  )}
                  <div className="flex-1 text-white text-shadow-sm">
                      <div className="inline-block px-3 py-1 bg-brand-main/90 backdrop-blur-md text-white text-xs font-bold uppercase tracking-widest rounded mb-3 shadow-inner">
                           Newsletter Update
                      </div>
                      {(newsletter.letterDate || newsletter.publishedAt) && (
                        <p className="text-white/70 text-sm font-medium mb-3 tracking-wide">
                          {formatLetterDate((newsletter as any).letterDate || newsletter.publishedAt)}
                        </p>
                      )}
                      <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-2 tracking-tight">
                           {newsletter.personName}
                      </h1>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-white/90 font-medium text-sm md:text-base">
                          {newsletter.serviceLocation && (
                              <p className="flex items-center gap-1.5"><MapPinIcon className="w-5 h-5 opacity-70"/> {newsletter.serviceLocation}</p>
                          )}
                          {(newsletter.title || newsletter.sendingOrganization) && <p className="flex items-center gap-1.5"><BuildingOfficeIcon className="w-5 h-5 opacity-70"/> {newsletter.title || newsletter.sendingOrganization}</p>}
                      </div>
                  </div>
              </div>
          </header>

          <div className="p-8 md:p-12">
               {newsletter.introduction && (
                   <section className="mb-14">
                       <div className="flex gap-8 items-start">
                         <div className="prose max-w-none text-gray-700 leading-loose text-lg font-serif flex-1 min-w-0">
                             {newsletter.introduction.split("\n").map((para: string, i: number) => (
                                 para.trim() ? <p key={i} className="mb-4">{para}</p> : null
                             ))}
                         </div>
                         {(newsletter as any).introPhotos && (newsletter as any).introPhotos.length > 0 && (
                           <div className="w-1/5 shrink-0 flex flex-col gap-3">
                             {(newsletter as any).introPhotos.map((url: string, idx: number) => (
                               <img key={idx} src={url} alt="" className="w-full rounded-xl object-cover aspect-square shadow-sm border border-gray-100" />
                             ))}
                           </div>
                         )}
                       </div>
                   </section>
               )}

               {(newsletter as any).familyUpdates && (newsletter as any).familyUpdates.length > 0 && (
                   <section className="mb-14">
                       <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-brand-main pb-2 mb-6 uppercase tracking-wider inline-block">Family Updates</h2>
                       <div className="space-y-12">
                           {(newsletter as any).familyUpdates.map((item: any, idx: number) => (
                               <div key={item.id || idx} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex flex-col md:flex-row">
                                   {item.images && item.images.length > 0 && (
                                       <div className="md:w-2/5 shrink-0">
                                            <img src={item.images[0]} alt={item.heading} className="w-full h-64 md:h-full object-cover" />
                                       </div>
                                   )}
                                   <div className="p-8 md:w-3/5 flex flex-col justify-center">
                                       {item.heading && <h3 className="text-xl font-bold text-gray-900 mb-4">{item.heading}</h3>}
                                       <div className="prose text-gray-600 text-sm leading-relaxed">
                                           {item.body?.split('\n').map((p: string, i: number) => (
                                               p.trim() ? <p key={i} className="mb-3">{p}</p> : null
                                           ))}
                                       </div>
                                       {item.links && item.links.length > 0 && (
                                         <div className="mt-4 flex flex-col gap-3">
                                           {item.links.filter((l: any) => l.url).map((l: any, lIdx: number) => (
                                             <div key={lIdx}>
                                               <a href={l.url} target="_blank" rel="noopener noreferrer"
                                                 className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-brand-main/30 text-brand-main hover:bg-brand-main hover:text-white text-sm font-semibold rounded-lg transition shadow-sm">
                                                 <ArrowRightIcon className="w-3.5 h-3.5" />
                                                 {l.label || l.url}
                                               </a>
                                               {l.label && <p className="mt-1 text-xs text-gray-400 font-mono pl-1 break-all print:text-gray-600">{l.url}</p>}
                                             </div>
                                           ))}
                                         </div>
                                       )}
                                   </div>
                               </div>
                           ))}
                       </div>
                   </section>
               )}

               {newsletter.currentProjects && newsletter.currentProjects.length > 0 && (
                   <section className="mb-14">
                       <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-brand-main pb-2 mb-6 uppercase tracking-wider inline-block">Ministry Updates</h2>
                       <div className="space-y-12">
                           {newsletter.currentProjects.map((proj: any, idx: number) => (
                               <div key={proj.id || idx} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex flex-col md:flex-row">
                                   {proj.images && proj.images.length > 0 && (
                                       <div className="md:w-2/5 shrink-0">
                                            <img src={proj.images[0]} alt={proj.heading} className="w-full h-64 md:h-full object-cover" />
                                       </div>
                                   )}
                                   <div className="p-8 md:w-3/5 flex flex-col justify-center">
                                       {proj.heading && <h3 className="text-xl font-bold text-gray-900 mb-4">{proj.heading}</h3>}
                                       <div className="prose text-gray-600 text-sm leading-relaxed">
                                           {proj.body?.split('\n').map((p: string, i: number) => (
                                               p.trim() ? <p key={i} className="mb-3">{p}</p> : null
                                           ))}
                                       </div>
                                       {proj.links && proj.links.length > 0 && (
                                         <div className="mt-4 flex flex-col gap-3">
                                           {proj.links.filter((l: any) => l.url).map((l: any, lIdx: number) => (
                                             <div key={lIdx}>
                                               <a href={l.url} target="_blank" rel="noopener noreferrer"
                                                 className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-brand-main/30 text-brand-main hover:bg-brand-main hover:text-white text-sm font-semibold rounded-lg transition shadow-sm">
                                                 <ArrowRightIcon className="w-3.5 h-3.5" />
                                                 {l.label || l.url}
                                               </a>
                                               {l.label && <p className="mt-1 text-xs text-gray-400 font-mono pl-1 break-all print:text-gray-600">{l.url}</p>}
                                             </div>
                                           ))}
                                         </div>
                                       )}
                                   </div>
                               </div>
                           ))}
                       </div>
                   </section>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 mb-14">
                   {(newsletter.prayerPoints?.length ?? 0) > 0 && (
                       <section>
                           <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-brand-main pb-2 mb-6 uppercase tracking-wider inline-block">Prayer & Praise</h2>
                           <ul className="space-y-4">
                               {newsletter.prayerPoints!.map((pt: string, idx: number) => pt.trim() ? (
                                   <li key={idx} className="flex items-start gap-4">
                                       <div className="w-8 h-8 rounded-full bg-orange-100 text-brand-main font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-sm border border-orange-200">{idx + 1}</div>
                                       <p className="text-gray-700 leading-relaxed pt-1">{pt}</p>
                                   </li>
                               ) : null)}
                           </ul>
                       </section>
                   )}

                   {(newsletter.financialNeeds?.length ?? 0) > 0 && (
                       <section>
                           <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-green-500 pb-2 mb-6 uppercase tracking-wider inline-block">Financial Needs</h2>
                           <ul className="space-y-4">
                               {newsletter.financialNeeds!.map((pt: string, idx: number) => pt.trim() ? (
                                   <li key={idx} className="flex items-start gap-4 bg-green-50 border border-green-100 rounded-xl p-4 shadow-sm">
                                       <div className="w-8 h-8 rounded-full bg-green-200 text-green-700 font-bold flex items-center justify-center shrink-0 shadow-sm text-sm border border-green-300">$</div>
                                       <p className="text-gray-700 font-medium pt-1.5">{pt}</p>
                                   </li>
                               ) : null)}
                           </ul>
                       </section>
                   )}
               </div>

               {givingOptions.length > 0 && (
                   <section className="mb-14">
                       <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-brand-main pb-2 mb-6 uppercase tracking-wider inline-block">Ways To Partner</h2>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {givingOptions.map((sm: any, idx: number) => (
                               <div key={idx} className="border border-gray-200 rounded-xl p-5 hover:border-brand-main/50 transition bg-white shadow-sm flex flex-col items-start gap-3">
                                   <div>
                                       <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                           <GlobeAltIcon className="w-5 h-5 text-brand-main"/>
                                           {sm.title}
                                       </h4>
                                       {sm.description && <p className="text-sm text-gray-500 mt-2 leading-relaxed">{sm.description}</p>}
                                   </div>
                                   {sm.link && (
                                       <div className="mt-auto flex flex-col gap-1">
                                           <a href={sm.link} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-brand-main text-white font-semibold rounded-lg text-sm hover:bg-brand-dark transition shadow inline-flex items-center gap-2">
                                               Partner Here <ArrowRightIcon className="w-4 h-4"/>
                                           </a>
                                           <span className="text-xs text-gray-400 font-mono break-all print:text-gray-600">{sm.link.replace(/^https?:\/\//, '')}</span>
                                       </div>
                                   )}
                               </div>
                           ))}
                       </div>
                   </section>
               )}
               {(newsletter as any).thankYouMessage && (
                   <section className="mb-14 text-center">
                       <div className="bg-gradient-to-br from-pink-50 to-orange-50 border border-pink-100 rounded-3xl px-10 py-10 max-w-2xl mx-auto shadow-sm">
                           <HeartIcon className="w-8 h-8 text-pink-400 mx-auto mb-4"/>
                           <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line italic">{(newsletter as any).thankYouMessage}</p>
                       </div>
                   </section>
               )}

               {/* Contacts — new multi-person format */}
               {Array.isArray((newsletter as any).contacts) && (newsletter as any).contacts.length > 0 && (
                   <section className="mb-14">
                       <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-brand-main pb-2 mb-6 uppercase tracking-wider inline-block">Connect With Us</h2>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           {(newsletter as any).contacts.map((c: any, idx: number) => (
                               <div key={idx} className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col gap-4">
                                   {c.name && <p className="font-bold text-gray-900 text-lg">{c.name}</p>}
                                   <div className="flex flex-col gap-3">
                                       {c.facebook && (
                                           <div className="flex items-center gap-3">
                                               <a href={c.facebook} target="_blank" rel="noopener noreferrer"
                                                 className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm shrink-0" aria-label="Facebook">
                                                   <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                               </a>
                                               <span className="text-sm text-gray-500 font-mono break-all print:text-gray-700">{c.facebook.replace(/^https?:\/\//, '')}</span>
                                           </div>
                                       )}
                                       {c.whatsapp && (
                                           <div className="flex items-center gap-3">
                                               <a href={"https://wa.me/" + c.whatsapp.replace(/\D/g, '')} target="_blank" rel="noopener noreferrer"
                                                 className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 text-white transition shadow-sm shrink-0" aria-label="WhatsApp">
                                                   <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/></svg>
                                               </a>
                                               <span className="text-sm text-gray-500 font-mono print:text-gray-700">{c.whatsapp}</span>
                                           </div>
                                       )}
                                       {c.email && (
                                           <div className="flex items-center gap-3">
                                               <a href={"mailto:" + c.email}
                                                 className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-main hover:bg-brand-dark text-white transition shadow-sm shrink-0" aria-label="Email">
                                                   <EnvelopeIcon className="w-5 h-5"/>
                                               </a>
                                               <span className="text-sm text-gray-500 font-mono print:text-gray-700">{c.email}</span>
                                           </div>
                                       )}
                                   </div>
                               </div>
                           ))}
                       </div>
                   </section>
               )}
               {/* Legacy fallback: old single-field format */}
               {!Array.isArray((newsletter as any).contacts) && ((newsletter as any).facebookUrl || (newsletter as any).whatsappNumber || (newsletter as any).newsletterEmail) && (
                   <section className="mb-14">
                       <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-brand-main pb-2 mb-6 uppercase tracking-wider inline-block">Connect With Us</h2>
                       <div className="flex flex-col gap-3">
                           {(newsletter as any).facebookUrl && (
                               <div className="flex items-center gap-3">
                                   <a href={(newsletter as any).facebookUrl} target="_blank" rel="noopener noreferrer"
                                     className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm shrink-0" aria-label="Facebook">
                                       <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                   </a>
                                   <span className="text-sm text-gray-500 font-mono break-all print:text-gray-700">{(newsletter as any).facebookUrl.replace(/^https?:\/\//, '')}</span>
                               </div>
                           )}
                           {(newsletter as any).whatsappNumber && (
                               <div className="flex items-center gap-3">
                                   <a href={"https://wa.me/" + (newsletter as any).whatsappNumber.replace(/\D/g, '')} target="_blank" rel="noopener noreferrer"
                                     className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 text-white transition shadow-sm shrink-0" aria-label="WhatsApp">
                                       <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/></svg>
                                   </a>
                                   <span className="text-sm text-gray-500 font-mono print:text-gray-700">{(newsletter as any).whatsappNumber}</span>
                               </div>
                           )}
                           {(newsletter as any).newsletterEmail && (
                               <div className="flex items-center gap-3">
                                   <a href={"mailto:" + (newsletter as any).newsletterEmail}
                                     className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-main hover:bg-brand-dark text-white transition shadow-sm shrink-0" aria-label="Email">
                                       <EnvelopeIcon className="w-5 h-5"/>
                                   </a>
                                   <span className="text-sm text-gray-500 font-mono print:text-gray-700">{(newsletter as any).newsletterEmail}</span>
                               </div>
                           )}
                       </div>
                   </section>
               )}
          </div>

          <footer className="bg-gray-900 text-gray-400 p-8 flex flex-col md:flex-row items-center justify-between gap-6 print:bg-white print:text-black mt-auto">
               <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm font-medium">
                   {newsletter.contactEmail && (
                       <a href={"mailto:" + newsletter.contactEmail} className="hover:text-white transition flex items-center gap-2"><EnvelopeIcon className="w-5 h-5"/> {newsletter.contactEmail}</a>
                   )}
                   {newsletter.contactPhone && (
                       <a href={"tel:" + newsletter.contactPhone} className="hover:text-white transition flex items-center gap-2"><PhoneIcon className="w-5 h-5"/> {newsletter.contactPhone}</a>
                   )}
                   {newsletter.contactWebsite && (
                       <a href={newsletter.contactWebsite} target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-2"><GlobeAltIcon className="w-5 h-5"/> {newsletter.contactWebsite.replace(/^https?:\/\//, "")}</a>
                   )}
               </div>
               {newsletter.sendingOrganization && (
                   <div className="text-sm font-semibold tracking-wider text-white/50 uppercase">
                       {newsletter.sendingOrganization}
                   </div>
               )}
          </footer>
      </div>
      <div className="text-center pb-12 print:hidden flex flex-col items-center gap-4">
          <a
            href={`/n/${code}/card`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm transition shadow-md"
          >
            <ShareIcon className="w-4 h-4" />
            Share This Newsletter
          </a>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Powered by <span className="text-brand-main">Close2Source</span></p>
      </div>
    </main>
  );
}