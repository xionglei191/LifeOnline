import { callClaude, parseJSON } from './aiClient.js';
import { getEffectivePrompt } from './promptService.js';
import { getTodayDateString } from '../utils/date.js';

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
  const today = getTodayDateString();
  const prompt = getEffectivePrompt('extract_tasks')
    .replace('{content}', content)
    .replace('{today}', today);
  const response = await callClaude(prompt);
  const result = parseJSON<ExtractTasksResult>(response);
  return result.tasks || [];
}
