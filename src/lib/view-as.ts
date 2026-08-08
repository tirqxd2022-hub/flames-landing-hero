/**
 * "View as" role simulation for the super admin.
 *
 * The super admin can preview the storefront as any staff role; the selected
 * role's page permissions are fetched from the backend role settings and used
 * to gate the user-icon dropdown.
 */
import { useEffect, useState } from "react";
import { adminApi, type AdminRole } from "@/lib/api";

export const VIEW_AS_KEY = "flames_view_as_role";
export const SUPER = "super";

const EVENT = "flames-view-as-change";

type RoleMap = Record<string, { permissions: string[] }>;
let rolesCache: RoleMap | null = null;
let rolesPending: Promise<RoleMap> | null = null;

function loadRoles(): Promise<RoleMap> {
  rolesPending ??= adminApi
    .getRolePermissions()
    .then((r) => (rolesCache = r.items as RoleMap))
    .catch(() => (rolesCache = {}));
  return rolesPending;
}

export function getViewAsRole(): string {
  if (typeof window === "undefined") return SUPER;
  return window.localStorage.getItem(VIEW_AS_KEY) || SUPER;
}

export function setViewAsRole(role: string) {
  if (typeof window === "undefined") return;
  if (role === SUPER) window.localStorage.removeItem(VIEW_AS_KEY);
  else window.localStorage.setItem(VIEW_AS_KEY, role);
  window.dispatchEvent(new Event(EVENT));
}

/**
 * @param enabled only the super admin may simulate roles.
 * Returns the selected role, the available roles and the simulated permissions
 * (null when viewing as super admin, i.e. full access).
 */
export function useViewAs(enabled: boolean) {
  const [role, setRole] = useState<string>(() => (enabled ? getViewAsRole() : SUPER));
  const [roles, setRoles] = useState<RoleMap>(() => rolesCache ?? {});

  useEffect(() => {
    if (!enabled) return;
    const sync = () => setRole(getViewAsRole());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    void loadRoles().then((m) => setRoles({ ...m }));
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [enabled]);

  const simulating = enabled && role !== SUPER;
  return {
    role: enabled ? role : SUPER,
    simulating,
    roleOptions: [SUPER, ...Object.keys(roles).filter((r) => r !== SUPER)] as (AdminRole | string)[],
    permissions: simulating ? (roles[role]?.permissions ?? []) : null,
    setRole: setViewAsRole,
  };
}
