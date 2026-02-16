export interface ActivityEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  agentId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}
