/**
 * PhysicalAction Types — defines the structure for real-world actions
 * that the system can execute on behalf of the user.
 */

// ---------------------------------------------------------------------------
// Type Enums
// ---------------------------------------------------------------------------

export const SUPPORTED_PHYSICAL_ACTION_TYPES = [
  'calendar_event',
  'send_email',
  'webhook_call',
  'iot_command',
] as const;
export type PhysicalActionType = typeof SUPPORTED_PHYSICAL_ACTION_TYPES[number];

export const SUPPORTED_PHYSICAL_ACTION_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'executing',
  'completed',
  'failed',
] as const;
export type PhysicalActionStatus = typeof SUPPORTED_PHYSICAL_ACTION_STATUSES[number];

export const SUPPORTED_APPROVAL_POLICIES = [
  'always_ask',
  'auto_after_first',
  'auto_approve',
] as const;
export type ApprovalPolicy = typeof SUPPORTED_APPROVAL_POLICIES[number];

// ---------------------------------------------------------------------------
// Payload Interfaces
// ---------------------------------------------------------------------------

export interface CalendarEventPayload {
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
}

export interface WebhookCallPayload {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

export interface IoTCommandPayload {
  deviceId: string;
  command: string;
  parameters?: Record<string, unknown>;
}

export type PhysicalActionPayload =
  | CalendarEventPayload
  | SendEmailPayload
  | WebhookCallPayload
  | IoTCommandPayload;

// ---------------------------------------------------------------------------
// Core Interface
// ---------------------------------------------------------------------------

export interface PhysicalAction {
  id: string;
  type: PhysicalActionType;
  status: PhysicalActionStatus;

  // Origin
  sourceSoulActionId: string | null;
  sourceNoteId: string | null;

  // What to do
  title: string;
  description: string;
  payload: PhysicalActionPayload;

  // Approval
  approvalPolicy: ApprovalPolicy;
  autoApproveKey: string | null;

  // Execution
  executionLog: string | null;
  externalId: string | null;
  errorMessage: string | null;
  dryRunPreview: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  executedAt: string | null;
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface ListPhysicalActionsResponse {
  actions: PhysicalAction[];
  total: number;
}

export interface PhysicalActionResponse {
  action: PhysicalAction;
}

export interface IntegrationStatus {
  provider: string;
  connected: boolean;
  lastSyncAt: string | null;
}

export interface ListIntegrationsResponse {
  integrations: IntegrationStatus[];
}
