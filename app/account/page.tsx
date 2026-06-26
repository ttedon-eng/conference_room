import { redirect } from "next/navigation";
import AccountForm from "./account-form";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/login?next=%2Faccount");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_approved && profile?.role !== "admin") {
    redirect("/pending?next=%2Faccount");
  }

  return <AccountForm user={user} initialProfile={profile ?? null} />;
}
