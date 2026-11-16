export type ExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting";

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: ExecutionStatus;
  startedAt?: string;
  finishedAt?: string;
}

export interface JsonRecord {
  [key: string]: unknown;
}
