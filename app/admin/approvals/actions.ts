"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const APPROVAL_PAGE = "/admin/approvals";

export async function approveProfile(formData: FormData) {
  const profileIdValue = formData.get("profile_id");

  if (typeof profileIdValue !== "string" || !profileIdValue.trim()) {
    redirect(`${APPROVAL_PAGE}?error=invalid`);
  }

  const profileId = profileIdValue.trim();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(APPROVAL_PAGE)}`);
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (currentProfile?.role !== "admin") {
    redirect(
      currentProfile?.is_approved
        ? "/account"
        : `/pending?next=${encodeURIComponent(APPROVAL_PAGE)}`,
    );
  }

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      is_approved: true,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", profileId)
    .eq("role", "user")
    .eq("is_approved", false)
    .select("id")
    .maybeSingle();

  if (error || !updatedProfile) {
    redirect(`${APPROVAL_PAGE}?error=approve_failed`);
  }

  revalidatePath(APPROVAL_PAGE);
  redirect(APPROVAL_PAGE);
}
