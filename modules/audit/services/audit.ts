import { AuditLogEntry, AuditLogFilters } from "../types";

export const AuditService = {
  buildParams(filters: AuditLogFilters, page: number, limit: number) {
    const params: Record<string, unknown> = {
      action: filters.action || undefined,
      entity_name: filters.entityName || undefined,
      entity_id: filters.entityId || undefined,
      user_id: filters.userId || undefined,
      limit,
      offset: (page - 1) * limit,
    };

    if (filters.startDate) {
      params.start_date = new Date(filters.startDate).toISOString();
    }
    if (filters.endDate) {
      params.end_date = new Date(filters.endDate).toISOString();
    }

    return params;
  },

  normalizeAuditEntry(apiEntry: any): AuditLogEntry {
    return {
      id: apiEntry.id,
      action: apiEntry.action,
      entityName: apiEntry.entity_name ?? apiEntry.entityName,
      entityId: apiEntry.entity_id ?? apiEntry.entityId,
      userId: apiEntry.user_id ?? apiEntry.userId,
      timestamp: apiEntry.timestamp,
      oldValues: apiEntry.old_values ?? apiEntry.oldValues,
      newValues: apiEntry.new_values ?? apiEntry.newValues,
      ipAddress: apiEntry.ip_address ?? apiEntry.ipAddress,
      actorName: apiEntry.actor_name ?? apiEntry.actorName,
      userAgent: apiEntry.user_agent ?? apiEntry.userAgent,
    };
  },
};
