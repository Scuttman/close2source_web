import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side OpenAI proxy.
 * The API key lives in OPENAI_API_KEY (no NEXT_PUBLIC_ prefix) and is
 * never sent to the browser — only the /api/ai route has access to it.
 *
 * Supports both regular JSON responses and server-sent event (SSE)
 * streaming responses (when the request body includes `stream: true`).
 *
 * All AI components should POST to /api/ai with the standard OpenAI
 * chat-completions payload shape:
 *   { model, messages, temperature?, max_tokens?, stream?, response_format? }
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'AI service is not configured on this server.' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    // Only forward safe, known fields — never allow arbitrary overrides
    const { model, messages, temperature, max_tokens, stream, response_format } = body;

    if (!model || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const upstream = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens, stream, response_format }),
    });

    if (!upstream.ok) {
      const errorBody = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'AI request failed.', details: errorBody },
        { status: upstream.status }
      );
    }

    // For streaming responses, proxy the SSE body directly back to the client
    if (stream && upstream.body) {
      return new Response(upstream.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[/api/ai] error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
