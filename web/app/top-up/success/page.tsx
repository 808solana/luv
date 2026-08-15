import { redirect } from "next/navigation";

export default function TopUpSuccessPage() {
  redirect("/dashboard");
}
