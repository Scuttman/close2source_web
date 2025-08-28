"use client";
import React from "react";

interface PageShellProps {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

// Reusable page container with semi-transparent background and black title bar
export default function PageShell({ title, children, className = "", contentClassName = "" }: PageShellProps) {
  return (
    <div className={`relative mx-auto max-w-[1200px] w-full px-4 md:px-6 ${className}`}>
      <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-white/70 backdrop-blur-sm">
        <div className="bg-black text-white px-6 py-4">
          <h1 className="text-xl md:text-2xl font-semibold leading-none truncate">{title}</h1>
        </div>
        <div className={`p-6 md:p-8 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
