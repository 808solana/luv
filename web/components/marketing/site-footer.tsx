import Link from "next/link";

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

type FooterColumn = {
  title: string;
  links: readonly FooterLink[];
};

// Directory scaffolding. Add a column object here to add a header, and add
// entries to a column's `links` array to populate it — internal links use
// `next/link`, and `external: true` renders a plain anchor that opens in a
// new tab.
//
// The directory is intentionally EMPTY: the column headers (Contact, Product,
// Company, Legal, Connect) and the one entry (Instagram) were all removed at
// the user's request on 2026-09-14. Do not re-add placeholders.
// See `.cursor/skills/frontend/marketing-chrome.md`.
const COLUMNS: readonly FooterColumn[] = [];

export function SiteFooter() {
  return (
    <footer className="bg-paper px-6 pb-16 pt-20 text-ink md:px-12 md:pb-20 md:pt-24">
      <div className="mx-auto max-w-7xl pt-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:grid-cols-5">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="mb-4 text-sm text-ink">{column.title}</p>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-ink/70 transition-opacity hover:text-ink hover:opacity-100"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-ink/70 transition-opacity hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
