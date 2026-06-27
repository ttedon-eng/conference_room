"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordEmailDelivery, sendEmailMessage } from "@/lib/email-delivery";
import { createClient } from "@/lib/supabase/server";

const APPROVAL_PAGE = "/admin/approvals";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "user" | "admin";
  is_approved: boolean;
  rejection_reason: string | null;
};

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(APPROVAL_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(
      profile?.is_approved
        ? "/account"
        : `/pending?next=${encodeURIComponent(APPROVAL_PAGE)}`,
    );
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

function formatRejectionEmail(profile: ProfileRow, reason: string) {
  const displayName = profile.full_name?.trim() || profile.email;

  return [
    `${displayName}님 안녕하세요.`,
    "",
    "관리자 검토 결과, 현재 가입이 승인되지 않았습니다.",
    `사유: ${reason}`,
    "",
    "추후 다시 신청해 주실 수 있습니다.",
    "감사합니다.",
  ].join("\n");
}

async function recordApprovalEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    actorId: string;
    recipient: ProfileRow;
    subject: string;
    body: string;
    reason: string;
    status: "success" | "failure";
    providerResponse?: Record<string, unknown>;
    errorMessage?: string | null;
  },
) {
  await recordEmailDelivery(supabase, {
    bookingId: null,
    notificationType: "profile_rejected",
    actorId: payload.actorId,
    recipientUserId: payload.recipient.id,
    recipientEmail: payload.recipient.email,
    subject: payload.subject,
    body: payload.body,
    status: payload.status,
    providerName: "resend",
    providerMessageId:
      typeof payload.providerResponse?.id === "string" ? payload.providerResponse.id : null,
    providerResponse: payload.providerResponse,
    errorMessage: payload.errorMessage ?? null,
    payload: {
      profile_id: payload.recipient.id,
      profile_email: payload.recipient.email,
      profile_name: payload.recipient.full_name,
      reason: payload.reason,
    },
  });
}

export async function approveProfile(formData: FormData) {
  const profileIdValue = formData.get("profile_id");

  if (typeof profileIdValue !== "string" || !profileIdValue.trim()) {
    redirect(`${APPROVAL_PAGE}?error=invalid`);
  }

  const profileId = profileIdValue.trim();
  const { supabase, userId } = await requireAdmin();

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      is_approved: true,
      approved_at: new Date().toISOString(),
      approved_by: userId,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
    })
    .eq("id", profileId)
    .eq("role", "user")
    .eq("is_approved", false)
    .select("id")
    .maybeSingle();

  if (error || !updatedProfile) {
    redirect(`${APPROVAL_PAGE}?error=approve_failed`);
  }

  await writeAuditLog(supabase, {
    actorId: userId,
    action: "profile_approved",
    entityType: "profile",
    entityId: profileId,
    details: {
      approved_by: userId,
    },
  });

  revalidatePath(APPROVAL_PAGE);
  redirect(APPROVAL_PAGE);
}

export async function rejectProfile(formData: FormData) {
  const profileIdValue = formData.get("profile_id");
  const reason = readValue(formData, "rejection_reason") || "관리자 검토 결과 현재 승인되지 않았습니다.";

  if (typeof profileIdValue !== "string" || !profileIdValue.trim()) {
    redirect(`${APPROVAL_PAGE}?error=invalid`);
  }

  const profileId = profileIdValue.trim();
  const { supabase, userId } = await requireAdmin();

  const { data: targetProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_approved, rejection_reason")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !targetProfile || targetProfile.role !== "user") {
    redirect(`${APPROVAL_PAGE}?error=reject_failed`);
  }

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      is_approved: false,
      approved_at: null,
      approved_by: null,
      rejected_at: new Date().toISOString(),
      rejected_by: userId,
      rejection_reason: reason,
    })
    .eq("id", profileId)
    .eq("role", "user")
    .select("id")
    .maybeSingle();

  if (error || !updatedProfile) {
    redirect(`${APPROVAL_PAGE}?error=reject_failed`);
  }

  const subject = "[회의실 예약] 관리자 검토 결과 안내";
  const body = formatRejectionEmail(targetProfile, reason);
  let emailFailed = false;

  try {
    const providerResponse = await sendEmailMessage({
      to: targetProfile.email,
      subject,
      body,
    });

    try {
      await recordApprovalEmail(supabase, {
        actorId: userId,
        recipient: targetProfile,
        subject,
        body,
        reason,
        status: "success",
        providerResponse,
      });
    } catch (logError) {
      console.error("Failed to record profile rejection email log", logError);
    }
  } catch (error) {
    emailFailed = true;

    try {
      await recordApprovalEmail(supabase, {
        actorId: userId,
        recipient: targetProfile,
        subject,
        body,
        reason,
        status: "failure",
        errorMessage: error instanceof Error ? error.message : "email_send_failed",
        providerResponse: {},
      });
    } catch (logError) {
      console.error("Failed to record failed profile rejection email log", logError);
    }
  }

  await writeAuditLog(supabase, {
    actorId: userId,
    action: "profile_rejected",
    entityType: "profile",
    entityId: profileId,
    details: {
      rejected_by: userId,
      rejection_reason: reason,
      recipient_email: targetProfile.email,
      recipient_name: targetProfile.full_name,
    },
  });

  revalidatePath(APPROVAL_PAGE);
  redirect(emailFailed ? `${APPROVAL_PAGE}?error=email_failed` : APPROVAL_PAGE);
}
