// AI Text Service — routed through the server-side /api/ai proxy.
// The OpenAI key is stored as OPENAI_API_KEY (no NEXT_PUBLIC_ prefix) and
// is never sent to the browser.  All components call /api/ai instead.
const AI_PROXY_URL = '/api/ai';

export async function refineTextWithAI(text: string, instruction: string): Promise<string> {
  if (!text.trim()) throw new Error('Text cannot be empty');
  if (!instruction.trim()) throw new Error('Instruction cannot be empty');

  try {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful writing assistant. Apply the user\'s instruction to refine the provided text. Return only the refined text without explanations.',
          },
          { role: 'user', content: `Text:\n${text}\n\nInstruction: ${instruction}` },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI Text Service Error:', error);
    throw error;
  }
}

export async function improveTextWithAI(text: string, context?: string): Promise<string> {
  if (!text.trim()) {
    throw new Error('Text cannot be empty');
  }

  const prompt = context
    ? `Improve the following text for ${context}. Keep the same meaning and tone, but make it clearer, more professional, and fix any grammar or spelling issues:\n\n${text}`
    : `Improve the following text. Keep the same meaning and tone, but make it clearer, more professional, and fix any grammar or spelling issues:\n\n${text}`;

  try {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful writing assistant that improves text while preserving the author\'s voice and intent. Return only the improved text without explanations or additional commentary.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI Text Service Error:', error);
    throw error;
  }
}

export async function makeTextShorter(text: string, paragraphs?: number): Promise<string> {
  if (!text.trim()) {
    throw new Error('Text cannot be empty');
  }

  const paraInstruction = paragraphs
    ? ` Write it as exactly ${paragraphs} paragraph${paragraphs > 1 ? 's' : ''}.`
    : '';

  try {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful writing assistant. Make the text more concise while preserving all key information.${paraInstruction} Return only the shortened text.`,
          },
          { role: 'user', content: `Make this text shorter and more concise:\n\n${text}` },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI Text Service Error:', error);
    throw error;
  }
}

export async function generateListWithAI(
  context: string,
  existingItems: string[] = [],
  count: number = 5
): Promise<string[]> {
  if (!context.trim()) throw new Error('Context cannot be empty');

  const existingNote = existingItems.length > 0
    ? `\n\nExisting items (do NOT repeat these):\n${existingItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`
    : '';

  try {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for a community project platform. Generate exactly ${count} concise, actionable bullet points. Return ONLY a JSON array of strings, nothing else. Example: ["Point one", "Point two"]`,
          },
          { role: 'user', content: `Generate ${count} bullet points for ${context}.${existingNote}` },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    const raw = data.choices[0].message.content.trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((s: any) => String(s).trim()).filter(Boolean);
    } catch {
      // Fallback: split by newlines and strip numbering
      return raw.split('\n')
        .map((line: string) => line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, count);
    }
    return [];
  } catch (error) {
    console.error('AI List Generation Error:', error);
    throw error;
  }
}

export async function makeTextLonger(text: string, paragraphs?: number): Promise<string> {
  if (!text.trim()) {
    throw new Error('Text cannot be empty');
  }

  const paraInstruction = paragraphs
    ? ` Write it as exactly ${paragraphs} paragraph${paragraphs > 1 ? 's' : ''}.`
    : '';

  try {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful writing assistant. Expand the text with more detail and explanation while staying on topic.${paraInstruction} Return only the expanded text.`,
          },
          { role: 'user', content: `Expand this text with more detail:\n\n${text}` },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI Text Service Error:', error);
    throw error;
  }
}
