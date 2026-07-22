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
      origen: "WEB",
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
    })
    .catch((error) => {
      console.error("Error sending audit log:", error);
    });
}
