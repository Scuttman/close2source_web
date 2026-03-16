import { Metadata } from 'next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../../src/lib/firebase';
import Link from 'next/link';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const SITE_NAME = 'close2source';

// Ensure this route is always rendered dynamically so the latest update content is available
// to social network scrapers (no static optimization caching stale metadata).
export const dynamic = 'force-dynamic';

// Server component route used primarily to supply rich Open Graph / Twitter card metadata
// for individual project updates so that Facebook / LinkedIn shares show the update content.
// We intentionally do NOT mark this file with "use client" so that generateMetadata runs
// on the server. Social network scrapers will pull the OG & Twitter tags from this response.
// Human visitors will see a minimal page that links / redirects back to the main project page.

interface PageProps { params: { id: string; update: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, update } = params;
  let title = 'Project Update';
  let description = 'View this project update.';
  let images: string[] = [];
  try {
    const snap = await getDoc(doc(db,'projects', id));
    if(snap.exists()){
      const data: any = snap.data();
      const idx = parseInt(update,10);
      const updates: any[] = Array.isArray(data.updates)? data.updates: [];
      const u = updates[idx];
      if(u){
        const projectName = data.name || 'Project';
        title = u.title ? `${u.title} – ${projectName}` : `Update on ${projectName}`;
        const raw = (u.text || '').replace(/\s+/g,' ').trim();
        description = raw.length > 180 ? raw.slice(0,177) + '…' : (raw || description);
        if(Array.isArray(u.images) && u.images[0]) images.push(u.images[0]);
        else if(data.coverPhotoUrl) images.push(data.coverPhotoUrl);
        // Basic sanity for absolute images
        images = images.map(url=> url.startsWith('http') ? url : `${SITE_URL}${url}`);
        const published = u.createdAt || data.createdAt;
        return {
          title,
          description,
          openGraph: {
            title,
            description,
            type: 'article',
            siteName: SITE_NAME,
            url: `${SITE_URL}/projects/${id}/updates/${update}`,
            images: images.map(url=>({ url })),
            publishedTime: published,
          },
          twitter: {
            card: images.length ? 'summary_large_image' : 'summary',
            title,
            description,
            images,
          },
          other: {
            'article:published_time': published || '',
          }
        } as Metadata;
      }
    }
  } catch {/* ignore metadata fetch errors */}
  // Fallback generic metadata if not found
  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: SITE_NAME, url: `${SITE_URL}/projects/${id}/updates/${update}` },
    twitter: { card: 'summary', title, description }
  } as Metadata;
}

export default async function UpdateShareRedirect({ params }: PageProps){
  const { id, update } = params;
  const target = `/projects/${id}?update=${update}`;
  return (
    <html>
      <head>
        {/* Defensive fallback meta tags (some scrapers have quirks) */}
        <meta property="og:url" content={`${SITE_URL}${target}`} />
        <meta property="og:type" content="article" />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={`${SITE_URL}${target}`} />
      </head>
      <body className="min-h-screen flex items-center justify-center font-sans">
        <div className="p-6 text-center max-w-md">
          <h1 className="text-lg font-semibold mb-2">Loading update…</h1>
          <p className="text-sm text-gray-600 mb-4">If you are not redirected automatically, click below.</p>
          <Link href={target} className="inline-block px-4 py-2 rounded bg-black text-white text-sm">View Update</Link>
          <script
            dangerouslySetInnerHTML={{__html:`setTimeout(()=>{window.location.href='${target}';},400);`}}
          />
        </div>
      </body>
    </html>
  );
}
