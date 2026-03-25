import { callClaude, parseJSON } from '../ai/aiClient.js';
import type { PhysicalActionPayload, PhysicalActionType, PhysicalActionStep } from '@lifeos/shared';
import { Logger } from '../utils/logger.js';

const logger = new Logger('physicalActionMapper');

const MAPPER_PROMPT = `你是一个 PhysicalAction 意图解析器。负责将自然语言中的"真实世界操作意愿"转换为结构化的接口 Payload。
当前支持的操作类型 (PhysicalActionType)：
- "calendar_event": 在日历上创建一个日程安排
- "send_email": 发送一封邮件
- "webhook_call": 调用一个外部的Webhook URL

你必须提取出所需要的信息，并严格以 JSON 格式返回。

JSON 格式要求：
{
  "type": "calendar_event" 或 "send_email" 或 "webhook_call",
  "payload": {
     // 取决于 type
  }
}

如果 type 为 "calendar_event"，payload 格式必须为：
{
  "title": "事件名称",
  "startTime": "ISO 8601格式时间，例如 2026-03-25T14:00:00+08:00",
  "endTime": "ISO 8601格式时间，例如 2026-03-25T15:00:00+08:00",
  "location": "地点（可选）",
  "description": "描述（可选）"
}

如果 type 为 "send_email"，payload 格式必须为：
{
  "to": "收件人邮箱",
  "subject": "邮件标题",
  "body": "正文内容"
}

如果 type 为 "webhook_call"，payload 格式必须为：
{
  "url": "调用的 url",
  "method": "POST/GET/PUT",
  "body": {}
}

注意事项：
现在时间是：{CURRENT_TIME}。请基于这个时间推断“明天”、“下周”、“下午”等相对时间概念。
如果没有说明 endTime，通常默认持续1个小时。
不要返回 markdown 代码块，只返回纯 JSON。

如果用户的意图包含多个有依赖顺序的步骤（如：先查日程再创建日历最后发邮件），则返回 steps 数组格式：
{
  "steps": [
    {
      "type": "calendar_event",
      "title": "步骤标题",
      "payload": { ... },
      "dependsOn": []
    },
    {
      "type": "send_email",
      "title": "步骤标题",
      "payload": { ... },
      "dependsOn": ["0"]
    }
  ]
}

如果只是单步操作，使用原来的格式即可（无需 steps 包裹）。
`;

export type MapperResult =
  | { kind: 'single'; type: PhysicalActionType; payload: PhysicalActionPayload }
  | { kind: 'multi'; steps: PhysicalActionStep[] };

export async function mapSoulActionToPhysicalAction(
  reasonOrContent: string
): Promise<MapperResult | null> {
  const currentTime = new Date().toISOString();
  const prompt = MAPPER_PROMPT.replace('{CURRENT_TIME}', currentTime) +
                 `\n待转换的指令内容: "${reasonOrContent}"`;

  try {
    const resString = await callClaude(prompt, 1500);
    const parsed = parseJSON(resString) as Record<string, unknown> | null;

    if (!parsed) {
      logger.error('Invalid mapper response format:', resString);
      return null;
    }

    // Multi-step response
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      const steps: PhysicalActionStep[] = parsed.steps.map((s: any) => ({
        type: s.type,
        payload: s.payload,
        title: s.title || `步骤: ${s.type}`,
        dependsOn: s.dependsOn ?? [],
      }));
      logger.info(`Mapper returned multi-step (${steps.length} steps)`);
      return { kind: 'multi', steps };
    }

    // Single-step response
    if (!parsed.type || !parsed.payload) {
      logger.error('Invalid mapper response format:', resString);
      return null;
    }

    // Quick validation for calendar
    if (parsed.type === 'calendar_event') {
      const p = parsed.payload as Record<string, unknown>;
      if (!p.title || !p.startTime || !p.endTime) {
         logger.error('Missing required calendar fields', p);
         return null;
      }
    }

    return { 
      kind: 'single', 
      type: parsed.type as PhysicalActionType, 
      payload: parsed.payload as PhysicalActionPayload 
    };
  } catch (error) {
    logger.error('Failed to map physical action:', error);
    return null;
  }
}
