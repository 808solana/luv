import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export function MarketingShell({
  children,
  overlayHeader = false,
  showFooter = true,
}: {
  children: React.ReactNode;
  overlayHeader?: boolean;
  showFooter?: boolean;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-paper text-ink">
      <SiteHeader />
      <div
        className={
          overlayHeader ? "flex-1" : "flex-1 pt-[var(--site-header-height)]"
        }
      >
        {children}
      </div>
      {showFooter ? <SiteFooter /> : null}
    </div>
  );
}
