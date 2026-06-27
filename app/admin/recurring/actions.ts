"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const RECURRING_PAGE = "/admin/recurring";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(RECURRING_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(RECURRING_PAGE)}`);
  }

  return { supabase, userId: user.id };
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function writeAuditLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_logs").insert({
    actor_id: payload.actorId,
    action: payload.action,
    entity_type: payload.entityType,
    entity_id: payload.entityId ?? null,
    details: payload.details ?? {},
  });
}

export async function cancelRecurringSeries(formData: FormData) {
  const seriesId = readValue(formData, "series_id");

  if (!seriesId) {
    redirect(`${RECURRING_PAGE}?error=invalid`);
  }

  const { supabase, userId } = await requireAdmin();

  const { data: series } = await supabase
    .from("booking_series")
    .select("id, title, room_id, repeat_count, status")
    .eq("id", seriesId)
    .maybeSingle();

  const { error } = await supabase.rpc("cancel_booking_series", {
    p_series_id: seriesId,
  });

  if (error) {
    redirect(`${RECURRING_PAGE}?error=cancel_failed`);
  }

  await writeAuditLog(supabase, {
    actorId: userId,
    action: "booking_series_cancelled",
    entityType: "booking_series",
    entityId: seriesId,
    details: {
      title: series?.title ?? null,
      room_id: series?.room_id ?? null,
      repeat_count: series?.repeat_count ?? null,
      previous_status: series?.status ?? null,
    },
  });

  revalidatePath(RECURRING_PAGE);
  redirect(RECURRING_PAGE);
}
