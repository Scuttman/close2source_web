"use client";
import PageShell from "./PageShell";
import C2SStampSVG from "./C2SStampSVG";

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
  return (
    <PageShell title={<span>{title}</span>}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] select-none">
        <C2SStampSVG message={message} size={size} />
      </div>
    </PageShell>
  );
}
