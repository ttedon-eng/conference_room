"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  addMinutes,
  createVerificationCodeHash,
  generateVerificationCode,
  isAllowedSignupEmail,
  normalizeEmail,
  normalizeNextPath,
  SIGNUP_VERIFICATION_LOCK_THRESHOLD,
  SIGNUP_VERIFICATION_WINDOW_MINUTES,
  UNSPECIFIED_GROUP_NAME,
  verificationCodeMatches,
} from "@/lib/auth/onboarding";
import { sendEmailMessage } from "@/lib/email-delivery";

const SIGNUP_PAGE = "/signup";
const SIGNUP_VERIFY_PAGE = "/signup/verify";
const SIGNUP_COMPLETE_PAGE = "/signup/complete";
const LOGIN_PAGE = "/login";

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failSignup(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

async function getSignupVerificationByEmail(supabase: NonNullable<ReturnType<typeof createServiceClient>>, email: string) {
  const { data, error } = await supabase
    .from("signup_verifications")
    .select("id, email, code_hash, code_expires_at, failed_attempts, locked_at, verified_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getSignupVerificationById(supabase: NonNullable<ReturnType<typeof createServiceClient>>, sessionId: string) {
  const { data, error } = await supabase
    .from("signup_verifications")
    .select("id, email, code_hash, code_expires_at, failed_attempts, locked_at, verified_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function requestSignupVerification(formData: FormData) {
  const email = normalizeEmail(readValue(formData, "email"));
  const nextPath = normalizeNextPath(readValue(formData, "next"));

  if (!email || !isAllowedSignupEmail(email)) {
    failSignup(SIGNUP_PAGE, "invalid_email");
  }

  const supabase = createServiceClient();
  if (!supabase) {
    failSignup(SIGNUP_PAGE, "service_unavailable");
  }

  const existingVerification = await getSignupVerificationByEmail(supabase, email);

  if (existingVerification?.locked_at) {
    failSignup(SIGNUP_PAGE, "locked");
  }

  const verificationCode = generateVerificationCode();
  const verificationId = existingVerification?.id ?? randomUUID();
  const verificationCodeHash = createVerificationCodeHash(verificationId, verificationCode);
  const codeExpiresAt = addMinutes(new Date(), SIGNUP_VERIFICATION_WINDOW_MINUTES).toISOString();

  if (existingVerification) {
    const { error } = await supabase
      .from("signup_verifications")
      .update({
        code_hash: verificationCodeHash,
        code_expires_at: codeExpiresAt,
        verified_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingVerification.id);

    if (error) {
      throw error;
    }

  } else {
    const { data, error } = await supabase
      .from("signup_verifications")
      .insert({
        id: verificationId,
        email,
        code_hash: verificationCodeHash,
        code_expires_at: codeExpiresAt,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw error ?? new Error("Failed to create signup verification.");
    }
  }

  await sendEmailMessage({
    to: email,
    subject: "[회의실 예약] 이메일 인증번호",
    body: [
      "회원가입을 계속하려면 아래 인증번호를 입력하세요.",
      "",
      `인증번호: ${verificationCode}`,
      "유효 시간: 10분",
      "인증번호를 공유하지 마세요.",
    ].join("\n"),
  });

  redirect(`${SIGNUP_VERIFY_PAGE}?session=${encodeURIComponent(verificationId)}&next=${encodeURIComponent(nextPath)}`);
}

export async function verifySignupCode(formData: FormData) {
  const sessionId = readValue(formData, "session");
  const code = readValue(formData, "code");
  const nextPath = normalizeNextPath(readValue(formData, "next"));

  if (!sessionId || !code) {
    failSignup(SIGNUP_VERIFY_PAGE, "invalid");
  }

  const supabase = createServiceClient();
  if (!supabase) {
    failSignup(SIGNUP_VERIFY_PAGE, "service_unavailable");
  }

  const verification = await getSignupVerificationById(supabase, sessionId);
  if (!verification) {
    failSignup(SIGNUP_PAGE, "missing_session");
  }

  if (verification.locked_at) {
    failSignup(`${SIGNUP_VERIFY_PAGE}?session=${encodeURIComponent(sessionId)}&next=${encodeURIComponent(nextPath)}`, "locked");
  }

  if (new Date(verification.code_expires_at) < new Date()) {
    failSignup(`${SIGNUP_VERIFY_PAGE}?session=${encodeURIComponent(sessionId)}&next=${encodeURIComponent(nextPath)}`, "expired");
  }

  if (!verificationCodeMatches(verification.id, code, verification.code_hash)) {
    const nextFailedAttempts = verification.failed_attempts + 1;
    const isLocked = nextFailedAttempts >= SIGNUP_VERIFICATION_LOCK_THRESHOLD;

    const { error } = await supabase
      .from("signup_verifications")
      .update({
        failed_attempts: nextFailedAttempts,
        locked_at: isLocked ? new Date().toISOString() : verification.locked_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", verification.id);

    if (error) {
      throw error;
    }

    failSignup(
      `${SIGNUP_VERIFY_PAGE}?session=${encodeURIComponent(sessionId)}&next=${encodeURIComponent(nextPath)}`,
      isLocked ? "locked" : "invalid_code",
    );
  }

  const { error } = await supabase
    .from("signup_verifications")
    .update({
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", verification.id);

  if (error) {
    throw error;
  }

  redirect(`${SIGNUP_COMPLETE_PAGE}?session=${encodeURIComponent(sessionId)}&next=${encodeURIComponent(nextPath)}`);
}

export async function completeSignup(formData: FormData) {
  const sessionId = readValue(formData, "session");
  const fullName = readValue(formData, "full_name");
  const password = readValue(formData, "password");
  const groupId = readValue(formData, "group_id");
  const nextPath = normalizeNextPath(readValue(formData, "next"));

  if (!sessionId || !fullName || !password || !groupId) {
    failSignup(SIGNUP_COMPLETE_PAGE, "invalid");
  }

  const supabase = createServiceClient();
  if (!supabase) {
    failSignup(SIGNUP_COMPLETE_PAGE, "service_unavailable");
  }

  const verification = await getSignupVerificationById(supabase, sessionId);
  if (!verification || !verification.verified_at) {
    failSignup(`${SIGNUP_VERIFY_PAGE}?session=${encodeURIComponent(sessionId)}&next=${encodeURIComponent(nextPath)}`, "verification_required");
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, is_active")
    .eq("id", groupId)
    .eq("is_active", true)
    .neq("name", UNSPECIFIED_GROUP_NAME)
    .maybeSingle();

  if (groupError || !group) {
    failSignup(`${SIGNUP_COMPLETE_PAGE}?session=${encodeURIComponent(sessionId)}&next=${encodeURIComponent(nextPath)}`, "invalid_group");
  }

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email: verification.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (createUserError || !createdUser.user) {
    failSignup(`${SIGNUP_COMPLETE_PAGE}?session=${encodeURIComponent(sessionId)}&next=${encodeURIComponent(nextPath)}`, "create_failed");
  }

  const userId = createdUser.user.id;
  const now = new Date().toISOString();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      group_id: group.id,
      updated_at: now,
    })
    .eq("id", userId);

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    throw profileError;
  }

  const { error: cleanupError } = await supabase
    .from("signup_verifications")
    .delete()
    .eq("id", verification.id);

  if (cleanupError) {
    throw cleanupError;
  }

  redirect(`${LOGIN_PAGE}?next=${encodeURIComponent(nextPath)}&message=signup_complete`);
}
