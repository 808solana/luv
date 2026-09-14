import Link from "next/link";

const HEADER_LINKS = [
  // /keys redirects to the dashboard (login if signed out). Keys UI is later.
  { href: "/keys", label: "Dashboard" },
] as const;

const NAV_TYPE = "text-ink";

export function SiteHeader() {
  return (
    <header className="site-header fixed inset-x-0 top-0 z-50 bg-transparent">
      <div className="flex h-[var(--site-header-height)] items-center justify-end px-5 md:px-10">
        <nav className="flex items-center gap-8" aria-label="Primary">
          {HEADER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm ${NAV_TYPE} transition-opacity hover:opacity-60`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
