import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordEmailDelivery, sendEmailMessage } from "@/lib/email-delivery";

function formatBookingMessage({
  title,
  roomName,
  roomNumber,
  startAt,
  endAt,
}: {
  title: string | null;
  roomName: string;
  roomNumber: string;
  startAt: string;
  endAt: string;
}) {
  return [
    `제목: ${title || "제목 없음"}`,
    `회의실: ${roomName} (Room ${roomNumber})`,
    `시작: ${new Date(startAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
    `종료: ${new Date(endAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
  ].join("\n");
}

export async function DELETE(_: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_approved && profile?.role !== "admin") {
    return NextResponse.json({ error: "not_approved" }, { status: 403 });
  }

  const { bookingId } = await params;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, user_id, room_id, start_at, end_at, title, notes")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }

  if (booking.user_id !== user.id && profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [roomResult, recipientResult] = await Promise.all([
    supabase.from("rooms").select("id, name, room_number").eq("id", booking.room_id).maybeSingle(),
    supabase.from("profiles").select("id, email, full_name").eq("id", booking.user_id).maybeSingle(),
  ]);

  const room = roomResult.data;
  const recipientProfile = recipientResult.data;

  if (roomResult.error || !room) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }

  const { error } = await supabase.from("bookings").delete().eq("id", booking.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const recipientEmail = recipientProfile?.email || profile?.email || user.email || "";
  if (!recipientEmail) {
    return NextResponse.json({ error: "missing_recipient_email" }, { status: 400 });
  }
  const subject = `[회의실 예약] ${room.name} 예약이 삭제되었습니다.`;
  const body = formatBookingMessage({
    title: booking.title,
    roomName: room.name,
    roomNumber: room.room_number,
    startAt: booking.start_at,
    endAt: booking.end_at,
  });

  try {
    const providerResponse = await sendEmailMessage({
      to: recipientEmail,
      subject,
      body,
    });

    try {
      await recordEmailDelivery(supabase, {
        bookingId: booking.id,
        notificationType: "booking_deleted",
        actorId: user.id,
        recipientUserId: booking.user_id,
        recipientEmail,
        subject,
        body,
        status: "success",
        providerName: "resend",
        providerMessageId:
          typeof providerResponse?.id === "string" ? providerResponse.id : null,
        providerResponse,
        payload: {
          room_id: room.id,
          room_name: room.name,
          room_number: room.room_number,
          title: booking.title,
          notes: booking.notes,
          start_at: booking.start_at,
          end_at: booking.end_at,
        },
      });
    } catch (logError) {
      console.error("Failed to record booking deletion email log", logError);
    }
  } catch (emailError) {
    try {
      await recordEmailDelivery(supabase, {
        bookingId: booking.id,
        notificationType: "booking_deleted",
        actorId: user.id,
        recipientUserId: booking.user_id,
        recipientEmail,
        subject,
        body,
        status: "failure",
        providerName: "resend",
        errorMessage: emailError instanceof Error ? emailError.message : "email_send_failed",
        providerResponse: {},
        payload: {
          room_id: room.id,
          room_name: room.name,
          room_number: room.room_number,
          title: booking.title,
          notes: booking.notes,
          start_at: booking.start_at,
          end_at: booking.end_at,
        },
      });
    } catch (logError) {
      console.error("Failed to record booking deletion email log", logError);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
