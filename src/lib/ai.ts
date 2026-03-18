// AI Text Service using ChatGPT
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function improveTextWithAI(text: string, context?: string): Promise<string> {
  if (!text.trim()) {
    throw new Error('Text cannot be empty');
  }

  const prompt = context
    ? `Improve the following text for ${context}. Keep the same meaning and tone, but make it clearer, more professional, and fix any grammar or spelling issues:\n\n${text}`
    : `Improve the following text. Keep the same meaning and tone, but make it clearer, more professional, and fix any grammar or spelling issues:\n\n${text}`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful writing assistant that improves text while preserving the author\'s voice and intent. Return only the improved text without explanations or additional commentary.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI Text Service Error:', error);
    throw error;
  }
}

export async function makeTextShorter(text: string): Promise<string> {
  if (!text.trim()) {
    throw new Error('Text cannot be empty');
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful writing assistant. Make the text more concise while preserving all key information. Return only the shortened text.',
          },
          {
            role: 'user',
            content: `Make this text shorter and more concise:\n\n${text}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI Text Service Error:', error);
    throw error;
  }
}

export async function makeTextLonger(text: string): Promise<string> {
  if (!text.trim()) {
    throw new Error('Text cannot be empty');
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful writing assistant. Expand the text with more detail and explanation while staying on topic. Return only the expanded text.',
          },
          {
            role: 'user',
            content: `Expand this text with more detail:\n\n${text}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI Text Service Error:', error);
    throw error;
  }
}
