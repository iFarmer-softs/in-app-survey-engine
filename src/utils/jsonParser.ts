/**
 * Resilient JSON Parser for survey schemas.
 * Handles:
 * - Markdown code fences (```json ... ``` or ``` ... ```)
 * - Leading/trailing markdown or text surrounding JSON
 * - Unescaped control characters in string literals (raw newlines, carriage returns, tabs)
 * - Single-line (//) and multi-line (/* ... *\/) comments
 * - Trailing commas in objects and arrays
 * - Normalization to standard JSON
 */

export function safeParseJson(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Please provide JSON text to import.');
  }

  let text = raw.trim();

  // 1. Extract markdown code block if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  } else if (text.startsWith('```')) {
    text = text.replace(/^```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
  }

  // 2. Try native JSON.parse first for clean payloads
  try {
    return JSON.parse(text);
  } catch {
    // If standard JSON.parse fails, proceed to resilient sanitization
  }

  // 3. Resilient state machine to clean comments, escape control characters inside string literals,
  // and preserve valid structure
  let sanitized = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = i < text.length - 1 ? text[i + 1] : '';

    if (inString) {
      if (isEscaped) {
        sanitized += char;
        isEscaped = false;
      } else if (char === '\\') {
        sanitized += char;
        isEscaped = true;
      } else if (char === '"') {
        sanitized += char;
        inString = false;
      } else if (char === '\n') {
        // Unescaped newline inside string -> escape as \n
        sanitized += '\\n';
      } else if (char === '\r') {
        // Strip carriage return inside string
      } else if (char === '\t') {
        // Unescaped tab inside string -> escape as \t
        sanitized += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        // Control character inside string literal -> escape as \uXXXX
        sanitized += '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
      } else {
        sanitized += char;
      }
    } else {
      // Outside string
      if (char === '"') {
        sanitized += char;
        inString = true;
      } else if (char === '/' && next === '/') {
        // Single line comment: skip until newline
        while (i < text.length && text[i] !== '\n') {
          i++;
        }
        sanitized += '\n';
      } else if (char === '/' && next === '*') {
        // Multi line comment: skip until */
        i += 2;
        while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) {
          i++;
        }
        i++; // skip /
      } else {
        sanitized += char;
      }
    }
  }

  // Remove trailing commas before } or ]
  sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');

  // 4. Try parsing sanitized string
  try {
    return JSON.parse(sanitized);
  } catch (cleanErr: any) {
    // 5. If still failing, attempt boundary extraction for { ... } or [ ... ]
    const firstBrace = sanitized.indexOf('{');
    const firstBracket = sanitized.indexOf('[');
    let startIdx = -1;
    let endChar = '';

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endChar = '}';
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      endChar = ']';
    }

    if (startIdx !== -1) {
      const lastIdx = sanitized.lastIndexOf(endChar);
      if (lastIdx > startIdx) {
        const sliced = sanitized.slice(startIdx, lastIdx + 1);
        try {
          return JSON.parse(sliced);
        } catch {
          // Fall through
        }
      }
    }

    throw new Error(
      `Invalid JSON syntax: ${cleanErr.message || 'Please verify the JSON formatting'}`
    );
  }
}
