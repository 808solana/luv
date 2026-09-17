export type ClientProvider = {
  id: string;
  name: string;
  /** Square brand raster in `public/BRAND_ASSETS/clients/` — painted, never `<img>`. */
  src: string;
  /** OpenRouter app page for this client. */
  href: string;
};

/**
 * Use-with clients under **Use With**. One full-bleed marquee of
 * marks + names — no kind ("Coding agent"), no Free/Paid, no Open pill.
 * The 2026-09-15 trim dropped `kind` / `access` / `alt`: the row is an image
 * with the name only. The old descriptors live in
 * `.cursor/skills/archive/provider-list.md` (caption map) if they are ever
 * wanted back. Open targets the OpenRouter `/apps` pages.
 *
 * Every mark was re-cut on 2026-09-15 from a single set of 500×500 PNGs the
 * user supplied, so all ten share one canvas size and one filename
 * convention (`claude`, `cline`, `codex`, `cursor`, `freebuff`, `hermes`,
 * `kilo-code`, `open-webui`, `openrouter`, `vs-code`). `cursor` and `vs-code`
 * used to be `.jpg`; nothing else should reintroduce a second extension here.
 *
 * `name` is the **visible card label** and the accessible name
 * (`Open ${name} on OpenRouter`), so it must be the string the user expects to
 * read — "Claude Code", not "Claude". The longest label sets the card's
 * required width; keep every entry short enough to stay on one line at the
 * 110.25px base card (`client-marquee.md` step 3).
 */
export const CLIENT_PROVIDERS: ClientProvider[] = [
  {
    id: "cursor",
    name: "Cursor",
    src: "/BRAND_ASSETS/clients/cursor.png",
    href: "https://openrouter.ai/apps/url/https%3A%2F%2Fcursor.com%2F",
  },
  {
    id: "hermes",
    name: "Hermes",
    src: "/BRAND_ASSETS/clients/hermes.png",
    href: "https://openrouter.ai/apps/hermes-agent",
  },
  {
    id: "vs-code",
    name: "VS Code",
    src: "/BRAND_ASSETS/clients/vs-code.png",
    href: "https://openrouter.ai/apps/url/https%3A%2F%2Fcode.visualstudio.com%2F",
  },
  {
    id: "freebuff",
    name: "FreeBuff",
    src: "/BRAND_ASSETS/clients/freebuff.png",
    href: "https://openrouter.ai/apps/url/https%3A%2F%2Ffreebuff.com%2F",
  },
  {
    id: "open-webui",
    name: "Open WebUI",
    src: "/BRAND_ASSETS/clients/open-webui.png",
    href: "https://openrouter.ai/apps/open-webui",
  },
  {
    id: "kilo-code",
    name: "Kilo Code",
    src: "/BRAND_ASSETS/clients/kilo-code.png",
    href: "https://openrouter.ai/apps/kilo-code",
  },
  {
    id: "codex",
    name: "Codex",
    src: "/BRAND_ASSETS/clients/codex.png",
    href: "https://openrouter.ai/apps/codex",
  },
  // Added 2026-09-15 with the brand-raster refresh. The OpenRouter targets
  // below are live `/apps` pages, but they are accepted placeholders: the user
  // has not supplied their own links yet (confirmed 2026-09-15 — keep these).
  {
    id: "cline",
    name: "Cline",
    src: "/BRAND_ASSETS/clients/cline.png",
    href: "https://openrouter.ai/apps/cline",
  },
  {
    id: "claude",
    // Label is "Claude Code", not "Claude" — the card must match the page it
    // opens, and the placeholder target is the `claude-code` app page.
    name: "Claude Code",
    src: "/BRAND_ASSETS/clients/claude.png",
    href: "https://openrouter.ai/apps/claude-code",
  },
  // Added 2026-09-15 (user: *"lets add an image to this rotation… the name
  // under the image should be 'Full List Here'"). The user's mark is the
  // OpenRouter asterisk, so the id is `openrouter` rather than `full-list`:
  // the filename names the *brand* of the mark, the label is what the card
  // reads. It opens the `/apps` directory at its **#global-ranking** anchor —
  // the one target in this array that is a list rather than a single app,
  // which is why it sits last and reads "Full List Here".
  {
    id: "openrouter",
    name: "Full List Here",
    src: "/BRAND_ASSETS/clients/openrouter.png",
    href: "https://openrouter.ai/apps/#global-ranking",
  },
];
