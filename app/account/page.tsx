import { redirect } from "next/navigation";
import AccountForm from "./account-form";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, is_approved")
    .eq("id", claimsData.claims.sub)
    .maybeSingle();

  if (!profile?.is_approved && profile?.role !== "admin") {
    redirect("/pending");
  }

  return <AccountForm claims={claimsData.claims} initialProfile={profile ?? null} />;
}
