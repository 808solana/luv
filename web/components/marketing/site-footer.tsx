import Link from "next/link";

const COLUMNS = [
  {
    title: "Models",
    links: [
      { href: "/#models", label: "Hosted models" },
      { href: "/models", label: "Directory" },
      { href: "/models#kimi-k3", label: "Kimi K3" },
      { href: "/models#glm-5-3", label: "GLM 5.3" },
      { href: "/models#deepseek-v4-1-flash", label: "DeepSeek V4.1 Flash" },
    ],
  },
  {
    title: "Product",
    links: [
      { href: "/#use-now", label: "Use now" },
      { href: "/#api", label: "API" },
      { href: "/signup", label: "Create account" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/", label: "Home" },
      { href: "/#models", label: "Infrastructure" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy notice" },
    ],
  },
  {
    title: "Connect",
    links: [
      {
        href: "https://neuralwatt.com",
        label: "Neuralwatt",
        external: true,
      },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-paper px-6 pb-16 pt-20 text-ink md:px-12 md:pb-20 md:pt-24">
      <div className="mx-auto max-w-7xl border-t border-black/10 pt-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:grid-cols-5">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="mb-4 text-sm text-ink">{column.title}</p>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {"external" in link && link.external ? (
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

        <p className="mt-16 text-sm text-black/40 md:text-base">
          LEV 13 © 2026
        </p>
      </div>
    </footer>
  );
}
