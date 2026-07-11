import { topUp } from "@/lib/stub-store";

export async function POST(request: Request) {
  let amountCents: number;
  let method: string;

  try {
    const body = await request.json();
    amountCents = Number(body.amountCents);
    method = String(body.method ?? "card");
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = topUp(amountCents, method);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not top up.";
    return Response.json({ error: message }, { status: 400 });
  }
}
