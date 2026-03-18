/**
 * AI Input Sanitization
 * Protects AI chat wizards from prompt injection and abuse.
 */

/** Maximum characters allowed in a single user message. */
export const MAX_USER_MESSAGE_LENGTH = 2000;

/** Maximum characters for URL-param strings inserted into system prompts. */
const MAX_PARAM_LENGTH = 120;

/**
 * Known prompt-injection phrases (case-insensitive).
 * Matching any of these in user input flags the message for blocking.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /forget\s+(your|all|the)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|prior|your)\s+instructions?/i,
  /you\s+are\s+now\s+(a|an|going\s+to)/i,
  /act\s+as\s+(if\s+you\s+are|a\s+new|an?\s+)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /new\s+instructions?:/i,
  /override\s+(system|the\s+system)\s+prompt/i,
  /system\s+prompt/i,
  /developer\s+mode/i,
  /jailbreak/i,
  /\[?DAN\]?/,                                  // "Do Anything Now" jailbreak
  /do\s+anything\s+now/i,
  /<\s*\/?(?:script|iframe|object|embed)/i,      // HTML injection
  /\$\{.*?\}/,                                   // template literal injection
  /\{\{.*?\}\}/,                                 // Handlebars / Jinja injection
  /```\s*system/i,                               // markdown-wrapped system block
];

export interface SanitizeResult {
  /** The cleaned text to send (may be truncated). */
  text: string;
  /** Whether the message was blocked entirely. */
  blocked: boolean;
  /** Human-readable reason for blocking, if any. */
  reason?: string;
}

/**
 * Sanitizes a user chat message before forwarding it to the AI API.
 *
 * - Strips null bytes and control characters.
 * - Enforces a maximum length.
 * - Detects and blocks known prompt-injection patterns.
 *
 * Returns the cleaned text and a `blocked` flag.
 * If `blocked` is true, do NOT send the message; show `reason` to the user.
 */
export function sanitizeUserMessage(raw: string): SanitizeResult {
  // 1. Strip null bytes and non-printable control characters (keep tabs/newlines)
  let text = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Enforce length cap
  if (text.length > MAX_USER_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_USER_MESSAGE_LENGTH);
  }

  // 3. Detect injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        text: '',
        blocked: true,
        reason:
          "I can't process that message as it looks like an attempt to override the assistant's instructions. Please describe your ministry or project in your own words.",
      };
    }
  }

  return { text: text.trim(), blocked: false };
}

/**
 * Sanitizes a URL query-parameter value that will be interpolated
 * directly into a system prompt (e.g. `orgName`).
 *
 * - Keeps only printable ASCII / common Unicode letters, digits, spaces,
 *   hyphens, apostrophes, and periods — characters a legitimate org name
 *   would contain.
 * - Truncates to MAX_PARAM_LENGTH.
 * - If the raw value itself contains injection patterns, returns a safe
 *   placeholder instead.
 */
export function sanitizePromptParam(raw: string): string {
  // Block injection in params too
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(raw)) {
      return '[unknown organization]';
    }
  }

  // Strip characters that could break prompt formatting
  // Allow letters (Unicode), digits, spaces, basic punctuation for names
  let sanitized = raw.replace(/[`"\\<>{}[\]$]/g, '');

  // Truncate
  if (sanitized.length > MAX_PARAM_LENGTH) {
    sanitized = sanitized.slice(0, MAX_PARAM_LENGTH).trim();
  }

  return sanitized || '[unknown organization]';
}
