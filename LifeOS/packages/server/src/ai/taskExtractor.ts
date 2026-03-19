import { callClaude, parseJSON } from './aiClient.js';
import { getEffectivePrompt } from './promptService.js';

export interface ExtractedTask {
  title: string;
  due: string | null;
  priority: string;
  dimension: string;
}

export interface ExtractTasksResult {
  tasks: ExtractedTask[];
}

export async function extractTasks(content: string): Promise<ExtractedTask[]> {
  const today = new Date().toISOString().split('T')[0];
  const prompt = getEffectivePrompt('extract_tasks')
    .replace('{content}', content)
    .replace('{today}', today);
  const response = await callClaude(prompt);
  const result = parseJSON<ExtractTasksResult>(response);
  return result.tasks || [];
}
