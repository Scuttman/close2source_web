"use client";
import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, PaperAirplaneIcon, SparklesIcon, CheckIcon } from '@heroicons/react/24/outline';
import PageShell from '../../../components/PageShell';
import { sanitizeUserMessage, sanitizePromptParam, MAX_USER_MESSAGE_LENGTH } from '../../../src/lib/sanitizeAIInput';
import { getAuth } from 'firebase/auth';
import { getOrgByCode, getProjectByCode, updateOrg, createProjectWithCredits, fieldArrayUnion, fieldArrayRemove } from '@/lib/dal';
import { generateCode } from '../../../src/lib/codes';
import { moderateProfileContent, submitToModerationQueue, getPendingReviewMessage } from '../../../src/lib/moderation';

export interface AIProjectProfile {
  locationName?: string;
  vision?: string;
  whatWeDo?: string;
  whoIsInvolved?: string;
  name?: string;
  description?: string;
  projectSummary?: string;
  projectImpact?: string;
  totalBudget?: number;
  currency?: string;
  timeline?: string;
  goals?: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}


const SYSTEM_PROMPT = (orgName: string) => `You are a project registration assistant for Close2Source — a platform connecting organisations with community projects. You are helping someone from "${orgName}" create a compelling, well-written project profile.

Your job is to gather the following information through a friendly conversation, ONE or TWO topics at a time, in this order:

FIRST - Location & Activities:
1. Location name (city/country where this takes place)
2. Vision (the overarching vision for this location)
3. What We Do (description of location activities)
4. Who Is Involved (people/groups who will participate)

THEN - Project Details:
5. Project Name
6. Project Description (a compelling 2-4 sentence overview)
7. Project Summary (a detailed paragraph about the project)
8. Project Impact (how it benefits the community)
9. Total Budget and Currency
10. Timeline (when the project will take place)
11. Goals (3-5 key objectives as a list)

Rules:
- Be encouraging and conversational.
- Start with location information, THEN move to project details.
- When the user provides any descriptive text, automatically clean it up for spelling, grammar and fluidity, show them the improved version inline, and ask if they are happy with it before moving on.
- Ask clarifying questions if answers are vague.
- Do NOT ask for all fields at once.

When you have gathered all the fields, say:
"Great! I have everything I need. Here is your project profile:" 

Then output a JSON block in this EXACT format (no extra text after the block):

\`\`\`json
{
  "locationName": "...",
  "vision": "...",
  "whatWeDo": "...",
  "whoIsInvolved": "...",
  "name": "...",
  "description": "...",
  "projectSummary": "...",
  "projectImpact": "...",
  "totalBudget": 0,
  "currency": "GBP",
  "timeline": "...",
  "goals": ["goal 1", "goal 2", "goal 3"]
}
\`\`\`

Then ask: "Are you happy with this profile? I can refine any section if you'd like. When you're ready, click the **Create Project** button below to register."

Once the user says they are happy or confirms, output EXACTLY this line on its own:
PROFILE_COMPLETE
followed immediately by the JSON block again (same format as above).`;

function extractJson(text: string): AIProjectProfile | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

