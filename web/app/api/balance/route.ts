import { getBalance } from "@/lib/stub-store";

export async function GET() {
  return Response.json(getBalance());
}
