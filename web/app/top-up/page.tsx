import { TopUpForm } from "@/components/api/top-up-form";
import { ApiShell } from "@/components/api/api-shell";

export default function TopUpPage() {
  return (
    <ApiShell title="Top up">
      <TopUpForm />
    </ApiShell>
  );
}
