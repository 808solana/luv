import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Log in to see your balance, usage, top-ups, and API keys."
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
