import { redirect } from "next/navigation";

export default function TopUpPage() {
  redirect("/dashboard?topup=1");
}
