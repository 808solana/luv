import { Resend } from "resend";

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export async function POST(request: Request) {
  let email: string;

  try {
    const body = await request.json();
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  console.log(`[notify] email captured: ${email}`);

  if (apiKey && to) {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: "LUV13 API interest",
      text: `New sign-up: ${email}`,
    });

    if (error) {
      console.error("[notify] resend error:", error);
      return Response.json({ error: "Could not send notification. Try again later." }, { status: 502 });
    }
  }

  return Response.json({ ok: true });
}
