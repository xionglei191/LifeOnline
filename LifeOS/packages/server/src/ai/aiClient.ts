import { getEffectiveAiProviderConfig } from './providerConfigService.js';
import { logAiUsage } from './usageTracker.js';

class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;
  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  release() {
    this.active--;
    if (this.queue.length > 0) {
      this.active++;
      const next = this.queue.shift()!;
      next();
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

const testAiSemaphore = new Semaphore(3);

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
  // Intercept for test environment using OpenAI-compatible payload
  if (process.env.TEST_AI_URL && process.env.TEST_AI_KEY) {
    return testAiSemaphore.run(async () => {
      const model = process.env.TEST_AI_MODEL || 'gpt-5.4';
      const response = await fetch(process.env.TEST_AI_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TEST_AI_KEY}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Test API error: ${response.status} ${error}`);
      }
      
      const data = await response.json();
      const text = data.choices[0]?.message?.content;
      if (typeof text !== 'string') throw new Error('Unexpected response type from Test AI');

      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      logAiUsage(model, inputTokens, outputTokens);
      
      return {
        text,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        }
      };
    });
  }

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
