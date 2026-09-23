import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminRole = "admin" | "super_admin";

export async function getAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authenticated: false, allowed: false, role: null as AdminRole | null, user: null };
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("role,account_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin role lookup error:", error);
    return { authenticated: true, allowed: false, role: null as AdminRole | null, user };
  }

  if (profile?.account_status === "suspended") {
    return { authenticated: true, allowed: false, role: null as AdminRole | null, user };
  }

  const role = profile?.role === "super_admin" || profile?.role === "admin"
    ? profile.role
    : null;

  return {
    authenticated: true,
    allowed: Boolean(role),
    role,
    user,
  };
}

export async function requireAdmin() {
  const access = await getAdminAccess();
  if (!access.authenticated) throw new Error("AUTHENTICATION_REQUIRED");
  if (!access.allowed) throw new Error("ADMIN_REQUIRED");
  return access;
}
