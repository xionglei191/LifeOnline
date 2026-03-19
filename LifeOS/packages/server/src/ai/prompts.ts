import type { PromptKey } from '@lifeos/shared';

export interface PromptRegistryItem {
  key: PromptKey;
  label: string;
  description: string;
  requiredPlaceholders: string[];
  defaultContent: string;
}

const CLASSIFY_PROMPT = `Parse the following markdown note and extract structured metadata. Return only valid JSON.

Note content:
{content}

Dimension options: health, career, finance, learning, relationship, life, hobby, growth
Type options: schedule, task, note, record, milestone, review
Priority options: high, medium, low

Return JSON only, no other text:
{
  "dimension": "career",
  "type": "note",
  "tags": ["tag1", "tag2"],
  "priority": "medium",
  "title": "short title",
  "reasoning": "one sentence reason"
}`;

const EXTRACT_TASKS_PROMPT = `Parse the following text and extract all action items and todos. Return only valid JSON.

Text:
{content}

Today's date: {today}

Look for: action verbs, deadlines, commitments, things to do.

Return JSON only, no other text:
{
  "tasks": [
    {
      "title": "task title",
      "due": "YYYY-MM-DD or null",
      "priority": "high|medium|low",
      "dimension": "health|career|finance|learning|relationship|life|hobby|growth"
    }
  ]
}`;

export const SUGGEST_PROMPT = `Analyze the following productivity data and generate actionable suggestions. Return only valid JSON.

Dashboard data:
{dashboardData}

Recent notes summary:
{recentNotes}

Return 2-3 suggestions as JSON only, no other text:
{
  "suggestions": [
    {
      "dimension": "health|career|finance|learning|relationship|life|hobby|growth",
      "title": "short title",
      "content": "specific suggestion under 30 words",
      "priority": "high|medium|low"
    }
  ]
}`;

const DAILY_REPORT_PROMPT = `你是一个个人生产力助手。根据以下今日统计数据，生成一份 150-200 字的中文每日回顾。

日期: {date}

各维度笔记数:
{dimensionStats}

今日完成任务数: {doneTasks}
今日新增笔记数: {totalNotes}
今日里程碑数: {milestones}

要求：
1. 用简洁的中文总结今天的工作和生活情况
2. 指出做得好的方面和需要改进的方面
3. 给出 1-2 条明天的建议
4. 语气温和鼓励，像一个贴心的助手

直接输出总结文本，不要输出 JSON 或 markdown 代码块。`;

const WEEKLY_REPORT_PROMPT = `你是一个个人生产力助手。根据以下本周统计数据，生成一份 150-200 字的中文每周回顾。

周期: {weekStart} ~ {weekEnd}

各维度笔记数:
{dimensionStats}

本周完成任务数: {doneTasks}
本周新增笔记数: {totalNotes}
本周里程碑数: {milestones}

要求：
1. 用简洁的中文总结本周的整体表现
2. 分析各维度的平衡情况
3. 指出本周亮点和不足
4. 给出下周的 2-3 条建议
5. 语气温和鼓励，像一个贴心的助手

直接输出总结文本，不要输出 JSON 或 markdown 代码块。`;

const SUMMARIZE_NOTE_PROMPT = `你是一个笔记摘要助手。请对以下笔记内容生成结构化摘要。

笔记标题: {title}
笔记内容:
{content}

语言: {language}
最大长度: {maxLength} 字

请返回 JSON 格式，不要输出其他内容:
{
  "title": "摘要标题（简短概括）",
  "summary": "摘要正文（{maxLength}字以内）",
  "keyPoints": ["要点1", "要点2", "要点3"]
}`;

export const PROMPT_REGISTRY: Record<PromptKey, PromptRegistryItem> = {
  classify: {
    key: 'classify',
    label: '笔记分类',
    description: '用于识别笔记维度、类型、优先级与标题。',
    requiredPlaceholders: ['{content}'],
    defaultContent: CLASSIFY_PROMPT,
  },
  extract_tasks: {
    key: 'extract_tasks',
    label: '任务提取',
    description: '用于从笔记正文中识别行动项和截止日期。',
    requiredPlaceholders: ['{content}', '{today}'],
    defaultContent: EXTRACT_TASKS_PROMPT,
  },
  summarize_note: {
    key: 'summarize_note',
    label: '笔记摘要',
    description: '用于生成结构化笔记摘要和要点。',
    requiredPlaceholders: ['{title}', '{content}', '{language}', '{maxLength}'],
    defaultContent: SUMMARIZE_NOTE_PROMPT,
  },
  daily_report: {
    key: 'daily_report',
    label: '每日报告',
    description: '用于基于当天统计生成中文每日回顾。',
    requiredPlaceholders: ['{date}', '{dimensionStats}', '{doneTasks}', '{totalNotes}', '{milestones}'],
    defaultContent: DAILY_REPORT_PROMPT,
  },
  weekly_report: {
    key: 'weekly_report',
    label: '每周报告',
    description: '用于基于周统计生成中文每周回顾。',
    requiredPlaceholders: ['{weekStart}', '{weekEnd}', '{dimensionStats}', '{doneTasks}', '{totalNotes}', '{milestones}'],
    defaultContent: WEEKLY_REPORT_PROMPT,
  },
};

export const PROMPT_KEYS = Object.keys(PROMPT_REGISTRY) as PromptKey[];

export function getPromptRegistryItem(key: PromptKey): PromptRegistryItem {
  return PROMPT_REGISTRY[key];
}
