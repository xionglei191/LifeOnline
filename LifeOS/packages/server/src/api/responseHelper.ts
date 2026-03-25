import type { Response } from 'express';
import type { ApiResponse } from '@lifeos/shared';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const payload: ApiResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(payload);
}

export function sendError(res: Response, error: string, statusCode = 500): void {
  const payload: ApiResponse<never> = {
    success: false,
    error,
  };
  res.status(statusCode).json(payload);
}
