export type ClientAccess = "Paid" | "Free" | "Free and Paid";

export type ClientProvider = {
  id: string;
  name: string;
  src: string;
  alt: string;
  /** Short “what it is” — no muted label in the row. */
  kind: string;
  access: ClientAccess;
  /** OpenRouter app page for this client. */
  href: string;
};

/**
 * Pair-with clients under Luv With. One even stacked list.
 * Open targets OpenRouter /apps pages.
 */
export const CLIENT_PROVIDERS: ClientProvider[] = [
  {
    id: "cursor",
    name: "Cursor",
    src: "/BRAND_ASSETS/clients/cursor.jpg",
    alt: "Cursor",
    kind: "Coding agent and IDE",
    access: "Free and Paid",
    href: "https://openrouter.ai/apps/url/https%3A%2F%2Fcursor.com%2F",
  },
  {
    id: "hermes",
    name: "Hermes",
    src: "/BRAND_ASSETS/clients/hermes.png",
    alt: "Hermes",
    kind: "Personal everything agent",
    access: "Free",
    href: "https://openrouter.ai/apps/hermes-agent",
  },
  {
    id: "vs-code",
    name: "VS Code",
    src: "/BRAND_ASSETS/clients/vs-code.jpg",
    alt: "VS Code",
    kind: "IDE extensions",
    access: "Free",
    href: "https://openrouter.ai/apps/url/https%3A%2F%2Fcode.visualstudio.com%2F",
  },
  {
    id: "freebuff",
    name: "FreeBuff",
    src: "/BRAND_ASSETS/clients/freebuff.png",
    alt: "FreeBuff",
    kind: "Coding agent",
    access: "Free",
    href: "https://openrouter.ai/apps/url/https%3A%2F%2Ffreebuff.com%2F",
  },
  {
    id: "open-webui",
    name: "Open WebUI",
    src: "/BRAND_ASSETS/clients/open-webui.png",
    alt: "Open WebUI",
    kind: "General chat",
    access: "Free",
    href: "https://openrouter.ai/apps/open-webui",
  },
  {
    id: "kilo-code",
    name: "Kilo Code",
    src: "/BRAND_ASSETS/clients/kilo-code.png",
    alt: "Kilo Code",
    kind: "IDE extension, coding agent, CLI agent",
    access: "Free",
    href: "https://openrouter.ai/apps/kilo-code",
  },
  {
    id: "codex",
    name: "Codex",
    src: "/BRAND_ASSETS/clients/codex.png",
    alt: "Codex",
    kind: "Coding agent, CLI agent, IDE agent",
    access: "Free",
    href: "https://openrouter.ai/apps/codex",
  },
];
