"use client";
import { useEffect, useRef, useState } from 'react';
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon, CheckIcon } from '@heroicons/react/24/outline';
import { sanitizeUserMessage, sanitizePromptParam, MAX_USER_MESSAGE_LENGTH } from '../src/lib/sanitizeAIInput';

export interface AIProjectProfile {
  name?: string;
  description?: string;
  projectHeading?: string;
  projectSummary?: string;
  projectImpact?: string;
  beneficiaries?: string;
  locationName?: string;
  totalBudget?: number;
  currency?: string;
  goals?: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  orgName: string;
  onApply: (profile: AIProjectProfile) => void;
  onClose: () => void;
}

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

const SYSTEM_PROMPT = (orgName: string) => `You are a project registration assistant for Close2Source — a platform connecting organisations with community projects. You are helping someone from "${orgName}" create a compelling, well-written project profile.

Your job is to gather the following information through a friendly conversation, ONE or TWO topics at a time:
1. Project Name
2. Project Description (a compelling 2-4 sentence overview)
3. Project Heading/Tagline (a short punchy headline)
4. Project Summary (a detailed paragraph)
5. Project Impact (how it benefits the community)
6. Beneficiaries (who will directly benefit)
7. Location name (city/country where the project takes place)
8. Total Budget and Currency
9. Goals (3-5 key objectives as a list)

Rules:
- Be encouraging and conversational.
- When the user provides any descriptive text, automatically clean it up for spelling, grammar and fluidity, show them the improved version inline, and ask if they are happy with it before moving on.
- Ask clarifying questions if answers are vague.
- Do NOT ask for all fields at once.

When you have gathered all the fields, say:
"Great! I have everything I need. Here is your project profile:" 

Then output a JSON block in this EXACT format (no extra text after the block):

\`\`\`json
{
  "name": "...",
  "description": "...",
  "projectHeading": "...",
  "projectSummary": "...",
  "projectImpact": "...",
  "beneficiaries": "...",
  "locationName": "...",
  "totalBudget": 0,
  "currency": "GBP",
  "goals": ["goal 1", "goal 2", "goal 3"]
}
\`\`\`

Then ask: "Are you happy with this profile? I can refine any section if you'd like. When you're ready, click **Apply to Form** to register."

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
    ['Name', profile.name],
    ['Tagline', profile.projectHeading],
    ['Description', profile.description],
    ['Summary', profile.projectSummary],
    ['Impact', profile.projectImpact],
    ['Beneficiaries', profile.beneficiaries],
    ['Location', profile.locationName],
    ['Budget', profile.totalBudget !== undefined ? `${profile.currency ?? ''} ${profile.totalBudget}`.trim() : undefined],
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

export default function ProjectAIChatModal({ orgName, onApply, onClose }: Props) {
  const safeOrgName = sanitizePromptParam(orgName);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<AIProjectProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Start conversation on mount
  useEffect(() => {
    sendToAI([], true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  async function sendToAI(history: Message[], isInit = false) {
    setStreaming(true);
    abortRef.current = new AbortController();

    const userHistory = isInit ? [] : history;

    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT(safeOrgName) },
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

  return (
    <div className="fixed inset-0 h-screen z-[100] bg-gray-50 flex flex-col" style={{ overscrollBehavior: 'contain' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-orange-500" />
          <span className="font-bold text-gray-800">AI Project Registration</span>
          <span className="text-xs text-gray-400 ml-1">— guided by ChatGPT</span>
        </div>
        <div className="flex items-center gap-3">
          {profileReady && currentProfile && (
            <button
              onClick={() => onApply(currentProfile)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors"
            >
              <CheckIcon className="w-4 h-4" />
              Apply to Form
            </button>
          )}
          <button
            onClick={() => { abortRef.current?.abort(); onClose(); }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Chat panel */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
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
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="border-t bg-white px-4 py-3 flex-shrink-0">
            {profileReady && (
              <div className="mb-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckIcon className="w-4 h-4 flex-shrink-0" />
                Profile complete! Click <strong>Apply to Form</strong> above to pre-fill the registration form, or keep chatting to refine.
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
            {profileReady && (
              <div className="px-4 py-3 border-t flex-shrink-0">
                <button
                  onClick={() => onApply(currentProfile)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors"
                >
                  <CheckIcon className="w-4 h-4" />
                  Apply to Form
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
