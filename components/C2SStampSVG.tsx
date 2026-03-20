/**
 * C2SStampSVG
 *
 * The circular arc stamp — two full-circle text paths around the C2S logo mark.
 * Standalone (no PageShell wrapper) so it can be embedded anywhere.
 *
 * Props:
 *  message  – top arc text (max 38 chars). Default: "Just getting you closer to the source!"
 *  size     – diameter in px (everything scales proportionally). Default: 350.
 *  className – extra classes applied to the <svg> element.
 */

const MAX_MESSAGE_LENGTH = 38;

interface C2SStampSVGProps {
  message?: string;
  size?: number;
  className?: string;
}

export default function C2SStampSVG({
  message = "Just getting you closer to the source!",
  size = 350,
  className,
}: C2SStampSVGProps) {
  const displayMessage = message.slice(0, MAX_MESSAGE_LENGTH);

  const s = size / 350;
  const cx = size / 2;
  const cy = size / 2;
  const logoScale = 5 * s;
  const rText   = 100 * s;
  const rBottom = 107 * s;

  const topPath    = `M ${cx},${cy + rText} A ${rText},${rText} 0 1,1 ${cx},${cy - rText} A ${rText},${rText} 0 1,1 ${cx},${cy + rText}`;
  const bottomPath = `M ${cx},${cy - rBottom} A ${rBottom},${rBottom} 0 1,0 ${cx},${cy + rBottom} A ${rBottom},${rBottom} 0 1,0 ${cx},${cy - rBottom}`;

  const fontSizeTop    = (17   * s).toFixed(2);
  const fontSizeBottom = (18.7 * s).toFixed(2);
  const lsTop          = (2.5  * s).toFixed(2);
  const lsBottom       = (6    * s).toFixed(2);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <path id={`topArc-${size}`}    d={topPath} />
        <path id={`bottomArc-${size}`} d={bottomPath} />
      </defs>

      {/* Logo mark */}
      <g transform={`translate(${cx},${cy}) scale(${logoScale}) translate(-18,-18)`}>

        {/* ── Traveling pulse rings — contract from outer → center ───────── */}
        {/* Three rings staggered by 0.8 s each, giving a continuous inward wave */}
        {([0, 0.8, 1.6] as const).map((delay, i) => (
          <circle key={i} cx="18" cy="18" r="14" fill="none"
            stroke="#fb923c" strokeWidth="1">
            <animate attributeName="r"
              from="14" to="5"
              dur="2.4s" begin={`${delay}s`} repeatCount="indefinite"
              calcMode="spline" keySplines="0.4 0 0.6 1" />
            <animate attributeName="stroke-opacity"
              values="0;0.55;0.3;0"
              keyTimes="0;0.25;0.75;1"
              dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {/* ─────────────────────────────────────────────────────────────────── */}

        {/* Static anchor rings */}
        <circle cx="18" cy="18" r="16" stroke="#fb923c" strokeWidth="1.5" strokeOpacity="0.45" />
        <circle cx="18" cy="18" r="10" stroke="#fb923c" strokeWidth="1.75" strokeOpacity="0.75" />

        {/* Centre dot — gentle breathe */}
        <circle cx="18" cy="18" r="4" fill="#fb923c">
          <animate attributeName="r"
            values="4;4.6;4"
            dur="2.4s" repeatCount="indefinite"
            calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
          <animate attributeName="fill-opacity"
            values="1;0.7;1"
            dur="2.4s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Top arc — bold black */}
      <text fill="#111827" fontSize={fontSizeTop} fontWeight="700" letterSpacing={lsTop}>
        <textPath href={`#topArc-${size}`} startOffset="50%" textAnchor="middle">
          {displayMessage}
        </textPath>
      </text>

      {/* Bottom arc — orange "close2source" */}
      <text fill="#fb923c" fontSize={fontSizeBottom} fontWeight="700" letterSpacing={lsBottom}>
        <textPath href={`#bottomArc-${size}`} startOffset="50%" textAnchor="middle">
          close2source
        </textPath>
      </text>
    </svg>
  );
}
