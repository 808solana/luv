import { KeysPageContent } from "@/components/api/keys-page-content";
import { ApiShell } from "@/components/api/api-shell";

export default function KeysPage() {
  return (
    <ApiShell title="API keys">
      <KeysPageContent />
    </ApiShell>
  );
}
