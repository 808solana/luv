export type ClientProvider = {
  id: string;
  name: string;
  /** Square brand raster in `public/BRAND_ASSETS/clients/` — painted, never `<img>`. */
  src: string;
  /** OpenRouter app page for this client. */
  href: string;
};

/**
 * Cache-bust token for the client rasters — **bump this whenever a raster's
 * bytes change but its filename does not.**
 *
 * Next serves `public/` with `cache-control: public, max-age=0`, which is
 * exactly what you want for a re-cut in place: the browser revalidates on every
 * load and the ETag does the rest. Cloudflare breaks that contract — it hands
 * the *browser* `public, max-age=14400` (its default Browser Cache TTL,
 * overriding the origin) and revalidates at the edge instead. So for four
 * hours after a re-cut, a browser that already has the old bytes never asks
 * again, and `kilo-code.png` keeps painting its superseded 256×256 mark through
 * deploy after deploy while the origin and the edge are both already correct
 * (reported 2026-09-16, after two deploys).
 *
 * The same trap silently swallowed the other four 2026-09-16 re-cuts that kept
 * their filenames (`codex`, `freebuff`, `hermes`, `open-webui`); only Kilo was
 * *visibly* wrong because its new art is a different design rather than a
 * higher-resolution cut of the same one. A version query moves every one of
 * them to a fresh URL, which no browser or edge cache can answer from the old
 * entry — and it keeps the one-filename-per-brand convention intact, because
 * the path is still `clients/<brand>.png`.
 */
const RASTER_VERSION = "2";

/** `/BRAND_ASSETS/clients/<brand>.png?v=<RASTER_VERSION>` */
const mark = (brand: string) =>
  `/BRAND_ASSETS/clients/${brand}.png?v=${RASTER_VERSION}`;

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
 * Every `src` is built by `mark()`, so it carries the `?v=` cache-bust token —
 * a bare path here would be invisible to anyone who cached the old bytes
 * (`RASTER_VERSION` above).
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
    src: mark("cursor"),
    href: "https://openrouter.ai/apps/url/https%3A%2F%2Fcursor.com%2F",
  },
  {
    id: "hermes",
    name: "Hermes",
    src: mark("hermes"),
    href: "https://openrouter.ai/apps/hermes-agent",
  },
  {
    id: "vs-code",
    name: "VS Code",
    src: mark("vs-code"),
    href: "https://openrouter.ai/apps/url/https%3A%2F%2Fcode.visualstudio.com%2F",
  },
  {
    id: "freebuff",
    name: "FreeBuff",
    src: mark("freebuff"),
    href: "https://openrouter.ai/apps/url/https%3A%2F%2Ffreebuff.com%2F",
  },
  {
    id: "open-webui",
    name: "Open WebUI",
    src: mark("open-webui"),
    href: "https://openrouter.ai/apps/open-webui",
  },
  {
    id: "kilo-code",
    name: "Kilo Code",
    src: mark("kilo-code"),
    href: "https://openrouter.ai/apps/kilo-code",
  },
  {
    id: "codex",
    name: "Codex",
    src: mark("codex"),
    href: "https://openrouter.ai/apps/codex",
  },
  // Added 2026-09-15 with the brand-raster refresh. The OpenRouter targets
  // below are live `/apps` pages, but they are accepted placeholders: the user
  // has not supplied their own links yet (confirmed 2026-09-15 — keep these).
  {
    id: "cline",
    name: "Cline",
    src: mark("cline"),
    href: "https://openrouter.ai/apps/cline",
  },
  {
    id: "claude",
    // Label is "Claude Code", not "Claude" — the card must match the page it
    // opens, and the placeholder target is the `claude-code` app page.
    name: "Claude Code",
    src: mark("claude"),
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
    src: mark("openrouter"),
    href: "https://openrouter.ai/apps/#global-ranking",
  },
];
