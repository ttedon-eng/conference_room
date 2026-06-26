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

export async function POST(request: Request) {
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

  const payload = (await request.json()) as {
    roomId?: string;
    startAt?: string;
    endAt?: string;
    title?: string;
    notes?: string;
  };

  if (!payload.roomId || !payload.startAt || !payload.endAt) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, room_number")
    .eq("id", payload.roomId)
    .maybeSingle();

  if (roomError || !room) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }

  const { data: insertedBooking, error } = await supabase
    .from("bookings")
    .insert({
      room_id: room.id,
      user_id: user.id,
      start_at: payload.startAt,
      end_at: payload.endAt,
      title: payload.title || null,
      notes: payload.notes || null,
    })
    .select("id, room_id, user_id, start_at, end_at, title, notes")
    .maybeSingle();

  if (error || !insertedBooking) {
    return NextResponse.json({ error: error?.message ?? "booking_create_failed" }, { status: 400 });
  }

  const recipientEmail = profile?.email || user.email || "";
  if (!recipientEmail) {
    return NextResponse.json({ error: "missing_recipient_email" }, { status: 400 });
  }
  const subject = `[회의실 예약] ${room.name} 예약이 생성되었습니다.`;
  const body = formatBookingMessage({
    title: insertedBooking.title,
    roomName: room.name,
    roomNumber: room.room_number,
    startAt: insertedBooking.start_at,
    endAt: insertedBooking.end_at,
  });

  try {
    const providerResponse = await sendEmailMessage({
      to: recipientEmail,
      subject,
      body,
    });

    try {
      await recordEmailDelivery(supabase, {
        bookingId: insertedBooking.id,
        notificationType: "booking_created",
        actorId: user.id,
        recipientUserId: user.id,
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
          title: insertedBooking.title,
          notes: insertedBooking.notes,
          start_at: insertedBooking.start_at,
          end_at: insertedBooking.end_at,
        },
      });
    } catch (logError) {
      console.error("Failed to record booking creation email log", logError);
    }
  } catch (error) {
    try {
      await recordEmailDelivery(supabase, {
        bookingId: insertedBooking.id,
        notificationType: "booking_created",
        actorId: user.id,
        recipientUserId: user.id,
        recipientEmail,
        subject,
        body,
        status: "failure",
        providerName: "resend",
        errorMessage: error instanceof Error ? error.message : "email_send_failed",
        providerResponse: {},
        payload: {
          room_id: room.id,
          room_name: room.name,
          room_number: room.room_number,
          title: insertedBooking.title,
          notes: insertedBooking.notes,
          start_at: insertedBooking.start_at,
          end_at: insertedBooking.end_at,
        },
      });
    } catch (logError) {
      console.error("Failed to record booking creation email log", logError);
    }
  }

  return NextResponse.json({ booking: insertedBooking }, { status: 201 });
}
