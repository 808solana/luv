import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export function MarketingShell({
  children,
  overlayHeader = false,
}: {
  children: React.ReactNode;
  overlayHeader?: boolean;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-paper text-ink">
      <SiteHeader overlay={overlayHeader} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
