import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignupPage() {
  return (
    <AuthShell
      title="Start creating"
      description="Create a LUV13 account, make your key, then add credit when you are ready to use it."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