function ProfilePreview({ profile }: { profile: AIProjectProfile }) {
  const fields: [string, string | number | string[] | undefined][] = [
    ['Location', profile.locationName],
    ['Vision', profile.vision],
    ['What We Do', profile.whatWeDo],
    ['Who Is Involved', profile.whoIsInvolved],
    ['Name', profile.name],
    ['Description', profile.description],
    ['Summary', profile.projectSummary],
    ['Impact', profile.projectImpact],
    ['Budget', profile.totalBudget !== undefined ? `${profile.currency ?? ''} ${profile.totalBudget}`.trim() : undefined],
    ['Timeline', profile.timeline],
    ['Goals', profile.goals],
  ];
  return (
    <div className="space-y-3">
      {fields.map(([label, value]) => {
        if (!value || (Array.isArray(value) && !value.length)) return null;
        return (
          <div key={label}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{label}</div>
            {Array.isArray(value) ? (
              <ul className="list-disc list-inside space-y-0.5">
                {value.map((g, i) => <li key={i} className="text-xs text-gray-700">{g}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-gray-800 leading-relaxed">{String(value)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AIRegisterProjectPage() {
  return (
    <Suspense fallback={
      <PageShell title="AI Project Registration">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-main" />
        </div>
      </PageShell>
    }>
      <AIRegisterProjectPageInner />
    </Suspense>
  );
}

function AIRegisterProjectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId') || '';
  const orgName = sanitizePromptParam(searchParams.get('orgName') || 'your organization');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<AIProjectProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [pendingReviewMsg, setPendingReviewMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const storageKey = orgId ? `ai_project_registration_${orgId}` : 'ai_project_registration_temp';

  // Load saved state from localStorage on mount
  useEffect(() => {
    if (!orgId) {
      router.push('/org');
      return;
    }
    
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed.messages || []);
        setCurrentProfile(parsed.profile || null);
        setProfileReady(parsed.profileReady || false);
        setInitialized(true);
        if (!parsed.messages || parsed.messages.length === 0) {
          // If no messages, start fresh conversation
          sendToAI([], true);
        }
      } catch {
        // If parse fails, start fresh
        sendToAI([], true);
        setInitialized(true);
      }
    } else {
      // No saved state, start fresh
      sendToAI([], true);
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (initialized && messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify({
        messages,
        profile: currentProfile,
        profileReady,
        timestamp: Date.now(),
      }));
    }
  }, [messages, currentProfile, profileReady, initialized, storageKey]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, streaming]);

  async function sendToAI(history: Message[], isInit = false) {
    setStreaming(true);
    abortRef.current = new AbortController();

    const userHistory = isInit ? [] : history;

    try {
      const resp = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT(orgName) },
            ...userHistory,
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('API error ' + resp.status);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      // Add blank assistant bubble
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantText };
                return updated;
              });
            }
          } catch { /* ignore parse errors on partial chunks */ }
        }
      }

      // Post-processing: extract JSON preview + detect PROFILE_COMPLETE
      const profile = extractJson(assistantText);
      if (profile) setCurrentProfile(profile);

      if (assistantText.includes('PROFILE_COMPLETE')) {
        setProfileReady(true);
        // Extract the final confirmed JSON
        const finalProfile = extractJson(assistantText) ?? currentProfile;
        if (finalProfile) setCurrentProfile(finalProfile);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' }]);
      }
    } finally {
      setStreaming(false);
    }
  }

  async function handleSend() {
    const rawText = input.trim();
    if (!rawText || streaming) return;
    setInput('');
    const { text, blocked, reason } = sanitizeUserMessage(rawText);
    if (blocked) {
      setMessages(prev => [...prev, { role: 'assistant', content: reason ?? 'That message could not be processed. Please rephrase.' }]);
      return;
    }
    const newHistory: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newHistory);
    await sendToAI(newHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleApply() {
    if (!currentProfile || creating) return;
    setCreateError('');
    setCreating(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('You must be logged in.');

      // Fetch organization data
      const orgResult = await getOrgByCode(orgId);
      if (!orgResult) throw new Error('Organization not found.');
      const org = orgResult;

      // ── Location matching & auto-add ─────────────────────────────────────
      let locationId: string | null = null;
      const existingLocations: any[] = Array.isArray((org as any).locations) ? (org as any).locations : [];

      if (currentProfile.locationName?.trim()) {
        const nameLower = currentProfile.locationName.trim().toLowerCase();
        const matched = existingLocations.find(
          (l: any) => (l.name || '').toLowerCase() === nameLower
        );

        if (matched) {
          // Use existing location, but fill in vision/whatWeDo if missing
          locationId = matched.id;
          const needsUpdate =
            (!matched.vision && currentProfile.vision) ||
            (!matched.whatWeDo && currentProfile.whatWeDo);
          if (needsUpdate) {
            const updated = {
              ...matched,
              vision: matched.vision || currentProfile.vision || undefined,
              whatWeDo: matched.whatWeDo || currentProfile.whatWeDo || undefined,
            };
            const cleanUpdated: any = Object.fromEntries(
              Object.entries(updated).filter(([, v]) => v !== undefined)
            );
            await updateOrg(org.id, {
              locations: fieldArrayRemove(matched),
            } as any);
            await updateOrg(org.id, {
              locations: fieldArrayUnion(cleanUpdated),
            } as any);
          }
        } else {
          // Create new org location from AI-gathered data
          const newId = Math.random().toString(36).slice(2, 10).toUpperCase();
          const newLoc: any = Object.fromEntries(
            Object.entries({
              id: newId,
              name: currentProfile.locationName.trim(),
              vision: currentProfile.vision?.trim() || undefined,
              whatWeDo: currentProfile.whatWeDo?.trim() || undefined,
            }).filter(([, v]) => v !== undefined)
          );
          await updateOrg(org.id, {
            locations: fieldArrayUnion(newLoc),
          } as any);
          locationId = newId;
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Generate unique projectId
      let projectId = '';
      let unique = false;
      for (let attempt = 0; attempt < 10 && !unique; attempt++) {
        projectId = generateCode('project');
        const existing = await getProjectByCode(projectId);
        if (!existing) unique = true;
      }
      if (!unique) throw new Error('Could not generate a unique project ID, try again.');

      // ── Mandatory content moderation BEFORE creating ───────────────────
      const contentToScan: Record<string, string> = {};
      (['name', 'description', 'vision', 'whatWeDo', 'whoIsInvolved', 'projectSummary', 'projectImpact'] as const).forEach(f => {
        const v = (currentProfile as any)[f];
        if (v && typeof v === 'string') contentToScan[f] = v;
      });
      const modResult = await moderateProfileContent(contentToScan, 'project');
      const initialStatus = modResult.flagged ? 'pending_review' : 'live';
      // ──────────────────────────────────────────────────────────────────────

      // Inherit org theme
      const THEME_KEYS = [
        'themeHeaderBg', 'themeHeaderText', 'themeAccent', 'themeAccentText', 'themeAccentHover',
        'themeTabActiveBg', 'themeTabActiveText', 'themeTabInactiveText', 'themeWidgetTitleColor'
      ] as const;
      const inheritedTheme: Record<string, any> = {};
      THEME_KEYS.forEach(k => {
        if (org && typeof (org as any)[k] === 'string' && (org as any)[k]) inheritedTheme[k] = (org as any)[k];
      });
      if (!inheritedTheme.themeAccent && (org as any)?.themeHeaderBg) inheritedTheme.themeAccent = (org as any).themeHeaderBg;
      if (!inheritedTheme.themeTabActiveBg && inheritedTheme.themeAccent) inheritedTheme.themeTabActiveBg = inheritedTheme.themeAccent;

      // Create project via DAL (deducts credits atomically)
      const { docId: newProjectDocId } = await createProjectWithCredits({
        uid: user.uid,
        projectData: {
          name: currentProfile.name || 'Untitled Project',
          description: currentProfile.description || '',
          projectId,
          users: [{ uid: user.uid, role: 'Admin' }],
          createdBy: user.uid,
          
          // Organization linkage
          organizationId: (org as any).orgId,
          organizationName: (org as any).name || null,
          organizationLogoUrl: (org as any).logoUrl || null,
          originatingOrganizationId: (org as any).orgId,
          originatingOrganizationDbId: org.id,

          // AI-gathered project details
          vision: currentProfile.vision || null,
          whatWeDo: currentProfile.whatWeDo || null,
          whoIsInvolved: currentProfile.whoIsInvolved || null,
          projectSummary: currentProfile.projectSummary || null,
          projectImpact: currentProfile.projectImpact || null,
          totalBudget: currentProfile.totalBudget || null,
          currency: currentProfile.currency || 'GBP',
          timeline: currentProfile.timeline || null,
          goals: currentProfile.goals || [],
          
          // Location
          location: currentProfile.locationName ? {
            search: currentProfile.locationName.toLowerCase(),
            country: null,
            town: null,
            latitude: null,
            longitude: null,
          } : null,
          locationName: currentProfile.locationName || null,
          locationId: locationId || null,

          // Cover photo placeholder
          coverPhotoUrl: null,
          
          // Visibility defaults
          showOnOrganizationOverview: true,
          publicVisible: true,
          status: initialStatus,
          visibility: 'public',

          // Inherit theme
          ...inheritedTheme,
        },
      });

      // ── Submit to moderation queue if flagged ────────────────────────────
      if (modResult.flagged && newProjectDocId) {
        const _auth = getAuth();
        await submitToModerationQueue({
          type: 'project',
          docId: newProjectDocId,
          docCollection: 'projects',
          profileName: currentProfile.name || 'Untitled Project',
          profileCode: projectId,
          ownerUid: _auth.currentUser?.uid || '',
          result: modResult,
          contentSnapshot: contentToScan,
        });
        setPendingReviewMsg(getPendingReviewMessage('project'));
        setCreating(false);
        return; // Stay on page to show message
      }
      // ─────────────────────────────────────────────────────────────────────

      // Clear saved conversation
      localStorage.removeItem(storageKey);

      // Navigate to the new project profile
      router.push(`/projects/${projectId}/proposal`);

    } catch (e: any) {
      setCreateError(e.message || 'Failed to create project');
      setCreating(false);
    }
  }

  function handleBack() {
    // Don't clear storage, so user can come back
    router.push(`/org/${orgId}`);
  }

  // Strip PROFILE_COMPLETE + duplicate json from visible message text
  function cleanMessage(text: string) {
    return text
      .replace(/PROFILE_COMPLETE\s*/g, '')
      .trim();
  }

  // Format assistant message with markdown-like rendering
  function renderContent(text: string) {
    const cleaned = cleanMessage(text);
    // Split on code blocks
    const parts = cleaned.split(/(```json[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```json')) {
        const json = part.replace(/```json\s*/, '').replace(/```$/, '').trim();
        let parsed: any = null;
        try { parsed = JSON.parse(json); } catch {}
        if (parsed) {
          return (
            <div key={i} className="mt-2 bg-white border border-gray-200 rounded-lg p-3 text-[11px] font-mono text-gray-700 space-y-1 max-h-56 overflow-y-auto">
              {Object.entries(parsed).map(([k, v]) => (
                <div key={k}><span className="font-semibold text-orange-600">{k}:</span> {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</div>
              ))}
            </div>
          );
        }
        return <pre key={i} className="mt-2 bg-gray-100 rounded p-2 text-[11px] overflow-x-auto">{json}</pre>;
      }
      // Bold **text**
      const segments = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {segments.map((s, j) =>
            s.startsWith('**') ? <strong key={j}>{s.slice(2, -2)}</strong> : s
          )}
        </span>
      );
    });
  }

  if (!orgId) return null;

  return (
    <PageShell
      title={
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            title="Back to organization"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <SparklesIcon className="w-5 h-5 text-orange-400" />
          <span>AI Project Registration</span>
          <span className="text-sm text-white/60 font-normal">— guided by ChatGPT</span>
        </div>
      }
      headerRight={
        <div className="flex items-center gap-3">
          {messages.length > 0 && !currentProfile && (
            <button
              onClick={() => {
                if (confirm('Start fresh? Your current conversation will be cleared.')) {
                  localStorage.removeItem(storageKey);
                  setMessages([]);
                  setCurrentProfile(null);
                  setProfileReady(false);
                  sendToAI([], true);
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-white/30 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              Start Fresh
            </button>
          )}
          {currentProfile && (
            <button
              onClick={handleApply}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Create Project (50 Credits)
                </>
              )}
            </button>
          )}
        </div>
      }
      contentClassName="p-0"
    >
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Chat panel */}
        <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <SparklesIcon className="w-4 h-4 text-orange-500" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-orange-600 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {m.role === 'assistant' ? renderContent(m.content) : m.content}
                  {m.role === 'assistant' && i === messages.length - 1 && streaming && (
                    <span className="inline-block w-1.5 h-4 bg-orange-400 ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>
              </div>
            ))}
            {messages.length === 0 && streaming && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center mr-2 flex-shrink-0">
                  <SparklesIcon className="w-4 h-4 text-orange-500" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-400 flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {currentProfile && !streaming && (
              <div className="flex justify-center my-4">
                <button
                  onClick={handleApply}
                  disabled={creating}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating Project...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      Create Project (50 Credits)
                    </>
                  )}
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="border-t bg-white px-4 py-3 flex-shrink-0">
            {createError && (
              <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {createError}
              </div>
            )}
            {pendingReviewMsg && (
              <div className="mb-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                {pendingReviewMsg}
              </div>
            )}
            {currentProfile && !creating && (
              <div className="mb-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0" />
                Profile ready! Click <strong>Create Project</strong> above to register (costs 50 credits), or keep chatting to refine.
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming}
                placeholder={streaming ? 'Waiting for response…' : 'Type your answer… (Enter to send, Shift+Enter for new line)'}
                rows={2}
                maxLength={MAX_USER_MESSAGE_LENGTH}
                className="flex-1 resize-none border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                className="p-2.5 rounded-xl bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 transition-colors flex-shrink-0"
                title="Send"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel — live profile preview */}
        {currentProfile && (
          <div className="hidden lg:flex flex-col w-80 xl:w-96 border-l bg-white flex-shrink-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <SparklesIcon className="w-4 h-4 text-orange-500" />
                Live Preview
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Updates as you chat</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ProfilePreview profile={currentProfile} />
            </div>
            <div className="px-4 py-3 border-t flex-shrink-0">
              <button
                onClick={handleApply}
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-4 h-4" />
                      Create Project
                    </>
                  )}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
