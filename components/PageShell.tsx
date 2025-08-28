"use client";
import React from "react";

interface PageShellProps {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  // Optional search bar controls shown on right side of black header bar
  searchEnabled?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  // Optional right side actions (e.g., button). Rendered to the right of search (or title if no search)
  headerRight?: React.ReactNode;
}

// Reusable page container with semi-transparent background and black title bar
export default function PageShell({
  title,
  children,
  className = "",
  contentClassName = "",
  searchEnabled = false,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  headerRight,
}: PageShellProps) {
  return (
    <div className={`relative mx-auto max-w-[1200px] w-full px-4 md:px-6 flex flex-col flex-1 min-h-full ${className}`}>
      <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-white/70 backdrop-blur-sm flex flex-col flex-1 min-h-0">
        <div className="bg-black text-white px-4 md:px-6 py-4 flex items-center gap-4">
          <h1 className="flex-1 text-xl md:text-2xl font-semibold leading-none truncate">{title}</h1>
          {searchEnabled && (
            <div className="w-40 sm:w-56 md:w-72">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md bg-white/15 focus:bg-white/20 border border-white/30 focus:border-brand-main/80 outline-none px-3 py-2 text-sm placeholder:text-white/50 transition"
              />
            </div>
          )}
          {headerRight && (
            <div className="flex items-center">{headerRight}</div>
          )}
        </div>
        <div className={`p-6 md:p-8 flex-1 flex flex-col min-h-0 ${contentClassName}`}>
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
