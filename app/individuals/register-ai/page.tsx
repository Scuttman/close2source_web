"use client";
import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import PageShell from '../../../components/PageShell';
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { generateCode } from '../../../src/lib/codes';
import { sanitizeUserMessage, MAX_USER_MESSAGE_LENGTH } from '../../../src/lib/sanitizeAIInput';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIIndividualProfile {
  name?: string;
  bio?: string;
  story?: string;
  vision?: string;
  serviceLocation?: string;
  organization?: string;
  ministryDescription?: string;
  focusAreas?: string[];
  isFamily?: boolean;
  yearsInService?: number;
}

const SYSTEM_PROMPT = `You are a helpful assistant helping missionaries, volunteers, and ministry workers create their personal profile. Your role is to have a natural conversation to gather information about them and their work.

Start by asking about their basic information:
1. Their name (or family name if it's a family profile)
2. Whether this is an individual or family profile
3. Where they serve (location)
4. What organization they serve with
5. Their vision and calling
6. Their focus areas/ministry activities
7. Years in service
8. Their story and journey

Be warm, encouraging, and ask follow-up questions to get rich details. 

IMPORTANT: After gathering sufficient information (at least name, location, and basic ministry description), you MUST output the profile data. When you have enough information, say something like "Great! I have everything I need to create your profile." then output the JSON.

Extract the information into this EXACT JSON format wrapped in <profile></profile> tags:

<profile>
{
  "name": "Full name here",
  "isFamily": false,
  "serviceLocation": "City, Country",
  "organization": "Organization name",
  "vision": "Their vision statement",
  "story": "Their journey story",
  "ministryDescription": "Daily ministry work",
  "focusAreas": ["area1", "area2"],
  "yearsInService": 5,
  "bio": "Brief summary"
}
</profile>

CRITICAL JSON FORMATTING RULES:
- Use ONLY double quotes (") for ALL strings, never single quotes (')
- ALL string values MUST be wrapped in double quotes: "name": "value"
- Numbers should NOT be in quotes: "yearsInService": 5
- Booleans should NOT be in quotes: "isFamily": false (not "false")
- Array items must be in quotes: ["item1", "item2"]
- Ensure all strings are properly closed with double quotes
- Do not include comments in the JSON
- After 4-5 exchanges, you should have enough information to output the profile

Example of CORRECT JSON:
{
  "name": "John Smith",
  "isFamily": false,
  "yearsInService": 10
}

Example of WRONG JSON (DO NOT DO THIS):
{
  "name": John Smith,
  "isFamily": "false",
  "yearsInService": "10"
}

Keep the conversation natural but be sure to conclude with the profile output after gathering key information.`;

function RegisterAIPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<AIIndividualProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showManualFinish, setShowManualFinish] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const auth = getAuth();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Load from localStorage
  useEffect(() => {
    const storageKey = `ai_individual_registration`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.messages) setMessages(data.messages);
        if (data.profile) setCurrentProfile(data.profile);
        if (data.profileReady) setProfileReady(data.profileReady);
        
        // Check if we should show manual finish button
        const userMessages = data.messages?.filter((m: Message) => m.role === 'user') || [];
        if (userMessages.length >= 4 && !data.profileReady) {
          setShowManualFinish(true);
        }
      } catch (e) {
        console.error('Failed to parse saved data:', e);
      }
    } else {
      // Initialize with welcome message
      const welcomeMsg: Message = {
        role: 'assistant',
        content: "Hello! I'm here to help you create your missionary/volunteer profile. Let's start by getting to know you. What's your name, and are you creating this profile for yourself or your family?"
      };
      setMessages([{ role: 'system', content: SYSTEM_PROMPT }, welcomeMsg]);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (messages.length === 0) return;
    const storageKey = `ai_individual_registration`;
    localStorage.setItem(storageKey, JSON.stringify({
      messages,
      profile: currentProfile,
      profileReady,
      timestamp: Date.now()
    }));
    
    // Show manual finish button after 8+ messages if profile not ready
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length >= 4 && !profileReady) {
      setShowManualFinish(true);
    }
  }, [messages, currentProfile, profileReady]);

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
            { role: 'system', content: SYSTEM_PROMPT },
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
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      // Extract profile if present
      const profileMatch = assistantText.match(/<profile>([\s\S]*?)<\/profile>/);
      if (profileMatch) {
        try {
          const raw = profileMatch[1];

          // Schema-aware extractor — immune to prose contamination.
          // Searches the raw text for each known field by name regardless of
          // surrounding prose, broken JSON structure, or missing braces.
          function extractField<T>(
            text: string,
            key: string,
            type: 'string' | 'number' | 'boolean' | 'array',
          ): T | undefined {
            // Escape key for regex safety
            const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (type === 'string') {
              // Quoted string value (allow escaped quotes inside)
              const m = text.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's'));
              if (m) return m[1] as unknown as T;
              // Unquoted value up to comma / closing brace / newline
              const m2 = text.match(new RegExp(`"${k}"\\s*:\\s*([^"\\[{\\],}\\n][^,}\\]\\n]*)`, 'm'));
              if (m2) return m2[1].trim() as unknown as T;
            } else if (type === 'number') {
              const m = text.match(new RegExp(`"${k}"\\s*:\\s*"?(\\d+(?:\\.\\d+)?)"?`));
              if (m) return Number(m[1]) as unknown as T;
            } else if (type === 'boolean') {
              const m = text.match(new RegExp(`"${k}"\\s*:\\s*"?(true|false)"?`, 'i'));
              if (m) return (m[1].toLowerCase() === 'true') as unknown as T;
            } else if (type === 'array') {
              // Capture content between [ and the matching ]
              const start = text.search(new RegExp(`"${k}"\\s*:\\s*\\[`));
              if (start !== -1) {
                const bracket = text.indexOf('[', start);
                let depth = 0, end = -1;
                for (let i = bracket; i < text.length; i++) {
                  if (text[i] === '[') depth++;
                  else if (text[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
                }
                if (end !== -1) {
                  const inner = text.slice(bracket + 1, end);
                  // Split on commas not inside quotes
                  const items: string[] = [];
                  let cur = '', inQ = false;
                  for (const ch of inner) {
                    if (ch === '"') inQ = !inQ;
                    if (ch === ',' && !inQ) { items.push(cur.trim()); cur = ''; }
                    else cur += ch;
                  }
                  if (cur.trim()) items.push(cur.trim());
                  return items
                    .map(s => s.replace(/^["']|["']$/g, '').trim())
                    .filter(Boolean) as unknown as T;
                }
              }
            }
            return undefined;
          }

          const profileData: AIIndividualProfile = {
            name:                extractField(raw, 'name', 'string'),
            bio:                 extractField(raw, 'bio', 'string'),
            story:               extractField(raw, 'story', 'string'),
            vision:              extractField(raw, 'vision', 'string'),
            serviceLocation:     extractField(raw, 'serviceLocation', 'string'),
            organization:        extractField(raw, 'organization', 'string'),
            ministryDescription: extractField(raw, 'ministryDescription', 'string'),
            focusAreas:          extractField(raw, 'focusAreas', 'array'),
            isFamily:            extractField(raw, 'isFamily', 'boolean'),
            yearsInService:      extractField(raw, 'yearsInService', 'number'),
          };

          // Only keep keys that resolved to a value
          (Object.keys(profileData) as (keyof AIIndividualProfile)[]).forEach(k => {
            if (profileData[k] === undefined) delete profileData[k];
          });

          if (!profileData.name) throw new Error('Could not extract profile name from AI output');

          console.log('Extracted profile:', profileData);
          setCurrentProfile(prev => ({ ...prev, ...profileData }));
          setProfileReady(true);
        } catch (e: any) {
          console.error('Failed to extract profile:', e);
          console.error('Raw match:', profileMatch[1]);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'I had trouble formatting your profile data. Let me try gathering the information again. Could you please confirm your name and where you serve?'
          }]);
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setStreaming(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    const { text, blocked, reason } = sanitizeUserMessage(input);
    if (blocked) {
      setMessages(prev => [...prev, { role: 'assistant', content: reason ?? 'That message could not be processed. Please rephrase.' }]);
      setInput('');
      return;
    }
    const userMessage: Message = { role: 'user', content: text };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    await sendToAI(newHistory);
  }

  async function handleFinishProfile() {
    if (streaming) return;
    
    const finishMessage: Message = { 
      role: 'user', 
      content: 'I think we have covered everything. Please create my profile now with the information we discussed.' 
    };
    const newHistory = [...messages, finishMessage];
    setMessages(newHistory);
    
    await sendToAI(newHistory);
  }

  async function handleApply() {
    if (!currentProfile || !auth.currentUser) return;

    setApplying(true);
    try {
      const user = auth.currentUser;
      const individualId = generateCode('individual');
      
      // Create individual profile and deduct credits
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw new Error('User profile not found.');
        
        const userData = userSnap.data();
        if ((userData.credits || 0) < 50) throw new Error('Not enough credits. You need 50 credits to create an individual profile.');

        const individualRef = doc(collection(db, 'individuals'));
        
        transaction.set(individualRef, {
          ...currentProfile,
          individualId,
          ownerUid: user.uid,
          ownerId: user.uid,
          type: 'missionary',
          profileType: 'missionary',
          createdAt: serverTimestamp(),
          updates: [],
          prayerRequests: [],
          financeSummary: [],
          profilePosts: [],
        });

        transaction.update(userRef, {
          credits: (userData.credits || 0) - 50
        });
      });

      // Clear localStorage
      localStorage.removeItem(`ai_individual_registration`);

      // Navigate to the profile
      router.push(`/individuals/profile?id=${individualId}`);

    } catch (error: any) {
      console.error('Error creating profile:', error);
      alert(error.message || 'Failed to create profile. Please try again.');
    } finally {
      setApplying(false);
    }
  }

  function handleStartFresh() {
    if (confirm('Are you sure you want to start over? Your current conversation will be lost.')) {
      localStorage.removeItem(`ai_individual_registration`);
      setMessages([]);
      setCurrentProfile(null);
      setProfileReady(false);
      setShowManualFinish(false);
      // Re-initialize
      const welcomeMsg: Message = {
        role: 'assistant',
        content: "Hello! I'm here to help you create your missionary/volunteer profile. Let's start by getting to know you. What's your name, and are you creating this profile for yourself or your family?"
      };
      setMessages([{ role: 'system', content: SYSTEM_PROMPT }, welcomeMsg]);
    }
  }

  return (
    <PageShell
      title={<span className="flex items-center gap-2"><SparklesIcon className="w-6 h-6" />AI Individual Profile Registration</span>}
      headerRight={messages.length > 2 ? (
        <button
          onClick={handleStartFresh}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-all bg-white/15 text-white border-white/25 hover:bg-white/25"
          title="Start fresh conversation"
        >
          <ArrowPathIcon className="w-4 h-4" />
          <span>Start Fresh</span>
        </button>
      ) : undefined}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Chat messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 mb-4"
        >
          {messages
            .filter(m => m.role !== 'system')
            .map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 break-words ${
                    message.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.content.replace(/<profile>[\s\S]*?<\/profile>/g, '').trim()}
                </div>
              </div>
            ))}
          
          {streaming && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Finish Profile button - shows after several exchanges if profile not detected */}
          {showManualFinish && !profileReady && !streaming && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleFinishProfile}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors shadow-md"
              >
                Finish & Generate Profile
              </button>
            </div>
          )}

          {/* Create Profile button - inline */}
          {profileReady && currentProfile && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-8 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-lg"
              >
                {applying ? 'Creating Profile...' : 'Create My Profile'}
              </button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-white/50">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              maxLength={MAX_USER_MESSAGE_LENGTH}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={streaming || applying}
            />
            <button
              type="submit"
              disabled={streaming || !input.trim() || applying}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}

export default function RegisterAIPage() {
  return (
    <Suspense fallback={
      <PageShell title="AI Individual Registration">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-main" />
        </div>
      </PageShell>
    }>
      <RegisterAIPageInner />
    </Suspense>
  );
}
