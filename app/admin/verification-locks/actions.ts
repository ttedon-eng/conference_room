"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const LOCKS_PAGE = "/admin/verification-locks";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(LOCKS_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(LOCKS_PAGE)}`);
  }

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    redirect(`${LOCKS_PAGE}?error=service_unavailable`);
  }

  return { supabase: serviceClient, userId: user.id };
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function writeAuditLog(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
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

export async function unlockSignupVerification(formData: FormData) {
  const verificationId = readValue(formData, "verification_id");

  if (!verificationId) {
    redirect(`${LOCKS_PAGE}?error=invalid`);
  }

  const { supabase, userId } = await requireAdmin();

  const { data: verification } = await supabase
    .from("signup_verifications")
    .select("id, email, failed_attempts, locked_at")
    .eq("id", verificationId)
    .maybeSingle();

  if (!verification) {
    redirect(`${LOCKS_PAGE}?error=missing`);
  }

  const { error } = await supabase
    .from("signup_verifications")
    .update({
      failed_attempts: 0,
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", verificationId);

  if (error) {
    redirect(`${LOCKS_PAGE}?error=unlock_failed`);
  }

  await writeAuditLog(supabase, {
    actorId: userId,
    action: "signup_verification_unlocked",
    entityType: "signup_verification",
    entityId: verificationId,
    details: {
      email: verification.email,
      previous_failed_attempts: verification.failed_attempts,
    },
  });

  revalidatePath(LOCKS_PAGE);
  redirect(LOCKS_PAGE);
}
