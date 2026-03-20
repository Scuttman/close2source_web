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
  visionAlignment?: string;
  projectSummary?: string;
  projectImpact?: string;
  impactedPeople?: string;
  totalBudget?: number;
  currency?: string;
  timeline?: string;
  goals?: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}


const SYSTEM_PROMPT = (orgName: string | null, existingLocations: {id: string; name: string; vision?: string; whatWeDo?: string}[] = []) => `You are a project registration assistant for Close2Source — a platform connecting organisations with community projects. You are helping${orgName ? ` someone from "${orgName}"` : ' a user'} create a compelling, well-written project profile.

Your job is to gather the following information through a friendly conversation, ONE or TWO topics at a time, in this order:

FIRST - Location & Activities:${existingLocations.length > 0 ? `

IMPORTANT — This organisation already has the following locations on record:
${existingLocations.map((l, i) => `  ${i + 1}. ${l.name}${l.vision ? ` — "${l.vision}"` : ''}`).join('\n')}

At the very start of the conversation, present this numbered list clearly to the user and ask them to either:
  a) Choose one of the existing locations (by number or name), OR
  b) Type a new location name

If they pick an existing location, pre-fill the Location Name, Vision, and What We Do fields with the saved data, confirm what you have loaded, and skip straight to asking Who Is Involved.

If the user types any location name during the conversation that closely matches an existing one (case-insensitive, partial match is fine), ALWAYS ask: "Did you mean [existing location name]?" before proceeding. Only use the typed name if the user explicitly says it is different.
` : ''}
1. Location name (city/country where this takes place)
2. Vision (the overarching vision for this location)
3. What We Do (description of location activities)
4. Who Is Involved (people/groups who will participate)

THEN - Project Details:
5. Project Name
6. Project Description (a compelling 2-4 sentence overview)
7. Vision Alignment — ask: "How does this project's vision align with the overall vision of the location and${orgName ? ` ${orgName}` : ' the organisation'}?" Encourage a thoughtful answer that connects the project purpose to the broader location/org mission. Clean up and improve the answer as with other descriptive fields.
8. Project Summary (a detailed paragraph about the project)
9. Project Impact — ask two things together:
   a) How does this project benefit the community?
   b) Approximately how many people might be impacted (e.g. "~500 adults", "2,000 families", "an estimated 10,000 beneficiaries")? Encourage a realistic estimate with a brief description of who they are.
10. Total Budget and Currency
11. Timeline (when the project will take place)
12. Goals (3-5 key objectives as a list)

Rules:
- Be encouraging and conversational.
- Start with location information, THEN move to project details.
- When the user provides any descriptive text, automatically clean it up for spelling, grammar and fluidity, show them the improved version inline, and ask if they are happy with it before moving on.
- Ask clarifying questions if answers are vague.
- Do NOT ask for all fields at once.
- When asking about vision alignment, reference the location vision already collected so the user can see the connection.

LOCATION SAVING — IMPORTANT:
After you have confirmed the locationName, vision, and whatWeDo with the user (and they are happy with the cleaned-up text), output EXACTLY this on its own line BEFORE moving on to Who Is Involved:
LOCATION_SAVE:{"locationName":"the location name","vision":"the confirmed vision","whatWeDo":"the confirmed what we do"}
Then say: "Please press the **Save Location** button that has appeared to save your location details before we continue."
Do NOT ask the next question (Who Is Involved) until the user confirms the location has been saved.
NOTE: If the user selects an existing location (their message will say "(existing location selected)"), do NOT output LOCATION_SAVE — the location is already saved. Proceed directly to asking about Who Is Involved.

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
  "visionAlignment": "...",
  "projectSummary": "...",
  "projectImpact": "...",
  "impactedPeople": "...",
  "totalBudget": 0,
  "currency": "GBP",
  "timeline": "...",
  "goals": ["goal 1", "goal 2", "goal 3"]
}
\`\`\`

Then ask: "Are you happy with this profile? I can refine any section if you'd like. When you're ready, click the **Create Project** button that has appeared in the page header and below this message to register."

Once the user says they are happy or confirms, output EXACTLY this line on its own:
PROFILE_COMPLETE
followed immediately by the JSON block again (same format as above).`;

