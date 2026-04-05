import { getNewsletterByCode } from '@/lib/dal';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/24/outline';
import NewsletterShareButtons from '../../../../components/NewsletterShareButtons';

function formatDate(d?: string) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const code = (await params).id;
  const nl = await getNewsletterByCode(code) as any;
  return {
    title: `Share — ${nl?.personName || 'Newsletter'}`,
    robots: { index: false },
  };
}

export default async function CardPage({ params }: Props) {
  const code = (await params).id;
  const newsletter = await getNewsletterByCode(code, { noCache: true }) as any;
  if (!newsletter) notFound();

  const bgImage = newsletter.headerBgUrl || newsletter.coverPhotoUrl || null;
  const name: string = newsletter.personName || '';
  const location: string = newsletter.serviceLocation || '';
  const organization: string = newsletter.sendingOrganization || '';
  const dateLabel = formatDate(newsletter.letterDate || newsletter.publishedAt);
  const intro: string = newsletter.introduction?.substring(0, 220)?.trim() || '';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://close2source.com';
  const newsletterUrl = `${siteUrl}/n/${code}`;
  const shortUrl = newsletterUrl.replace('https://', '');

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 flex flex-col items-center py-10 px-4 print:bg-white print:p-0 print:block">
      {/* Print-only page config */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 0; size: landscape; }
          body { margin: 0; }
        }
      ` }} />

      {/* Header nav - hidden on print */}
      <div className="w-full max-w-3xl mb-5 print:hidden flex items-center justify-between">
        <Link href={`/n/${code}`} className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition flex items-center gap-1">
          ← Back to Newsletter
        </Link>
        <p className="text-xs text-gray-400 italic">Screenshot the card to share on Instagram</p>
      </div>

      {/* ── THE SOCIAL CARD ── 40:21 = 1200×630 (standard OG / social size) */}
      <div className="newsletter-card w-full max-w-3xl shadow-2xl rounded-2xl overflow-hidden border border-white/60 print:shadow-none print:rounded-none print:border-none print:max-w-none">
        <div className="relative w-full aspect-[40/21] bg-gray-900 overflow-hidden">

          {/* Background image */}
          {bgImage ? (
            <img
              src={bgImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-45 select-none pointer-events-none"
            />
          ) : (
            /* Fallback gradient when no image */
            <div className="absolute inset-0 bg-gradient-to-br from-brand-main/80 to-gray-900" />
          )}

          {/* Dark gradient — heavier at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />

          {/* Top-left badge */}
          <div className="absolute top-4 left-5 sm:top-6 sm:left-8 bg-brand-main text-white text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-lg">
            Ministry Newsletter
          </div>

          {/* Bottom content */}
          <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-4 sm:pb-7 flex flex-col gap-0.5 sm:gap-1">
            {dateLabel && (
              <p className="text-white/50 text-[9px] sm:text-sm font-medium uppercase tracking-wider mb-0.5">
                {dateLabel}
              </p>
            )}
            <h1 className="text-white font-black tracking-tight leading-none text-xl sm:text-3xl md:text-4xl lg:text-5xl">
              {name}
            </h1>
            {location && (
              <p className="text-white/70 text-[9px] sm:text-sm font-medium flex items-center gap-1 mt-0.5">
                <MapPinIcon className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                {location}
              </p>
            )}
            {organization && !location && (
              <p className="text-white/60 text-[9px] sm:text-xs font-medium mt-0.5">{organization}</p>
            )}
            {intro && (
              <p className="text-white/50 text-[8px] sm:text-[11px] leading-relaxed mt-1 line-clamp-2 max-w-[85%]">
                {intro}
              </p>
            )}
            <div className="flex items-end justify-between mt-2 sm:mt-4 gap-3">
              <p className="text-white/30 text-[7px] sm:text-[11px] font-mono tracking-tight break-all">{shortUrl}</p>
              <p className="text-white/20 text-[7px] sm:text-[11px] font-bold uppercase tracking-[0.15em] shrink-0">
                Close2Source
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SHARE PANEL ── hidden in print */}
      <div className="w-full max-w-3xl mt-8 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 print:hidden">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Share This Newsletter</h2>
        <p className="text-sm text-gray-500 mb-6">
          Copy the link to share anywhere, post to social media, or save as a PDF to print and hand out.
        </p>
        <NewsletterShareButtons
          url={newsletterUrl}
          title={`${name} — Ministry Newsletter`}
          name={name}
        />
      </div>

      {/* ── TIPS ── hidden in print */}
      <div className="w-full max-w-3xl mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
        {[
          { icon: '📱', label: 'WhatsApp / Messenger', tip: 'Tap "Copy Link" and paste into any chat.' },
          { icon: '📸', label: 'Instagram / Stories', tip: 'Screenshot the card above and post it as a photo.' },
          { icon: '🖨️', label: 'Print / PDF', tip: 'Click "Save PDF", then set landscape orientation for best results.' },
        ].map(({ icon, label, tip }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-2xl mb-2">{icon}</p>
            <p className="font-semibold text-gray-800 text-sm mb-1">{label}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{tip}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-400 font-semibold uppercase tracking-widest print:hidden">
        Powered by <span className="text-brand-main">Close2Source</span>
      </p>
    </main>
  );
}
