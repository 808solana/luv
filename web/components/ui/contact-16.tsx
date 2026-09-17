"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";

import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ShieldedImage } from "@/components/ui/shielded-image";

/** How long the circle reads “SENT” before the form returns to its idle UI. */
const SENT_HOLD_MS = 1800;

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** The copy icon↔check swap, matching the hero's base-URL pill. */
const COPY_ICON_TRANSITION = {
  type: "spring" as const,
  duration: 0.3,
  bounce: 0,
};

type ContactLink = {
  label: string;
  href: string;
  /** External destinations open in a new tab. */
  external?: boolean;
};

/**
 * The desktop contact column's links — bare text, no pill. `Instagram` is the
 * one confirmed destination (handle `luv13ai`, not `luv13`; see
 * `marketing-chrome.md`); **`X` is a placeholder** until the user supplies the
 * real URL.
 *
 * The e-mail row is **not** in here: it is a click-to-copy control, not a link
 * (`CONTACT_EMAIL`, below), so there is no `mailto:` left to hold the `external`
 * flag off.
 */
const CONTACT_LINKS: readonly ContactLink[] = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/luv13ai",
    external: true,
  },
  { label: "X", href: "https://x.com/", external: true },
];

/**
 * The address is **not** a `mailto:` link — clicking it copies instead
 * (2026-09-16, user: *"instead of the email button, when you click on it,
 * nothing really happens… let's just have a copy and paste… the text 'email'
 * should be replaced with the actual email. Every time the user clicks on it,
 * the email will be copied to the clipboard. On top of that, there's a little
 * copy button on the right of that."*).
 *
 * The visible text *is* the address, so there is nothing to guess at — and it
 * is still selectable as text (`select-text`), so a visitor who would rather
 * copy it by hand still can.
 */
const CONTACT_EMAIL = "hi@luv13.com";

/** How long the copy affordances show their copied state. */
const COPIED_HOLD_MS = 2000;

/**
 * Send the visitor to the field they still have to fill in.
 *
 * This exists because the form is `noValidate`: the native bubble cannot be
 * styled, so we suppress it and take over the jump ourselves — which means we
 * also own what the browser would otherwise have done for free (focus the
 * field, scroll it into view, raise the on-screen keyboard).
 *
 * `focus()` **must** run synchronously inside the submit handler. Defer it even
 * by a microtask and mobile browsers stop treating it as part of the tap
 * gesture, so the keyboard never opens. Keep this call ahead of every `await`.
 *
 * The scroll is explicit (`preventScroll: true`) and `instant`, so it cannot be
 * swallowed by the global `html { scroll-behavior: smooth }`, and it is re-run
 * once the visual viewport settles: on a phone the keyboard only shrinks that
 * viewport *after* focus lands, which would otherwise leave the field hidden
 * behind the keyboard on a form this far down the page.
 */
function focusAndReveal(field: HTMLInputElement | HTMLTextAreaElement) {
  field.focus({ preventScroll: true });

  const reveal = () => {
    field.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "instant",
    });
  };

  reveal();

  const viewport = window.visualViewport;
  if (!viewport) {
    return;
  }

  const onResize = () => reveal();
  viewport.addEventListener("resize", onResize);
  window.setTimeout(
    () => viewport.removeEventListener("resize", onResize),
    800,
  );
}

/**
 * Contact form directly under the `#use-now` client marquee, at the bottom of
 * the home page. It opens with a centered `Contact` `<h2>` set in the same type
 * as the `#use-now` heading; below that the form is **centered on the page**
 * (like the heading) and the contact column (`CONTACT_LINKS` + the copyable
 * `CONTACT_EMAIL`) hangs off its right-hand side. No
 * vertical padding of its own — the gap above comes from `#use-now`'s bottom
 * padding, and the page's bottom whitespace comes from the footer that follows
 * it.
 *
 * The submit control is the brand `.circle-cta` (56px circle, no hover
 * outline) wrapped in `MagneticButton`, so it leans toward the pointer. Its
 * face is the shield-painted send raster (`BRAND_ASSETS/contact/send.png`);
 * on success the face cross-fades to a “SENT” label, then the form resets to
 * the way the visitor found it. Not the shadcn `Button`.
 *
 * An incomplete submit shows **no message at all** — it just sends the visitor
 * to the first field that still needs filling in (`focusAndReveal`), which is
 * the affordance the real browser does and all this form needs. The form is
 * `noValidate` purely to keep the unstylable native bubble from reappearing
 * alongside that jump.
 * See `.cursor/skills/frontend/contact-form.md`.
 */
