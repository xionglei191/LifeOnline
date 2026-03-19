import { callClaude, parseJSON } from './aiClient.js';
import { getEffectivePrompt } from './promptService.js';

export interface ClassifyResult {
  dimension: string;
  type: string;
  tags: string[];
  priority: string;
  title: string;
  reasoning: string;
}

export async function classifyNote(content: string): Promise<ClassifyResult> {
  const prompt = getEffectivePrompt('classify').replace('{content}', content);
  const response = await callClaude(prompt);
  const parsed = parseJSON<ClassifyResult | ClassifyResult[]>(response);
  // If AI returns an array, pick the first item (most relevant)
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  return {
    dimension: result.dimension || 'growth',
    type: result.type || 'note',
    tags: Array.isArray(result.tags) ? result.tags : [],
    priority: result.priority || 'medium',
    title: result.title || '',
    reasoning: result.reasoning || '',
  };
}
