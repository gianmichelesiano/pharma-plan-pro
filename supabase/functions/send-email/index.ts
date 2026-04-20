import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EmailPayload = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload: EmailPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const { to, subject, html, text, from } = payload;
  if (!to || !subject || (!html && !text)) {
    return json({ error: "missing fields: to, subject, html|text" }, 400);
  }

  const host = Deno.env.get("SMTP_HOST") ?? "smtp.zoho.eu";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASSWORD");
  const fromEmail = from ?? Deno.env.get("SMTP_FROM") ?? user;

  if (!user || !pass || !fromEmail) {
    return json({ error: "SMTP secrets not configured" }, 500);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    const info = await transporter.sendMail({
      from: fromEmail,
      to: Array.isArray(to) ? to.join(",") : to,
      subject,
      text,
      html,
    });
    return json({ ok: true, messageId: info.messageId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