function extractJson(text: string): AIProjectProfile | null {
  // 1. Try strict parse from code-fenced block
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }

  // 2. Try to find a bare JSON object (no code fence)
  const braceMatch = text.match(/\{[\s\S]*"(?:name|locationName|location)"\s*:/);
  if (braceMatch) {
    // Find the opening { and try to find a balanced closing }
    const start = text.indexOf('{', braceMatch.index);
    if (start >= 0) {
      // Try progressively shorter substrings from last } back
      for (let end = text.lastIndexOf('}'); end > start; end = text.lastIndexOf('}', end - 1)) {
        try { return JSON.parse(text.slice(start, end + 1)); } catch { /* keep trying */ }
      }
    }
  }

  // 3. Fallback: extract individual fields with regex
  const raw = fenced ? fenced[1] : text;
  const profile: AIProjectProfile = {};
  const fieldMap: [keyof AIProjectProfile, string[]][] = [
    ['locationName', ['locationName', 'location']],
    ['vision', ['vision']],
    ['whatWeDo', ['whatWeDo']],
    ['whoIsInvolved', ['whoIsInvolved']],
    ['name', ['name']],
    ['description', ['description']],
    ['visionAlignment', ['visionAlignment', 'Alignment']],
    ['projectSummary', ['projectSummary']],
    ['projectImpact', ['projectImpact', 'Impact']],
    ['impactedPeople', ['impactedPeople']],
    ['currency', ['currency']],
    ['timeline', ['timeline']],
  ];

  let found = false;
  for (const [key, aliases] of fieldMap) {
    for (const alias of aliases) {
      // Match "key": "value" or "key": value
      const re = new RegExp(`"${alias}"\\s*:\\s*"([^"]*(?:"[^"]*)*?)(?:"|$)`, 'i');
      const m = raw.match(re);
      if (m && m[1]) {
        (profile as any)[key] = m[1].trim();
        found = true;
        break;
      }
    }
  }

  // Extract totalBudget as number
  const budgetMatch = raw.match(/"totalBudget"\s*:\s*(\d+)/i);
  if (budgetMatch) { profile.totalBudget = parseInt(budgetMatch[1]); found = true; }

  // Extract goals array
  const goalsMatch = raw.match(/"goals"\s*:\s*\[([\s\S]*?)\]/i);
  if (goalsMatch) {
    const goalStrings = goalsMatch[1].match(/"([^"]+)"/g);
    if (goalStrings) {
      profile.goals = goalStrings.map(g => g.replace(/^"|"$/g, ''));
      found = true;
    }
  }

  return found ? profile : null;
}

