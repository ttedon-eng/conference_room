"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const GROUPS_PAGE = "/admin/groups";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(GROUPS_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(GROUPS_PAGE)}`);
  }

  return { supabase, userId: user.id };
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) !== null;
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

export async function createGroup(formData: FormData) {
  const name = readValue(formData, "name");
  const description = readValue(formData, "description");
  const isActive = readCheckbox(formData, "is_active");

  if (!name) {
    redirect(`${GROUPS_PAGE}?error=invalid`);
  }

  const { supabase, userId } = await requireAdmin();

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name,
      description: description || null,
      is_active: isActive,
      created_by: userId,
    })
    .select("id, name")
    .maybeSingle();

  if (error || !data) {
    redirect(`${GROUPS_PAGE}?error=create_failed`);
  }

  await writeAuditLog(supabase, {
    actorId: userId,
    action: "group_created",
    entityType: "group",
    entityId: data.id,
    details: { name: data.name },
  });

  revalidatePath(GROUPS_PAGE);
  redirect(GROUPS_PAGE);
}

export async function updateGroup(formData: FormData) {
  const groupId = readValue(formData, "group_id");
  const name = readValue(formData, "name");
  const description = readValue(formData, "description");
  const isActive = readCheckbox(formData, "is_active");

  if (!groupId || !name) {
    redirect(`${GROUPS_PAGE}?error=invalid`);
  }

  const { supabase, userId } = await requireAdmin();

  const { data: updatedGroup, error } = await supabase
    .from("groups")
    .update({
      name,
      description: description || null,
      is_active: isActive,
    })
    .eq("id", groupId)
    .select("id, name")
    .maybeSingle();

  if (error || !updatedGroup) {
    redirect(`${GROUPS_PAGE}?error=update_failed`);
  }

  await writeAuditLog(supabase, {
    actorId: userId,
    action: "group_updated",
    entityType: "group",
    entityId: updatedGroup.id,
    details: { name: updatedGroup.name },
  });

  revalidatePath(GROUPS_PAGE);
  redirect(GROUPS_PAGE);
}

export async function deleteGroup(formData: FormData) {
  const groupId = readValue(formData, "group_id");

  if (!groupId) {
    redirect(`${GROUPS_PAGE}?error=invalid`);
  }

  const { supabase, userId } = await requireAdmin();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, is_active")
    .eq("id", groupId)
    .maybeSingle();

  const { error } = await supabase
    .from("groups")
    .update({
      is_active: false,
    })
    .eq("id", groupId)
    .eq("is_active", true);

  if (error) {
    redirect(`${GROUPS_PAGE}?error=delete_failed`);
  }

  await writeAuditLog(supabase, {
    actorId: userId,
    action: "group_deactivated",
    entityType: "group",
    entityId: groupId,
    details: {
      name: group?.name ?? null,
      was_active: group?.is_active ?? null,
      is_active: false,
    },
  });

  revalidatePath(GROUPS_PAGE);
  redirect(GROUPS_PAGE);
}

export async function assignUserGroup(formData: FormData) {
  const userIdValue = readValue(formData, "user_id");
  const groupIdValue = readValue(formData, "group_id");

  if (!userIdValue) {
    redirect(`${GROUPS_PAGE}?error=invalid`);
  }

  const { supabase, userId } = await requireAdmin();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, group_id, full_name, email")
    .eq("id", userIdValue)
    .maybeSingle();

  let group: { id: string; name: string } | null = null;

  if (groupIdValue) {
    const { data: selectedGroup } = await supabase
      .from("groups")
      .select("id, name")
      .eq("id", groupIdValue)
      .maybeSingle();
    group = selectedGroup ?? null;
  }

  if (!profile) {
    redirect(`${GROUPS_PAGE}?error=missing_user`);
  }

  const previousGroupId = profile.group_id ?? null;
  const nextGroupId = groupIdValue || null;

  const { error } = await supabase
    .from("profiles")
    .update({ group_id: nextGroupId })
    .eq("id", profile.id)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`${GROUPS_PAGE}?error=assign_failed`);
  }

  await Promise.all([
    supabase.from("group_membership_history").insert({
      user_id: profile.id,
      previous_group_id: previousGroupId,
      group_id: nextGroupId,
      changed_by: userId,
    }),
    writeAuditLog(supabase, {
      actorId: userId,
      action: "group_assignment_updated",
      entityType: "profile",
      entityId: profile.id,
      details: {
        user_email: profile.email,
        user_name: profile.full_name,
        previous_group_id: previousGroupId,
        group_id: nextGroupId,
        group_name: group?.name ?? null,
      },
    }),
  ]);

  revalidatePath(GROUPS_PAGE);
  redirect(GROUPS_PAGE);
}
