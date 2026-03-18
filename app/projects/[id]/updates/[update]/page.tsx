// Static-export compatible redirect page for project update share links.
// No "use client" — this is a server component so generateStaticParams can run.
// Visitors are redirected client-side to the main project page.

// Required for static export: return empty so no paths are pre-built.
// Unknown route segments will client-redirect via the meta-refresh below.
export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ id: string; update: string }>;
}

export default async function ProjectUpdatePage({ params }: Props) {
  const { id } = await params;
  const target = `/projects/${id}`;
  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content={`0; url=${target}`} />
        <meta name="robots" content="noindex" />
      </head>
      <body style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#888', fontSize: 14 }}>
          Redirecting… <a href={target} style={{ color: '#000' }}>Click here</a> if not redirected.
        </p>
        <script dangerouslySetInnerHTML={{ __html: `window.location.replace(${JSON.stringify(target)});` }} />
      </body>
    </html>
  );
}