/** Does this assistant message contain JSON-like data (even malformed)? */
function hasJsonContent(text: string): boolean {
  if (!text) return false;
  if (/```json/i.test(text)) return true;
  if (/\{\s*"(?:name|locationName|location|vision)"\s*:/.test(text)) return true;
  return false;
}

/** Extract location data from LOCATION_SAVE marker in AI message */
function extractLocationSave(text: string): {locationName: string; vision?: string; whatWeDo?: string} | null {
  const match = text.match(/LOCATION_SAVE:\s*(\{[\s\S]*?\})/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.locationName) return parsed;
  } catch {
    // Try regex extraction as fallback
    const name = match[1].match(/"locationName"\s*:\s*"([^"]+)"/);
    const vision = match[1].match(/"vision"\s*:\s*"([^"]+)"/);
    const whatWeDo = match[1].match(/"whatWeDo"\s*:\s*"([^"]+)"/);
    if (name) return {
      locationName: name[1],
      vision: vision?.[1],
      whatWeDo: whatWeDo?.[1],
    };
  }
  return null;
}

function ProfilePreview({ profile }: { profile: AIProjectProfile }) {
  const fields: [string, string | number | string[] | undefined][] = [
    ['Location', profile.locationName],
    ['Vision', profile.vision],
    ['What We Do', profile.whatWeDo],
    ['Who Is Involved', profile.whoIsInvolved],
    ['Name', profile.name],
    ['Description', profile.description],
    ['Vision Alignment', profile.visionAlignment],
    ['Summary', profile.projectSummary],
    ['Impact', profile.projectImpact],
    ['People Impacted', profile.impactedPeople],
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
  const [orgLocations, setOrgLocations] = useState<{id: string; name: string; vision?: string; whatWeDo?: string}[]>([]);
  // locationsLoaded is true immediately when there is no org (nothing to load)
  const [locationsLoaded, setLocationsLoaded] = useState(!orgId);
  const [selectedLocation, setSelectedLocation] = useState<{id?: string; name: string; vision?: string; whatWeDo?: string} | null>(null);
  const [locationPendingSave, setLocationPendingSave] = useState(false);
  const [locationPickerStep, setLocationPickerStep] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const storageKey = orgId ? `ai_project_registration_${orgId}` : 'ai_project_registration_personal';
  const locationStorageKey = `ai_project_location_${orgId || 'personal'}`;

  // Load org locations so the AI can present them as choices at the start
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const org = await getOrgByCode(orgId);
        if (org && Array.isArray((org as any).locations)) {
          setOrgLocations(
            (org as any).locations
              .filter((l: any) => l.name)
              .map((l: any) => ({ id: l.id, name: l.name, vision: l.vision, whatWeDo: l.whatWeDo }))
          );
        }
      } catch { /* ignore */ } finally {
        setLocationsLoaded(true);
      }
    })();
  }, [orgId]);

  // Load saved state from localStorage — wait until locations are fetched so the
  // system prompt can include them in the very first AI message.
  useEffect(() => {
    if (!locationsLoaded) return; // wait for org locations to be fetched first

    // Restore saved location selection
    let savedLoc: {id?: string; name: string; vision?: string; whatWeDo?: string} | null = null;
    try {
      const raw = localStorage.getItem(locationStorageKey);
      if (raw) { savedLoc = JSON.parse(raw); setSelectedLocation(savedLoc); }
    } catch { /* ignore */ }

    // Check for saved conversation
    const saved = localStorage.getItem(storageKey);
    let hasSavedMessages = false;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.messages && parsed.messages.length > 0) {
          hasSavedMessages = true;
          setMessages(parsed.messages);
          setCurrentProfile(parsed.profile || null);
          setProfileReady(parsed.profileReady || false);
          setInitialized(true);
          return;
        }
      } catch { /* fall through to fresh start */ }
    }

    if (!hasSavedMessages) {
      // Fresh start — show location picker if org has locations and none already selected
      if (orgId && orgLocations.length > 0 && !savedLoc) {
        setLocationPickerStep(true);
        setInitialized(true);
        return;
      }
      // No locations to pick, or location already saved — start AI directly
      sendToAI([], true);
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationsLoaded, orgId]);

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

  async function sendToAI(history: Message[], isInit = false): Promise<AIProjectProfile | null> {
    setStreaming(true);
    abortRef.current = new AbortController();

    const userHistory = isInit ? [] : history;
    let extractedProfile: AIProjectProfile | null = null;

    try {
      const resp = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT(orgId ? orgName : null, orgLocations) },
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
      if (profile) {
        extractedProfile = profile;
        setCurrentProfile(profile);
      }

      if (assistantText.includes('PROFILE_COMPLETE')) {
        setProfileReady(true);
        const finalProfile = extractJson(assistantText) ?? currentProfile;
        if (finalProfile) {
          extractedProfile = finalProfile;
          setCurrentProfile(finalProfile);
        }
      }

      // Detect LOCATION_SAVE marker for new locations
      if (!selectedLocation && assistantText.includes('LOCATION_SAVE:')) {
        setLocationPendingSave(true);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' }]);
      }
    } finally {
      setStreaming(false);
    }

    return extractedProfile;
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

  async function handleApply(profileOverride?: AIProjectProfile) {
    const rawProfile = profileOverride ?? currentProfile;
    if (!rawProfile || creating) return;
    setCreateError('');
    setCreating(true);

    // Override location data with reliably saved selection (AI can lose content)
    const savedLoc = selectedLocation || (() => {
      try {
        const raw = localStorage.getItem(locationStorageKey);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    })();
    const profile = { ...rawProfile };
    if (savedLoc) {
      profile.locationName = savedLoc.name;
      if (savedLoc.vision) profile.vision = savedLoc.vision;
      if (savedLoc.whatWeDo) profile.whatWeDo = savedLoc.whatWeDo;
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('You must be logged in.');

      // Fetch org data only when linked to an organisation
      let org: any = null;
      let locationId: string | null = null;

      if (orgId) {
        const orgResult = await getOrgByCode(orgId);
        if (!orgResult) throw new Error('Organization not found.');
        org = orgResult;

        // ── Location matching & auto-add ─────────────────────────────────────
        const existingLocations: any[] = Array.isArray((org as any).locations) ? (org as any).locations : [];

        if (profile.locationName?.trim()) {
          const nameLower = profile.locationName.trim().toLowerCase();
          const matched = existingLocations.find(
            (l: any) => (l.name || '').toLowerCase() === nameLower
          );

          if (matched) {
            locationId = matched.id;
            const needsUpdate =
              (!matched.vision && profile.vision) ||
              (!matched.whatWeDo && profile.whatWeDo);
            if (needsUpdate) {
              const updated = {
                ...matched,
                vision: matched.vision || profile.vision || undefined,
                whatWeDo: matched.whatWeDo || profile.whatWeDo || undefined,
              };
              const cleanUpdated: any = Object.fromEntries(
                Object.entries(updated).filter(([, v]) => v !== undefined)
              );
              await updateOrg(org.id, { locations: fieldArrayRemove(matched) } as any);
              await updateOrg(org.id, { locations: fieldArrayUnion(cleanUpdated) } as any);
            }
          } else {
            const newId = Math.random().toString(36).slice(2, 10).toUpperCase();
            const newLoc: any = Object.fromEntries(
              Object.entries({
                id: newId,
                name: profile.locationName.trim(),
                vision: profile.vision?.trim() || undefined,
                whatWeDo: profile.whatWeDo?.trim() || undefined,
              }).filter(([, v]) => v !== undefined)
            );
            await updateOrg(org.id, { locations: fieldArrayUnion(newLoc) } as any);
            locationId = newId;
          }
        }
        // ─────────────────────────────────────────────────────────────────────
      }

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
      (['name', 'description', 'vision', 'whatWeDo', 'whoIsInvolved', 'visionAlignment', 'projectSummary', 'projectImpact'] as const).forEach(f => {
        const v = (profile as any)[f];
        if (v && typeof v === 'string') contentToScan[f] = v;
      });
      const modResult = await moderateProfileContent(contentToScan, 'project');
      const initialStatus = modResult.flagged ? 'pending_review' : 'live';
      // ──────────────────────────────────────────────────────────────────────

      // Inherit org theme (only when an org is linked)
      const THEME_KEYS = [
        'themeHeaderBg', 'themeHeaderText', 'themeAccent', 'themeAccentText', 'themeAccentHover',
        'themeTabActiveBg', 'themeTabActiveText', 'themeTabInactiveText', 'themeWidgetTitleColor'
      ] as const;
      const inheritedTheme: Record<string, any> = {};
      if (org) {
        THEME_KEYS.forEach(k => {
          if (typeof (org as any)[k] === 'string' && (org as any)[k]) inheritedTheme[k] = (org as any)[k];
        });
        if (!inheritedTheme.themeAccent && (org as any)?.themeHeaderBg) inheritedTheme.themeAccent = (org as any).themeHeaderBg;
        if (!inheritedTheme.themeTabActiveBg && inheritedTheme.themeAccent) inheritedTheme.themeTabActiveBg = inheritedTheme.themeAccent;
      }

      // Create project via DAL (deducts credits atomically)
      const { docId: newProjectDocId } = await createProjectWithCredits({
        uid: user.uid,
        projectData: {
          name: profile.name || 'Untitled Project',
          description: profile.description || '',
          projectId,
          users: [{ uid: user.uid, role: 'Admin' }],
          createdBy: user.uid,
          
          // Organization linkage (only when org is present)
          ...(org ? {
            organizationId: (org as any).orgId,
            organizationName: (org as any).name || null,
            organizationLogoUrl: (org as any).logoUrl || null,
            originatingOrganizationId: (org as any).orgId,
            originatingOrganizationDbId: org.id,
          } : {}),

          // AI-gathered project details
          vision: profile.vision || null,
          whatWeDo: profile.whatWeDo || null,
          whoIsInvolved: profile.whoIsInvolved || null,
          visionAlignment: profile.visionAlignment || null,
          projectSummary: profile.projectSummary || null,
          projectImpact: profile.projectImpact || null,
          impactedPeople: profile.impactedPeople || null,
          totalBudget: profile.totalBudget || null,
          currency: profile.currency || 'GBP',
          timeline: profile.timeline || null,
          goals: profile.goals || [],
          
          // Location
          location: profile.locationName ? {
            search: profile.locationName.toLowerCase(),
            country: null,
            town: null,
            latitude: null,
            longitude: null,
          } : null,
          locationName: profile.locationName || null,
          locationId: locationId || null,

          // Cover photo placeholder
          coverPhotoUrl: null,
          
          // Visibility defaults
          showOnOrganizationOverview: !!org,
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
          profileName: profile.name || 'Untitled Project',
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

      // Clear saved conversation and location
      localStorage.removeItem(storageKey);
      localStorage.removeItem(locationStorageKey);

      // Navigate to the new project profile
      router.push(`/projects/${projectId}/proposal`);

    } catch (e: any) {
      setCreateError(e.message || 'Failed to create project');
      setCreating(false);
    }
  }

  function handleBack() {
    // Don't clear storage, so user can come back
    router.push(orgId ? `/org/${orgId}` : '/profile?tab=projects');
  }

  // "Create Now" — extract whatever data has been collected and save immediately.
  // Never sends another message to the AI.
  async function handleCreateNow() {
    if (creating || streaming) return;

    // 1. Use already-parsed profile if available
    if (currentProfile) {
      await handleApply(currentProfile);
      return;
    }

    // 2. Scan all assistant messages for the most recent JSON block
    let extracted: AIProjectProfile | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        const p = extractJson(messages[i].content);
        if (p) { extracted = p; break; }
      }
    }

    // 3. If still nothing, create a bare-minimum profile so the record is at least saved
    const profile: AIProjectProfile = extracted ?? { name: 'Untitled Project' };

    // Update state so UI reflects it, then apply
    setCurrentProfile(profile);
    await handleApply(profile);
  }

  // Handle selecting an existing organization location
  function handleSelectLocation(loc: {id: string; name: string; vision?: string; whatWeDo?: string}) {
    const locationData = { id: loc.id, name: loc.name, vision: loc.vision, whatWeDo: loc.whatWeDo };
    setSelectedLocation(locationData);
    localStorage.setItem(locationStorageKey, JSON.stringify(locationData));
    setLocationPendingSave(false);
    setLocationPickerStep(false);
    // Send a user message so the AI knows the location is already chosen and skips location questions
    const msg = `I'll use the existing location: ${loc.name} (existing location selected)`;
    const initHistory: Message[] = [{ role: 'user', content: msg }];
    setMessages(initHistory);
    sendToAI(initHistory);
  }

  // Start AI without pre-selecting a location (user wants to create a new one)
  function handleStartNewLocation() {
    setLocationPickerStep(false);
    sendToAI([], true);
  }

  // Handle saving a new location collected via chat
  function handleSaveNewLocation() {
    // Extract location data from the latest assistant messages
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        const locData = extractLocationSave(messages[i].content);
        if (locData) {
          const locationData = { name: locData.locationName, vision: locData.vision, whatWeDo: locData.whatWeDo };
          setSelectedLocation(locationData);
          localStorage.setItem(locationStorageKey, JSON.stringify(locationData));
          setLocationPendingSave(false);
          // Send confirmation so AI continues
          const msg = '[Location saved successfully — please continue]';
          const newHistory: Message[] = [...messages, { role: 'user', content: msg }];
          setMessages(newHistory);
          sendToAI(newHistory);
          return;
        }
      }
    }
  }

  // Strip PROFILE_COMPLETE + LOCATION_SAVE markers from visible message text
  function cleanMessage(text: string) {
    return text
      .replace(/PROFILE_COMPLETE\s*/g, '')
      .replace(/LOCATION_SAVE:\s*\{[\s\S]*?\}\s*/g, '')
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
            <div key={i} className="mt-2 w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 text-[11px] font-mono text-gray-700 space-y-1 max-h-48 overflow-y-auto break-all">
                {Object.entries(parsed).map(([k, v]) => (
                  <div key={k} className="flex gap-1 flex-wrap"><span className="font-semibold text-orange-600 flex-shrink-0">{k}:</span><span>{Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</span></div>
                ))}
              </div>
            </div>
          );
        }
        return <pre key={i} className="mt-2 bg-gray-100 rounded p-2 text-[11px] overflow-x-auto max-w-full whitespace-pre-wrap break-all">{json}</pre>;
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

  return (
    <PageShell
      title={
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            title={orgId ? 'Back to organization' : 'Back to profile'}
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
          {(messages.length > 0 || (locationPickerStep && selectedLocation)) && (
            <button
              onClick={() => {
                if (confirm('Start fresh? Your current conversation will be cleared.')) {
                  localStorage.removeItem(storageKey);
                  localStorage.removeItem(locationStorageKey);
                  setMessages([]);
                  setCurrentProfile(null);
                  setProfileReady(false);
                  setCreateError('');
                  setPendingReviewMsg('');
                  setSelectedLocation(null);
                  setLocationPendingSave(false);
                  if (orgId && orgLocations.length > 0) {
                    setLocationPickerStep(true);
                  } else {
                    setLocationPickerStep(false);
                    sendToAI([], true);
                  }
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-white/30 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              Start Fresh
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleCreateNow}
              disabled={creating || streaming}
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
                  {currentProfile ? 'Create Project (50 Credits)' : 'Create Now'}
                </>
              )}
            </button>
          )}
        </div>
      }
      contentClassName="p-0"
    >
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Location picker step — shown before AI chat when org has existing locations */}
        {locationPickerStep && (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-6 overflow-y-auto">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mb-4">
                  <SparklesIcon className="w-6 h-6 text-orange-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Choose a Location</h2>
                <p className="text-sm text-gray-500">
                  Select an existing location for this project, or create a new one.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {orgLocations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => handleSelectLocation(loc)}
                    className="flex flex-col items-start text-left p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-orange-400 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1 w-full">
                      <span className="text-lg">📍</span>
                      <span className="font-semibold text-gray-900 group-hover:text-orange-700 text-sm flex-1 truncate">{loc.name}</span>
                    </div>
                    {loc.vision && (
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{loc.vision}</p>
                    )}
                  </button>
                ))}
              </div>
              <div className="text-center">
                <button
                  onClick={handleStartNewLocation}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 text-sm font-medium hover:border-orange-400 hover:text-orange-700 hover:bg-orange-50 transition-all"
                >
                  <span className="text-lg">+</span>
                  Create a new location
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Chat panel */}
        {!locationPickerStep && <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
          {/* Saved location indicator */}
          {selectedLocation && (
            <div className="mx-4 mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800 flex-shrink-0">
              <CheckIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>Location saved: <strong>{selectedLocation.name}</strong></span>
            </div>
          )}
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {messages.map((m, i) => {
              // Check if this assistant message contains JSON-like data
              const hasJson = m.role === 'assistant' && hasJsonContent(m.content);
              return (
              <div key={i}>
              <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <SparklesIcon className="w-4 h-4 text-orange-500" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden ${
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
              {/* "Use This Data" button — shown for any message with JSON-like content */}
              {hasJson && !streaming && (
                <div className="flex justify-start ml-9 mt-2">
                  <button
                    onClick={() => {
                      const profile = extractJson(m.content);
                      if (profile) {
                        handleApply(profile);
                      } else {
                        setCreateError('Could not parse profile data from this message. Try asking the AI to output the JSON again.');
                      }
                    }}
                    disabled={creating}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors shadow"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Use This Data
                  </button>
                </div>
              )}

              {/* Save Location button — shown when AI has collected new location data */}
              {m.role === 'assistant' && m.content.includes('LOCATION_SAVE:') && locationPendingSave && !selectedLocation && !streaming && (
                <div className="flex justify-start ml-9 mt-3">
                  <button
                    onClick={handleSaveNewLocation}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors shadow"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Save Location
                  </button>
                </div>
              )}
              </div>
              );
            })}
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
                  onClick={() => handleApply(currentProfile)}
                  disabled={creating}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
            {currentProfile && (
              <button
                onClick={() => handleApply(currentProfile)}
                disabled={creating}
                className="mb-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating Project...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Create Project (50 Credits)
                  </>
                )}
              </button>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming || locationPendingSave}
                placeholder={locationPendingSave ? 'Please save the location above to continue…' : streaming ? 'Waiting for response…' : 'Type your answer… (Enter to send, Shift+Enter for new line)'}
                rows={2}
                maxLength={MAX_USER_MESSAGE_LENGTH}
                className="flex-1 resize-none border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                onClick={handleSend}
                disabled={streaming || locationPendingSave || !input.trim()}
                className="p-2.5 rounded-xl bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 transition-colors flex-shrink-0"
                title="Send"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        }

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
                onClick={() => handleApply(currentProfile)}
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
