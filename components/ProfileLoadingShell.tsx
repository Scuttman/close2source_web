"use client";
import PageShell from "./PageShell";

const MAX_MESSAGE_LENGTH = 38; // "Just getting you closer to the source!"

interface ProfileLoadingShellProps {
  title?: string;
  message?: string;
  /** Diameter of the SVG canvas in px. Everything scales proportionally. Default 350. */
  size?: number;
}

export default function ProfileLoadingShell({
  title = "Loading",
  message = "Just getting you closer to the source!",
  size = 350,
}: ProfileLoadingShellProps) {
  const displayMessage = message.slice(0, MAX_MESSAGE_LENGTH);

  const s = size / 350; // scale factor relative to the base 350px design
  const cx = size / 2;
  const cy = size / 2;
  const logoScale = 5 * s;
  const rText   = 100 * s;  // top text path radius
  const rBottom = 107 * s;  // bottom text path radius

  const topPath    = `M ${cx},${cy + rText} A ${rText},${rText} 0 1,1 ${cx},${cy - rText} A ${rText},${rText} 0 1,1 ${cx},${cy + rText}`;
  const bottomPath = `M ${cx},${cy - rBottom} A ${rBottom},${rBottom} 0 1,0 ${cx},${cy + rBottom} A ${rBottom},${rBottom} 0 1,0 ${cx},${cy - rBottom}`;

  const fontSizeTop    = (17    * s).toFixed(2);
  const fontSizeBottom = (18.7  * s).toFixed(2);
  const lsTop          = (2.5   * s).toFixed(2);
  const lsBottom       = (6     * s).toFixed(2);

  return (
    <PageShell title={<span>{title}</span>}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] select-none">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" overflow="visible" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <path id="topArc"    d={topPath} />
            <path id="bottomArc" d={bottomPath} />
          </defs>

          {/* Logo circles */}
          <g transform={`translate(${cx},${cy}) scale(${logoScale}) translate(-18,-18)`}>
            <circle cx="18" cy="18" r="16" stroke="#fb923c" strokeWidth="1.5" strokeOpacity="0.45" />
            <circle cx="18" cy="18" r="10" stroke="#fb923c" strokeWidth="1.75" strokeOpacity="0.75" />
            <circle cx="18" cy="18" r="4" fill="#fb923c" />
          </g>

          {/* Top arc 300° — bold black. Full circle path so text never hits endpoints. */}
          {/* startOffset 25% = top of circle (CW from leftmost point). */}
          <text fill="#111827" fontSize={fontSizeTop} fontWeight="700" letterSpacing={lsTop}>
            <textPath href="#topArc" startOffset="50%" textAnchor="middle">
              {displayMessage}
            </textPath>
          </text>

          {/* Full CCW circle — endpoints at 12 o'clock, no clipping. */}
          {/* startOffset 51.5% nudges "2" to sit exactly at 180° bottom. */}
          <text fill="#fb923c" fontSize={fontSizeBottom} fontWeight="700" letterSpacing={lsBottom}>
            <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
              close2source
            </textPath>
          </text>
        </svg>
      </div>
    </PageShell>
  );
}
