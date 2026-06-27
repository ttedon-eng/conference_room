import { createServiceClient } from "@/lib/supabase/admin";

type EmailDeliveryInput = {
  bookingId?: string | null;
  notificationType: "booking_created" | "booking_deleted" | "profile_rejected";
  actorId: string;
  recipientUserId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: "success" | "failure";
  providerName?: string | null;
  providerMessageId?: string | null;
  providerResponse?: Record<string, unknown>;
  errorMessage?: string | null;
  payload?: Record<string, unknown>;
};

export async function sendEmailMessage({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error("Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      text: body,
    }),
  });

  const responseText = await response.text();
  let responseJson: Record<string, unknown> = {};

  if (responseText) {
    try {
      responseJson = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      responseJson = { raw: responseText };
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof responseJson?.message === "string"
        ? responseJson.message
        : `Failed to send email (${response.status})`,
    );
  }

  return responseJson;
}

export async function recordEmailDelivery(
  supabase: any,
  payload: EmailDeliveryInput,
) {
  const rpcPayload = {
    p_notification_type: payload.notificationType,
    p_status: payload.status,
    p_provider: payload.providerName ?? "resend",
    p_booking_id: payload.bookingId ?? null,
    p_actor_id: payload.actorId,
    p_recipient_user_id: payload.recipientUserId,
    p_recipient_email: payload.recipientEmail,
    p_subject: payload.subject,
    p_body: payload.body,
    p_provider_message_id: payload.providerMessageId ?? null,
    p_error_message: payload.errorMessage ?? null,
    p_provider_response: payload.providerResponse ?? {},
    p_payload: payload.payload ?? {},
  };

  const { error } = await supabase.rpc("record_email_delivery_log", rpcPayload);

  if (!error) {
    return;
  }

  const serviceClient = createServiceClient();

  if (!serviceClient) {
    throw error;
  }

  const { error: fallbackError } = await serviceClient.from("email_delivery_logs").insert({
    notification_type: payload.notificationType,
    status: payload.status,
    provider: payload.providerName ?? "resend",
    booking_id: payload.bookingId ?? null,
    actor_id: payload.actorId,
    recipient_user_id: payload.recipientUserId,
    recipient_email: payload.recipientEmail,
    subject: payload.subject,
    body: payload.body,
    provider_message_id: payload.providerMessageId ?? null,
    error_message: payload.errorMessage ?? null,
    provider_response: payload.providerResponse ?? {},
    payload: payload.payload ?? {},
  });

  if (fallbackError) {
    throw fallbackError;
  }
}
