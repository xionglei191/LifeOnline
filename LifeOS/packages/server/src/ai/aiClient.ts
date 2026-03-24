import { getEffectiveAiProviderConfig } from './providerConfigService.js';
import { logAiUsage } from './usageTracker.js';

export interface ClaudeResponseWithUsage {
  text: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Underlying API call that returns the response text along with token usage metrics.
 * Automatically logs token consumption for cost tracking.
 */
export async function callClaudeWithUsage(prompt: string, maxTokens = 1024): Promise<ClaudeResponseWithUsage> {
  const config = getEffectiveAiProviderConfig();
  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const block = data.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude');

  // Track token usage mapping Anthropic response structure
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;
  logAiUsage(config.model, inputTokens, outputTokens);

  return {
    text: block.text,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    }
  };
}

/**
 * Backwards-compatible text-only response for general AI queries.
 */
export async function callClaude(prompt: string, maxTokens = 1024): Promise<string> {
  const result = await callClaudeWithUsage(prompt, maxTokens);
  return result.text;
}

export function parseJSON<T>(text: string): T {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned) as T;
}
