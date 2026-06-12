import { useAuthStore } from "@/modules/auth/store/useAuthStore";

export const usePermissions = () => {
  const profile = useAuthStore((state: any) => state.profile);
  const permits = profile?.permits || [];

  // Role flags (Case-insensitive)
  const userRole = profile?.role?.toLowerCase();
  const isSuperAdmin = userRole === "superadmin";
  const isAdminRole = userRole === "admin";

  console.log("[usePermissions] Initial Flags:", {
    role: profile?.role,
    isSuperAdmin,
    isAdminRole,
    permits: permits,
  });

  const hasAdminPermit = permits.some(
    (p: string) => p.toLowerCase() === "admin",
  );
  const hasAdministrativoPermit = permits.some(
    (p: string) => p.toLowerCase() === "administrativo",
  );
  const hasContablePermit = permits.some(
    (p: string) => p.toLowerCase() === "contable",
  );
  const hasGestionPermit = permits.some(
    (p: string) => p.toLowerCase() === "gestion",
  );

  // El usuario puede CREAR si es Admin o Administrativo
  const canCreateInAccounting =
    isSuperAdmin || isAdminRole || hasAdminPermit || hasAdministrativoPermit;

  // El usuario es SOLO LECTURA si tiene permit contable y NO tiene permisos de creación
  const isReadOnly = hasContablePermit && !canCreateInAccounting;

  // Solo Admin y Administrativo pueden cambiar de vista
  const canToggleView = canCreateInAccounting || hasGestionPermit;

  // Solo Admin puede gestionar usuarios
  const canManageUsers = isSuperAdmin || isAdminRole || hasAdminPermit;

  // Lógica de visibilidad de tabs en el Navbar
  const showGestionTab =
    isSuperAdmin || isAdminRole || hasAdminPermit || hasGestionPermit;
  const showAdminTab =
    isSuperAdmin || isAdminRole || hasAdminPermit || hasAdministrativoPermit;
  const showSeniatTab =
    isSuperAdmin ||
    isAdminRole ||
    hasAdminPermit ||
    permits.some((p: string) => p.toLowerCase() === "seniat");

  // El tab contable se muestra para quienes tienen el permiso contable
  const showContableTab = hasContablePermit;

  const flags = {
    permits,
    isSuperAdmin,
    isAdmin: isAdminRole || hasAdminPermit,
    isReadOnly,
    canCreateInAccounting,
    canToggleView,
    canManageUsers,
    showGestionTab,
    showAdminTab,
    showContableTab,
    showSeniatTab,
  };

  console.log("[usePermissions] Calculated Flags:", flags);

  return flags;
};
