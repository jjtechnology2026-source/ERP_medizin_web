export interface AuditLogEntry {
  id: string;
  action: string;
  entityName: string;
  entityId: string;
  userId: string;
  timestamp: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  actorName?: string | null;
  userAgent?: string | null;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogFilters {
  action?: string;
  entityName?: string;
  entityId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}
