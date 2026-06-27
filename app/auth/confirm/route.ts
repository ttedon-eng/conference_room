import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_NEXT_PATH = "/bookings";

function safeNextPath(value: string | null) {
  const nextPath = value?.trim();

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.includes("://")) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeNextPath(searchParams.get("next"));
  const pendingUrl = new URL("/pending", request.url);
  pendingUrl.searchParams.set("next", nextPath);
  const nextUrl = new URL(nextPath, request.url);

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, is_approved")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.is_approved || profile?.role === "admin") {
          return NextResponse.redirect(nextUrl);
        }

        return NextResponse.redirect(pendingUrl);
      }

      return NextResponse.redirect(pendingUrl);
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}
