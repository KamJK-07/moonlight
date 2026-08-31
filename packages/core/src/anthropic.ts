/**
 * A minimal Anthropic Messages API client — this is what actually backs
 * "Ask Claude to riff" in the Creative Hub. It's deliberately small: one
 * endpoint, one call shape. Callers are expected to run this from a
 * process that isn't subject to browser CORS (Electron's main process,
 * a React Native app's JS runtime) since the API key should never be
 * exposed to a web page context.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Deliberately not pinned to one hardcoded snapshot: model names age out
 * over time, and re-checking Anthropic's docs beats silently calling a
 * retired model. This default is a reasonable starting point as of this
 * writing — treat it as a setting to revisit, not a fixed constant.
 */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';

export class AnthropicApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Anthropic API error ${status}: ${body.slice(0, 200)}`);
    this.name = 'AnthropicApiError';
  }
}

interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

interface MessagesResponse {
  content: Array<{ type: string; text?: string }>;
}

export interface CompleteOptions {
  system?: string;
  maxTokens?: number;
  model?: string;
}

export class AnthropicClient {
  constructor(
    private apiKey: string,
    private fetchImpl: FetchLike = globalThis.fetch,
  ) {
    if (!this.fetchImpl) {
      throw new Error('No fetch implementation available on this platform.');
    }
  }

  async complete(prompt: string, opts?: CompleteOptions): Promise<string> {
    const res = await this.fetchImpl(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: opts?.model ?? DEFAULT_ANTHROPIC_MODEL,
        max_tokens: opts?.maxTokens ?? 300,
        system: opts?.system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AnthropicApiError(res.status, body);
    }
    const data = (await res.json()) as MessagesResponse;
    const textBlock = data.content.find((b) => b.type === 'text');
    return textBlock?.text ?? '';
  }
}

/** The exact prompt shape used by the Creative Hub's "riff" button. */
export function buildRiffPrompt(ideaText: string, tag: string | null): string {
  return (
    `A user is capturing a short creative idea in their personal idea board. ` +
    `Idea: "${ideaText}"${tag ? ` (tag: ${tag})` : ''}. ` +
    `In 2-3 sentences, riff on it: offer a sharper angle, a concrete next step, or a question ` +
    `that pushes it forward. No preamble, no restating the idea back.`
  );
}
