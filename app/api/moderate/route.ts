import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/moderate
 *
 * Mandatory content-moderation endpoint — cannot be bypassed by users
 * regardless of their AI consent preference.  Every profile publish action
 * calls this before writing status:'live' to Firestore.
 *
 * Steps:
 *   1. OpenAI Moderation API (free, <200ms) — catches hate/violence/sexual/
 *      self-harm at the model-level
 *   2. GPT safeguarding check — catches subtler radicalisation language,
 *      grooming, exploitation, and safeguarding concerns that the moderation
 *      API may miss
 *
 * Request body:
 *   { content: { [field]: string }, profileType: 'project'|'individual'|'organization' }
 *
 * Response:
 *   { flagged: boolean, severity: 'clean'|'low'|'medium'|'high',
 *     categories: string[], reason: string }
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODERATION_URL = 'https://api.openai.com/v1/moderations';
const CHAT_URL       = 'https://api.openai.com/v1/chat/completions';

type Severity = 'clean' | 'low' | 'medium' | 'high';

interface ModerationResponse {
  flagged: boolean;
  severity: Severity;
  categories: string[];
  reason: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` };
}

function contentToText(content: Record<string, string>): string {
  return Object.entries(content)
    .filter(([, v]) => v && typeof v === 'string')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n\n');
}

// ─── Step 1: OpenAI Moderation API ───────────────────────────────────────────

async function runModerationAPI(text: string): Promise<{ flagged: boolean; categories: string[] }> {
  try {
    const res = await fetch(MODERATION_URL, {
      method:  'POST',
      headers: authHeader(),
      body:    JSON.stringify({ input: text }),
    });
    if (!res.ok) return { flagged: false, categories: [] };

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return { flagged: false, categories: [] };

    const flaggedCats = Object.entries(result.categories as Record<string, boolean>)
      .filter(([, v]) => v)
      .map(([k]) => k);

    return { flagged: result.flagged, categories: flaggedCats };
  } catch {
    return { flagged: false, categories: [] };
  }
}

// ─── Step 2: GPT safeguarding check ──────────────────────────────────────────

const SAFEGUARDING_SYSTEM = `You are a content-safety reviewer for a platform that publishes profiles of missionaries, volunteers, and development-project workers in Africa and developing countries.

Your job is to review profile text for:
1. Safeguarding concerns — grooming language, inappropriate references to children or vulnerable adults, exploitation
2. Radicalisation — terrorist advocacy, extremist ideology, calls to violence, links to proscribed organisations
3. Harmful fundraising — scam indicators, fraudulent charity impersonation
4. Hate speech — content targeting protected groups

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{
  "flagged": true | false,
  "severity": "clean" | "low" | "medium" | "high",
  "categories": ["category1"],
  "reason": "Brief explanation or empty string if clean"
}

Severity guide:
- "clean": no concerns
- "low": unusual phrasing that warrants a quick human review but is likely innocent
- "medium": content that looks suspicious and must be reviewed before publishing
- "high": clear violation — must not be published without manual override`;

async function runSafeguardingCheck(text: string, profileType: string): Promise<{ flagged: boolean; severity: Severity; categories: string[]; reason: string }> {
  try {
    const res = await fetch(CHAT_URL, {
      method:  'POST',
      headers: authHeader(),
      body:    JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SAFEGUARDING_SYSTEM },
          { role: 'user',   content: `Profile type: ${profileType}\n\n${text}` },
        ],
        temperature:  0,
        max_tokens:   200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return { flagged: false, severity: 'clean', categories: [], reason: '' };

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    return {
      flagged:    !!parsed.flagged,
      severity:   (parsed.severity as Severity) || 'clean',
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      reason:     typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  } catch {
    return { flagged: false, severity: 'clean', categories: [], reason: '' };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<ModerationResponse | { error: string }>> {
  if (!OPENAI_API_KEY) {
    // If AI is not configured, allow publish to proceed — log a warning
    console.warn('[/api/moderate] OPENAI_API_KEY not set — skipping moderation');
    return NextResponse.json({ flagged: false, severity: 'clean', categories: [], reason: '' });
  }

  try {
    const body = await req.json();
    const content: Record<string, string> = body.content || {};
    const profileType: string = body.profileType || 'unknown';

    if (!content || typeof content !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const text = contentToText(content);
    if (!text.trim()) {
      return NextResponse.json({ flagged: false, severity: 'clean', categories: [], reason: '' });
    }

    // Run both checks — moderation API is cheap/fast; GPT adds safeguarding depth
    const [modResult, safeguardResult] = await Promise.all([
      runModerationAPI(text),
      runSafeguardingCheck(text, profileType),
    ]);

    // Merge: flagged if either check flagged
    const allFlagged    = modResult.flagged || safeguardResult.flagged;
    const allCategories = [...new Set([...modResult.categories, ...safeguardResult.categories])];

    // Choose worst severity
    const severityOrder: Severity[] = ['clean', 'low', 'medium', 'high'];
    const modSeverity: Severity = modResult.flagged
      ? (modResult.categories.some(c => ['hate', 'violence', 'harassment'].some(h => c.includes(h))) ? 'high' : 'medium')
      : 'clean';
    const finalSeverity = severityOrder.indexOf(modSeverity) >  severityOrder.indexOf(safeguardResult.severity)
      ? modSeverity
      : safeguardResult.severity;

    const reason = [
      modResult.categories.length ? `Moderation API: ${modResult.categories.join(', ')}` : '',
      safeguardResult.reason,
    ].filter(Boolean).join(' | ');

    return NextResponse.json({
      flagged:    allFlagged,
      severity:   allCategories.length ? finalSeverity : 'clean',
      categories: allCategories,
      reason:     reason || '',
    });
  } catch (err: any) {
    console.error('[/api/moderate] error:', err);
    // Fail open — do NOT block publish on a moderation error; log and allow
    return NextResponse.json({ flagged: false, severity: 'clean', categories: [], reason: '' });
  }
}
