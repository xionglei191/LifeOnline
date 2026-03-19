import type { WorkerTaskInputMap, WorkerTaskResultMap } from '@lifeos/shared';

// OpenClaw 是 LifeOS 按需调用的外部执行器：
// - 不持有编排主权
// - 不定义系统主数据模型
// - 只负责接收 LifeOS 派发的远程任务并返回结果
// 任务创建、状态流转、结果落盘仍由 LifeOS 控制。

const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL;
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY;
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENCLAW_TIMEOUT_MS || 30000);

export interface OpenClawError extends Error {
  statusCode?: number;
  code?: string;
}

function createOpenClawError(message: string, extras?: Partial<OpenClawError>): OpenClawError {
  const error = new Error(message) as OpenClawError;
  Object.assign(error, extras);
  return error;
}

function ensureConfigured(): string {
  if (!OPENCLAW_BASE_URL) {
    throw createOpenClawError('OpenClaw 未配置：缺少 OPENCLAW_BASE_URL', { code: 'OPENCLAW_NOT_CONFIGURED' });
  }
  return OPENCLAW_BASE_URL.replace(/\/$/, '');
}

interface CallOptions {
  signal?: AbortSignal;
}

async function callOpenClaw<T>(
  path: string,
  body: Record<string, unknown>,
  validate: (data: any) => T,
  options?: CallOptions,
): Promise<T> {
  const baseUrl = ensureConfigured();
  const controller = new AbortController();
  const externalSignal = options?.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortFromExternal, { once: true });
    }
  }
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(OPENCLAW_API_KEY ? { Authorization: `Bearer ${OPENCLAW_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw createOpenClawError(`OpenClaw 调用失败: ${response.status} ${errorText}`.trim(), {
        statusCode: response.status,
        code: 'OPENCLAW_HTTP_ERROR',
      });
    }

    const data = await response.json();
    return validate(data);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw createOpenClawError('任务已取消', { code: 'OPENCLAW_CANCELLED' });
      }
      throw createOpenClawError('OpenClaw 调用超时', { code: 'OPENCLAW_TIMEOUT' });
    }
    if (error?.code && String(error.code).startsWith('OPENCLAW_')) {
      throw error;
    }
    throw createOpenClawError(`OpenClaw 网络错误: ${error?.message || String(error)}`, { code: 'OPENCLAW_NETWORK_ERROR' });
  } finally {
    clearTimeout(timeout);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortFromExternal);
    }
  }
}

function validateOpenClawTaskResult(value: any): WorkerTaskResultMap['openclaw_task'] {
  if (!value || typeof value !== 'object') {
    throw createOpenClawError('OpenClaw 返回空结果', { code: 'OPENCLAW_INVALID_RESULT' });
  }
  if (typeof value.title !== 'string' || !value.title.trim()) {
    throw createOpenClawError('OpenClaw 返回缺少 title', { code: 'OPENCLAW_INVALID_RESULT' });
  }
  if (typeof value.summary !== 'string' || !value.summary.trim()) {
    throw createOpenClawError('OpenClaw 返回缺少 summary', { code: 'OPENCLAW_INVALID_RESULT' });
  }
  if (typeof value.content !== 'string') {
    throw createOpenClawError('OpenClaw 返回缺少 content', { code: 'OPENCLAW_INVALID_RESULT' });
  }

  return {
    title: value.title.trim(),
    summary: value.summary.trim(),
    content: value.content,
  };
}

export async function runOpenClawTask(
  input: WorkerTaskInputMap['openclaw_task'],
  options?: CallOptions,
): Promise<WorkerTaskResultMap['openclaw_task']> {
  return callOpenClaw(
    '/tasks/execute',
    {
      instruction: input.instruction,
      outputDimension: input.outputDimension,
    },
    validateOpenClawTaskResult,
    options,
  );
}
