import { ImageResponse } from 'next/og';
import { getNewsletterByCode } from '@/lib/dal';

export const runtime = 'nodejs';
export const alt = 'Ministry Newsletter';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const code = (await params).id;

  let name = 'Newsletter';
  let location = '';
  let bgImage: string | null = null;
  let dateLabel = '';

  try {
    const nl = await getNewsletterByCode(code) as any;
    if (nl) {
      name = nl.personName || name;
      location = nl.serviceLocation || '';
      bgImage = nl.headerBgUrl
        || nl.coverPhotoUrl
        || (Array.isArray(nl.introPhotos) && nl.introPhotos[0] ? nl.introPhotos[0] : null)
        || (Array.isArray(nl.familyUpdates) && nl.familyUpdates[0]?.images?.[0] ? nl.familyUpdates[0].images[0] : null)
        || (Array.isArray(nl.currentProjects) && nl.currentProjects[0]?.images?.[0] ? nl.currentProjects[0].images[0] : null)
        || null;
      const d = new Date(nl.letterDate || nl.publishedAt || '');
      if (!isNaN(d.getTime())) {
        dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#0f172a',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background image */}
        {bgImage && (
          <img
            src={bgImage}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.42,
            }}
          />
        )}

        {/* Dark gradient overlay — bottom heavy */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.38) 65%, rgba(0,0,0,0.06) 100%)',
            display: 'flex',
          }}
        />

        {/* Top-left brand badge */}
        <div
          style={{
            position: 'absolute',
            top: 52,
            left: 64,
            display: 'flex',
            background: '#e85d04',
            color: '#ffffff',
            padding: '12px 28px',
            borderRadius: 10,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Ministry Newsletter
        </div>

        {/* Bottom content stack */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '0 64px 56px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {dateLabel && (
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.5)', fontSize: 26, fontWeight: 400 }}>
              {dateLabel}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              color: '#ffffff',
              fontSize: name.length > 24 ? 60 : 80,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: -2,
            }}
          >
            {name}
          </div>
          {location && (
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.65)', fontSize: 30, fontWeight: 500, marginTop: 4 }}>
              📍 {location}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              color: 'rgba(255,255,255,0.28)',
              fontSize: 22,
              fontWeight: 600,
              marginTop: 14,
              letterSpacing: 1,
            }}
          >
            close2source.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
