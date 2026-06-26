import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_NEXT_PATH = "/account";

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
  const redirectTo = new URL(nextPath, request.url);

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}
