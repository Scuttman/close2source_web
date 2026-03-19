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
      {/* Outer ring */}
      <circle cx="18" cy="18" r="16" stroke={color} strokeWidth="1.5" strokeOpacity="0.45" />
      {/* Middle ring */}
      <circle cx="18" cy="18" r="10" stroke={color} strokeWidth="1.75" strokeOpacity="0.75" />
      {/* Inner dot */}
      <circle cx="18" cy="18" r="4" fill={color} />
    </svg>
  );
}
