"use client";
import PageShell from "./PageShell";

interface ProfileLoadingShellProps {
  title?: string;
}

export default function ProfileLoadingShell({ title = "Loading" }: ProfileLoadingShellProps) {
  return (
    <PageShell title={<span>{title}</span>}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] select-none">
        {/* Hero skeleton */}
        <div className="w-full max-w-2xl animate-pulse mb-8 px-4">
          <div className="h-36 bg-gray-200 rounded-xl mb-4"></div>
          <div className="flex gap-4 items-start">
            <div className="w-16 h-16 bg-gray-300 rounded-lg shrink-0"></div>
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-5 bg-gray-200 rounded-full w-2/3"></div>
              <div className="h-4 bg-gray-100 rounded-full w-1/2"></div>
            </div>
          </div>
        </div>
        {/* Spinner */}
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-4 border-gray-200"></div>
          <div className="w-12 h-12 rounded-full border-4 border-t-orange-500 border-r-transparent border-b-transparent border-l-transparent animate-spin absolute inset-0"></div>
        </div>
        <p className="text-sm text-gray-400 tracking-wide">Please wait while we take you to the source!</p>
      </div>
    </PageShell>
  );
}