export function Contact16() {
  const [justSent, setJustSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [emailCopied, setEmailCopied] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const reduced = useReducedMotion() ?? false;

  // Hold “SENT”, then return to the original UI with empty fields.
  React.useEffect(() => {
    if (!justSent) {
      return;
    }
    const timer = window.setTimeout(() => {
      setJustSent(false);
      formRef.current?.reset();
    }, SENT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [justSent]);

  // Hold the copied state on the email row, then let it fall back to the copy
  // icon. Keyed on the flag so the timer is cleared on unmount.
  React.useEffect(() => {
    if (!emailCopied) {
      return;
    }
    const timer = window.setTimeout(
      () => setEmailCopied(false),
      COPIED_HOLD_MS,
    );
    return () => window.clearTimeout(timer);
  }, [emailCopied]);

  async function handleCopyEmail() {
    await copyText(CONTACT_EMAIL);
    setEmailCopied(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    // `noValidate` suppresses the native bubble but keeps the constraint API,
    // so `validity` still reflects `required` / `type="email"`. An incomplete
    // submit just jumps to the first field still needing input — no message.
    const invalid = Array.from(form.elements).find(
      (el): el is HTMLInputElement | HTMLTextAreaElement =>
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        !el.validity.valid,
    );

    if (invalid) {
      setError("");
      focusAndReveal(invalid);
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? ""),
          message: String(data.get("message") ?? ""),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(payload.error || "Something went wrong. Please try again.");
        return;
      }

      setJustSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="bg-paper px-6 text-black md:px-12"
    >
      {/* Centered section header, set in the exact same type as the `#use-now`
          "Use With" heading so the two read as one system. It stays centered on
          the page even though the form below it moves into the left column. */}
      <h2
        id="contact-heading"
        className="mb-8 text-center font-helveticaneue-bold text-xl leading-tight tracking-tight text-black text-balance sm:text-3xl md:mb-10 md:text-4xl"
      >
        Contact
      </h2>

      {/* The form stays **centered on the page**, exactly like the `Contact`
          heading above it, and the contact links hang off its right-hand side.

          Three tracks — `1fr 32rem 1fr` — are what does that: the middle track is
          widened to the form's own measure (`32rem` === `max-w-lg`), and the two
          `1fr` side tracks come out equal, so the form lands on the page axis
          no matter how wide the viewport is. The form is placed in the middle
          track and the links in the third, i.e. immediately right of the form
          (`gap-x-16` = 64px). The first track is deliberately empty — it is the
          left gutter that balances the links' column.

          Below `xl` the links are `hidden` and the grid is a single column, so
          the phone and tablet layout is unchanged; the mobile contact UI is a
          separate design that has not been specified yet.

          **`xl` and not `lg`/`md`:** a `1fr` track never shrinks below its
          content, so an over-wide side column silently takes width from the
          other side track and pushes the form off center. The side tracks are
          `(container − 512 − 128) / 2`, i.e. 144px at 1024 and 256px at 1280.
          The widest row is now the email row — the address is one unbreakable
          token at 148.9px, plus 8px gap plus the 36px copy button = **192.9px**
          — which does not fit 144px (the address alone does not), so at `lg`
          the grid would warp and the form would sit ~24px left of the heading.
          At `xl` the 256px tracks leave 63px of slack. (`md` was already out:
          ~80px tracks even against the old 110px `Instagram` label.)
          2026-09-16, when the mailto link became the copyable address. */}
      <div className="mx-auto grid w-full max-w-6xl gap-y-14 xl:grid-cols-[1fr_32rem_1fr] xl:items-start xl:gap-x-16">
        <form
          ref={formRef}
          noValidate
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-lg flex-col gap-4 xl:col-start-2"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="contact-email"
              className="text-sm font-medium text-black"
            >
              Email
            </label>
            <Input
              id="contact-email"
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              className="h-11"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="contact-message"
              className="text-sm font-medium text-black"
            >
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              required
              placeholder="How can we help?"
              className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-black outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {error ? (
            <p aria-live="polite" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <p role="status" className="sr-only">
            {justSent ? "Message sent" : ""}
          </p>

          <MagneticButton className="mt-1 self-end" distance={0.45}>
            <button
              type="submit"
              disabled={pending || justSent}
              aria-label={
                justSent ? "Message sent" : pending ? "Sending" : "Send message"
              }
              className={cn(
                "circle-cta disabled:pointer-events-none",
                pending && "opacity-60",
              )}
            >
              <AnimatePresence initial={false}>
                {justSent ? (
                  <motion.span
                    key="sent"
                    className="absolute inset-0 grid place-items-center rounded-full bg-black"
                    initial={
                      reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }
                    }
                    animate={{ opacity: 1, scale: 0.97 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.26, ease: EASE }}
                  >
                    <motion.span
                      className="text-[12px] font-bold tracking-[0.05em] text-paper"
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.22,
                        ease: EASE,
                        delay: reduced ? 0 : 0.08,
                      }}
                    >
                      SENT
                    </motion.span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="face"
                    className="absolute inset-0"
                    initial={
                      reduced ? { opacity: 0 } : { opacity: 0, scale: 1.08 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.26, ease: EASE }}
                  >
                    <ShieldedImage
                      src="/BRAND_ASSETS/contact/send.png"
                      alt=""
                      className="size-full"
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </MagneticButton>
        </form>

        {/* Desktop (`xl`+) contact column — bare text, no pill. The links wear
            the site's regrow focus ring for keyboard users and an underline on
            hover, because a link with no shape has to say so some other way.
            The email row ends the list: the address itself is the copy control,
            with an icon beside it as the second, pointer-sized way to copy.

            All three rows share one flat `text-2xl`: the column is `xl`-only,
            so the `text-xl md:text-2xl` ladder it used to carry could never
            reach its first rung. */}
        <div className="hidden xl:col-start-3 xl:flex xl:flex-col">
          <ul className="flex flex-col gap-4">
            {CONTACT_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  {...(link.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : null)}
                  className="inline-flex w-fit rounded-full font-helveticaneue-bold text-2xl leading-tight tracking-tight text-black underline decoration-transparent underline-offset-[6px] transition-[text-decoration-color] duration-200 hover:decoration-current focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#ffffff,0_0_0_5px_#0d0c12] motion-reduce:transition-none"
                >
                  {link.label}
                </a>
              </li>
            ))}

            <li className="flex items-center gap-2">
              {/* The address is the copy control. Its `aria-label` states the
                  action rather than repeating the address (the visible text is
                  already the address). */}
              <button
                type="button"
                onClick={handleCopyEmail}
                aria-label={
                  emailCopied
                    ? "Email address copied"
                    : `Copy ${CONTACT_EMAIL} to clipboard`
                }
                className="inline-flex w-fit cursor-pointer rounded-full font-helveticaneue-bold text-2xl leading-tight tracking-tight text-black underline decoration-transparent underline-offset-[6px] transition-[text-decoration-color] duration-200 select-text hover:decoration-current focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#ffffff,0_0_0_5px_#0d0c12] motion-reduce:transition-none"
              >
                {CONTACT_EMAIL}
              </button>

              {/* The pointer-sized twin of the address button — the same small
                  copy control as the hero's base-URL pill, re-coloured for the
                  white ground. **`aria-hidden` + `tabIndex={-1}` on purpose:**
                  it is a duplicate of the action the address button already
                  exposes, so leaving it in the tab order would give keyboard
                  users two stops, two names, and one action. The `::after` box
                  lifts the 36px face to a 44px target. */}
              <button
                type="button"
                onClick={handleCopyEmail}
                aria-hidden="true"
                tabIndex={-1}
                className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-black transition-transform duration-200 after:absolute after:-inset-1 after:content-[''] hover:bg-black/5 focus-visible:outline-none active:scale-[0.96]"
              >
                <AnimatePresence initial={false}>
                  {emailCopied ? (
                    <motion.span
                      key="check"
                      initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                      transition={COPY_ICON_TRANSITION}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <Check
                        className="h-4 w-4 text-[#22c55e]"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                      transition={COPY_ICON_TRANSITION}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <Copy
                        className="h-4 w-4 text-black/50"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </li>
          </ul>

          {/* The icon button is `aria-hidden`, so this is what tells a screen
              reader the copy landed — same pattern as the form's sent status. */}
          <p role="status" className="sr-only">
            {emailCopied ? `${CONTACT_EMAIL} copied to clipboard` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
