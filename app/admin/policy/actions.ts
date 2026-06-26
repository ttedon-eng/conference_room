"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const POLICY_PAGE = "/admin/policy";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(POLICY_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(POLICY_PAGE)}`);
  }

  return { supabase, userId: user.id };
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateWeeklyLimit(formData: FormData) {
  const limitValue = readValue(formData, "weekly_booking_limit_minutes");
  const limit = Number(limitValue);

  if (!Number.isFinite(limit) || limit <= 0) {
    redirect(`${POLICY_PAGE}?error=invalid`);
  }

  const { supabase, userId } = await requireAdmin();

  const { data: updatedRow, error } = await supabase
    .from("booking_settings")
    .update({ weekly_booking_limit_minutes: Math.floor(limit) })
    .eq("id", 1)
    .select("weekly_booking_limit_minutes")
    .maybeSingle();

  if (error || !updatedRow) {
    redirect(`${POLICY_PAGE}?error=update_failed`);
  }

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "booking_policy_updated",
    entity_type: "booking_settings",
    entity_id: null,
    details: {
      weekly_booking_limit_minutes: updatedRow.weekly_booking_limit_minutes,
    },
  });

  revalidatePath(POLICY_PAGE);
  redirect(POLICY_PAGE);
}
