import crypto from "crypto";

const WA_API_VERSION = "v20.0";
const WA_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`;

export function verifyWebhookSignature(
  body: string,
  signature: string,
  appSecret: string
): boolean {
  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(body)
    .digest("hex");
  return `sha256=${expectedSig}` === signature;
}

export async function sendTextMessage(phone: string, text: string) {
  const res = await fetch(
    `${WA_BASE_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: text },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`WhatsApp API Error: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

export async function sendTemplateMessage(
  phone: string,
  templateName: string,
  languageCode: string,
  components?: Record<string, any>[]
) {
  const body: Record<string, any> = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };
  if (components) {
    body.template.components = components;
  }

  const res = await fetch(
    `${WA_BASE_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`WhatsApp API Error: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

export async function markAsRead(messageId: string) {
  return fetch(
    `${WA_BASE_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    }
  );
}

export function parseWebhookMessage(body: any) {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.[0]) return null;

  const msg = value.messages[0];
  const contact = value.contacts?.[0];

  return {
    messageId: msg.id,
    from: msg.from,
    timestamp: msg.timestamp,
    type: msg.type,
    text: msg.text?.body || "",
    contactName: contact?.profile?.name || "",
  };
}
