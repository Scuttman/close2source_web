interface C2SLogoProps {
  /** Visual colour variant */
  variant?: 'white' | 'black' | 'orange';
  /** Size in px — width and height of the SVG */
  size?: number;
  className?: string;
}

const COLORS: Record<NonNullable<C2SLogoProps['variant']>, string> = {
  white: 'white',
  black: '#111827',
  orange: '#fb923c',
};

/**
 * Close2Source concentric-ring logo mark.
 * Three rings at increasing opacity converging on a solid centre dot —
 * representing "getting close to the source".
 */
export default function C2SLogo({ variant = 'white', size = 44, className }: C2SLogoProps) {
  const color = COLORS[variant];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Traveling pulse rings — contract from outer → centre */}
      {([0, 0.8, 1.6] as const).map((delay, i) => (
        <circle key={i} cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="1">
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

      {/* Static anchor rings */}
      <circle cx="18" cy="18" r="16" stroke={color} strokeWidth="1.5" strokeOpacity="0.45" />
      <circle cx="18" cy="18" r="10" stroke={color} strokeWidth="1.75" strokeOpacity="0.75" />

      {/* Centre dot — gentle breathe */}
      <circle cx="18" cy="18" r="4" fill={color}>
        <animate attributeName="r"
          values="4;4.6;4"
          dur="2.4s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
        <animate attributeName="opacity"
          values="1;0.7;1"
          dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
