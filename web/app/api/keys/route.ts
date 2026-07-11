import { createKey, listKeys } from "@/lib/stub-store";

export async function GET() {
  return Response.json({ keys: listKeys() });
}

export async function POST(request: Request) {
  let name: string;

  try {
    const body = await request.json();
    name = String(body.name ?? "");
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const key = createKey(name);
    return Response.json(key, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create key.";
    return Response.json({ error: message }, { status: 400 });
  }
}
