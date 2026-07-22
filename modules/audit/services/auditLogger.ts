import api from "@/modules/core/api/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export function audit(
  action: AuditAction,
  entityName: string,
  entityId: string,
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null,
): void {
  api
    .post("/admin/audit/logs", {
      action,
      entity_name: entityName,
      entity_id: entityId,
      old_values: oldValues ? { ...oldValues, origen: "WEB" } : { origen: "WEB" },
      new_values: newValues ? { ...newValues, origen: "WEB" } : { origen: "WEB" },
    })
    .catch((error) => {
      console.error(
        "Error sending audit log:", 
        error?.response?.data ? JSON.stringify(error.response.data, null, 2) : error
      );
    });
}
