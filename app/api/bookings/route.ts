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

async function sendCreatedBookingEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    bookingId,
    userId,
    recipientEmail,
    room,
    booking,
    subjectPrefix,
  }: {
    bookingId: string;
    userId: string;
    recipientEmail: string;
    room: { id: string; name: string; room_number: string };
    booking: { title: string | null; notes: string | null; start_at: string; end_at: string };
    subjectPrefix: string;
  },
) {
  const subject = `${subjectPrefix} ${room.name} 예약이 생성되었습니다.`;
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
        bookingId,
        notificationType: "booking_created",
        actorId: userId,
        recipientUserId: userId,
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
      console.error("Failed to record booking creation email log", logError);
    }
  } catch (error) {
    try {
      await recordEmailDelivery(supabase, {
        bookingId,
        notificationType: "booking_created",
        actorId: userId,
        recipientUserId: userId,
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
          title: booking.title,
          notes: booking.notes,
          start_at: booking.start_at,
          end_at: booking.end_at,
        },
      });
    } catch (logError) {
      console.error("Failed to record booking creation email log", logError);
    }
  }
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
    repeatCount?: number;
  };

  if (!payload.roomId || !payload.startAt || !payload.endAt) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, room_number, is_active")
    .eq("id", payload.roomId)
    .maybeSingle();

  if (roomError || !room) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }

  if (!room.is_active) {
    return NextResponse.json({ error: "room_inactive" }, { status: 400 });
  }

  const repeatCount = Number.isFinite(payload.repeatCount) ? Math.trunc(payload.repeatCount ?? 1) : 1;
  const normalizedRepeatCount = Math.min(Math.max(repeatCount || 1, 1), 12);
  const isSeries = normalizedRepeatCount > 1;
  const title = payload.title || null;
  const notes = payload.notes || null;

  const bookingRows: Array<{
    id: string;
    room_id: string;
    user_id: string;
    start_at: string;
    end_at: string;
    title: string | null;
    notes: string | null;
  }> = [];

  if (isSeries) {
    const { data, error } = await supabase.rpc("create_weekly_booking_series", {
      p_room_id: room.id,
      p_start_at: payload.startAt,
      p_end_at: payload.endAt,
      p_title: title,
      p_notes: notes,
      p_repeat_count: normalizedRepeatCount,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    for (const row of (data ?? []) as Array<{
      booking_id: string;
      start_at: string;
      end_at: string;
    }>) {
      bookingRows.push({
        id: row.booking_id,
        room_id: room.id,
        user_id: user.id,
        start_at: row.start_at,
        end_at: row.end_at,
        title,
        notes,
      });
    }
  } else {
    const { data: insertedBooking, error } = await supabase
      .from("bookings")
      .insert({
        room_id: room.id,
        user_id: user.id,
        start_at: payload.startAt,
        end_at: payload.endAt,
        title,
        notes,
      })
      .select("id, room_id, user_id, start_at, end_at, title, notes")
      .maybeSingle();

    if (error || !insertedBooking) {
      return NextResponse.json({ error: error?.message ?? "booking_create_failed" }, { status: 400 });
    }

    bookingRows.push(insertedBooking);
  }

  const recipientEmail = profile?.email || user.email || "";
  if (!recipientEmail) {
    return NextResponse.json({ error: "missing_recipient_email" }, { status: 400 });
  }

  for (const booking of bookingRows) {
    const subjectPrefix = isSeries ? `[회의실 예약 · 정기 ${normalizedRepeatCount}회]` : "[회의실 예약]";
    await sendCreatedBookingEmail(supabase, {
      bookingId: booking.id,
      userId: user.id,
      recipientEmail,
      room,
      booking,
      subjectPrefix,
    });
  }

  return NextResponse.json(
    { booking: bookingRows[0], bookings: bookingRows, repeatCount: normalizedRepeatCount },
    { status: 201 },
  );
}
