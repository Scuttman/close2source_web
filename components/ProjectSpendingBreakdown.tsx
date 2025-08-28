"use client";
import React, { useState, useMemo } from 'react';
import { formatMoney } from '../src/lib/credits'; // adjust import if path differs

interface CategorySummary { income?: number; expense?: number; net?: number; }
interface FinanceSummary { categories?: Record<string, CategorySummary>; }
interface Props {
  financeSummary: FinanceSummary;
}

export default function ProjectSpendingBreakdown({ financeSummary }: Props){
  const [hoveredSeg, setHoveredSeg] = useState<string|null>(null);
  const segmentsData = useMemo(()=>{
    const raw = financeSummary.categories || {} as Record<string, any>;
    const expenseEntries = Object.entries(raw)
      .map(([k,v]:any)=> ({ category:k, expense: v.expense||0 }))
      .filter(e=> e.expense > 0);
    const total = expenseEntries.reduce((s,e)=> s+ e.expense, 0) || 1;
    const colors = ['#dc2626','#f97316','#f59e0b','#d97706','#ea580c','#fb7185','#ec4899','#f472b6','#e11d48','#be123c','#fb923c','#fbbf24'];
    let currentDeg = 0;
    const segments: {cat:string; from:number; to:number; color:string; amount:number; pct:number}[] = [];
    expenseEntries.sort((a,b)=> b.expense - a.expense).forEach((e,i)=>{
      const pct = (e.expense / total);
      const deg = pct * 360;
      const seg = { cat: e.category, from: currentDeg, to: currentDeg + deg, color: colors[i % colors.length], amount: e.expense, pct: pct*100 };
      segments.push(seg); currentDeg += deg;
    });
    const legendSegments = [...segments].sort((a,b)=> a.cat.localeCompare(b.cat));
    return { expenseEntries, segments, legendSegments };
  }, [financeSummary]);

  const { expenseEntries, segments, legendSegments } = segmentsData;
  if(!expenseEntries.length) return <div className="text-sm text-gray-500">No spending recorded yet.</div>;

  return (
    <>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex items-center justify-center">
          <div className="relative" style={{width:208, height:208}}>
            <svg width={208} height={208} viewBox="0 0 208 208" role="img" aria-label="Spending pie chart interactive">
              {segments.map(seg=>{
                const start = seg.from; const end = seg.to;
                const largeArc = (end - start) > 180 ? 1 : 0;
                const r = 104; const cx = 104; const cy = 104;
                const toRad = (d:number)=> d * Math.PI/180;
                const x1 = cx + r * Math.cos(toRad(start));
                const y1 = cy + r * Math.sin(toRad(start));
                const x2 = cx + r * Math.cos(toRad(end));
                const y2 = cy + r * Math.sin(toRad(end));
                const mid = (start + end)/2; const midRad = toRad(mid);
                const raise = hoveredSeg === seg.cat ? 6 : 0; const tx = Math.cos(midRad) * raise; const ty = Math.sin(midRad) * raise;
                const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                return (
                  <path key={seg.cat} d={d} fill={seg.color} stroke="#9ca3af" strokeWidth={0.6} vectorEffect="non-scaling-stroke" transform={`translate(${tx} ${ty})`} className="cursor-pointer transition-transform duration-150" onMouseEnter={()=> setHoveredSeg(seg.cat)} onMouseLeave={()=> setHoveredSeg(s=> s===seg.cat? null : s)}>
                    <title>{`${seg.cat} ${seg.pct.toFixed(1)}%`}</title>
                  </path>
                );
              })}
            </svg>
            {segments.map(seg=>{
              if(seg.pct < 6) return null;
              const mid = (seg.from + seg.to)/2; const rad = mid * Math.PI/180; const R = 208/2; const rLabel = R * 0.62; const x = R + rLabel * Math.cos(rad); const y = R + rLabel * Math.sin(rad);
              return (
                <span key={seg.cat} className="absolute text-[10px] font-semibold text-white drop-shadow-sm pointer-events-none" style={{ left: x, top: y, transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.25)', padding:'2px 4px', borderRadius:4, opacity: hoveredSeg && hoveredSeg!==seg.cat ? 0.4 : 1 }}>{seg.pct.toFixed(0)}%</span>
              );
            })}
            {hoveredSeg && (()=>{
              const seg = segments.find(s=> s.cat===hoveredSeg);
              if(!seg) return null; const mid = (seg.from + seg.to)/2; const rad = mid * Math.PI/180; const R = 208/2; const rLabel = R * 0.85; const x = R + rLabel * Math.cos(rad); const y = R + rLabel * Math.sin(rad);
              return (
                <div className="absolute z-10 text-[10px] font-medium bg-white/90 backdrop-blur-sm border border-brand-main/20 rounded px-2 py-1 shadow-sm pointer-events-none" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
                  <span className="capitalize">{seg.cat}</span>: {seg.pct.toFixed(1)}%
                </div>
              );
            })()}
          </div>
        </div>
        <ul className="flex-1 space-y-2 text-xs">
          {legendSegments.map(s=> (
            <li key={s.cat} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{background:s.color}} />
              <span className="capitalize font-medium flex-1 truncate">{s.cat}</span>
              <span className="tabular-nums text-gray-600">{formatMoney(s.amount)}</span>
              <span className="w-12 text-right text-gray-400">{s.pct.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-[10px] text-gray-400">Only expense categories shown. Percentages based on total spending.</p>
    </>
  );
}
