"use client";
import { useMemo, useState } from 'react';

interface ProjectTeamTabProps {
  project: any;
}

interface TeamMemberMetrics {
  key: string; // uid or name
  name: string;
  uid?: string;
  updates: number;
  comments: number;
  reactions: number; // reactions made
  firstAt?: string;
  lastAt?: string;
  total: number; // aggregate score for sorting
}

export default function ProjectTeamTab({ project }: ProjectTeamTabProps) {
  const [search, setSearch] = useState('');

  const members = useMemo<TeamMemberMetrics[]>(() => {
    const map = new Map<string, TeamMemberMetrics>();
    const updates: any[] = Array.isArray(project?.updates) ? project.updates : [];
    const addContribution = (key: string, name: string, uid: string | undefined, dateStr: string | undefined, type: 'update' | 'comment' | 'reaction') => {
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { key, name: name || uid || 'Unknown', uid, updates: 0, comments: 0, reactions: 0, firstAt: dateStr, lastAt: dateStr, total: 0 });
      }
      const m = map.get(key)!;
      if (type === 'update') m.updates += 1; else if (type === 'comment') m.comments += 1; else if (type === 'reaction') m.reactions += 1;
      if (dateStr) {
        if (!m.firstAt || dateStr < m.firstAt) m.firstAt = dateStr;
        if (!m.lastAt || dateStr > m.lastAt) m.lastAt = dateStr;
      }
    };
    updates.forEach(u => {
      const createdAt = u.createdAt || u.updatedAt;
      const key = u.authorUid || u.author || '';
      addContribution(key, u.author, u.authorUid, createdAt, 'update');
      // comments
      (u.comments || []).forEach((c: any) => {
        const cKey = c.authorUid || c.author || '';
        addContribution(cKey, c.author, c.authorUid, c.createdAt, 'comment');
      });
      // reactions (users who reacted)
      const reactionUsers = u.reactionUsers || {};
      Object.keys(reactionUsers).forEach(rt => {
        (reactionUsers[rt] || []).forEach((uid: string) => {
          addContribution(uid, uid, uid, createdAt, 'reaction');
        });
      });
    });
    // project creator baseline
    if (project?.createdBy) {
      const creatorKey = project.createdBy; // may match uid or name/email
      if (!map.has(creatorKey)) {
        map.set(creatorKey, { key: creatorKey, name: project.createdBy, updates: 0, comments: 0, reactions: 0, firstAt: undefined, lastAt: undefined, total: 0 });
      }
    }
    // compute totals & convert
    const arr = Array.from(map.values()).map(m => ({ ...m, total: m.updates * 4 + m.comments * 2 + m.reactions }));
    arr.sort((a, b) => b.total - a.total || (b.lastAt || '').localeCompare(a.lastAt || ''));
    return arr;
  }, [project?.updates, project?.createdBy]);

  const filtered = members.filter(m => !search.trim() || m.name.toLowerCase().includes(search.toLowerCase()) || (m.uid || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h2 className="text-lg font-semibold text-brand-main">Team Engagement</h2>
        <input
          value={search}
            onChange={e => setSearch(e.target.value)}
          placeholder="Search team..."
          className="w-full md:w-64 border rounded px-3 py-2 text-sm"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 italic">No team activity yet.</div>
      ) : (
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-semibold">Member</th>
                <th className="px-4 py-2 font-semibold text-center">Updates</th>
                <th className="px-4 py-2 font-semibold text-center">Comments</th>
                <th className="px-4 py-2 font-semibold text-center">Reactions</th>
                <th className="px-4 py-2 font-semibold hidden sm:table-cell">First</th>
                <th className="px-4 py-2 font-semibold hidden sm:table-cell">Last</th>
                <th className="px-4 py-2 font-semibold text-center">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.key} className="border-t border-gray-100 hover:bg-brand-main/5">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand-main/20 flex items-center justify-center text-brand-main font-bold text-xs">{(m.name||'U')[0]}</div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-brand-main text-sm">{m.name || 'Unknown'}</span>
                        {m.uid && <span className="text-[10px] text-gray-400">{m.uid}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-brand-dark">{m.updates}</td>
                  <td className="px-4 py-2 text-center font-semibold text-brand-dark">{m.comments}</td>
                  <td className="px-4 py-2 text-center font-semibold text-brand-dark">{m.reactions}</td>
                  <td className="px-4 py-2 hidden sm:table-cell text-xs text-gray-500">{m.firstAt ? new Date(m.firstAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2 hidden sm:table-cell text-xs text-gray-500">{m.lastAt ? new Date(m.lastAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2 text-center font-semibold text-brand-main">{m.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-[11px] text-gray-500 leading-snug">Score weights: update ×4, comment ×2, reaction ×1. Derived from current update data; historical deletions aren't reflected.</p>
    </div>
  );
}
