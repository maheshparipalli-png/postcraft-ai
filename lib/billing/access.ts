import { createClient } from "@/lib/supabase/server";

export type BillingAccessStatus =
  | "not_started"
  | "trialing"
  | "active"
  | "expired"
  | "cancelled"
  | "past_due"
  | "billing_unavailable";

export type BillingSubscription = Record<string, unknown> & {
  status: BillingAccessStatus;
  trial_ends_at?: string | null;
};

export async function getBillingAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authenticated: false,
      allowed: false,
      status: "not_started" as const,
      user: null,
      subscription: null,
    };
  }

  const { data: subscription, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Billing access lookup error:", error);
    return {
      authenticated: true,
      allowed: false,
      status: "billing_unavailable" as const,
      user,
      subscription: null,
    };
  }

  if (!subscription) {
    return {
      authenticated: true,
      allowed: false,
      status: "not_started" as const,
      user,
      subscription: null,
    };
  }

  if (subscription.status === "trialing") {
    const trialEndsAt = subscription.trial_ends_at
      ? new Date(subscription.trial_ends_at).getTime()
      : NaN;

    if (Number.isFinite(trialEndsAt) && trialEndsAt > Date.now()) {
      return {
        authenticated: true,
        allowed: true,
        status: "trialing" as const,
        user,
        subscription: subscription as BillingSubscription,
      };
    }

    return {
      authenticated: true,
      allowed: false,
      status: "expired" as const,
      user,
      subscription: subscription as BillingSubscription,
    };
  }

  const status = subscription.status as BillingAccessStatus;

  return {
    authenticated: true,
    allowed: status === "active",
    status,
    user,
    subscription: subscription as BillingSubscription,
  };
}
