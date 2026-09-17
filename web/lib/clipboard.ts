/**
 * Copy a string to the clipboard, with a fallback for the cases
 * `navigator.clipboard` cannot cover.
 *
 * The async Clipboard API needs a **secure context** (https, or localhost) and
 * a user gesture; over plain http on a LAN address — how this gets tested on a
 * phone — the promise rejects with `NotAllowedError`, so the fallback is not
 * dead code. It is the path that actually runs there.
 *
 * The hidden-textarea + `execCommand("copy")` branch has to focus and select
 * the textarea to work, which moves focus off the control the visitor pressed;
 * removing the textarea then drops focus to `<body>`, so a keyboard user loses
 * their place in the tab order (and the `focus-visible` ring vanishes).
 * Capturing `activeElement` and putting it back closes that hole. Restoration
 * is skipped if the captured node is gone, so a caller that unmounts on copy
 * cannot have focus thrown at a detached element.
 *
 * `execCommand` is deprecated and its own failure is swallowed on purpose: by
 * that point there is no third mechanism to try, and throwing would turn "the
 * clipboard did not work" into "the click handler crashed". Callers show their
 * own success state regardless, so the honest worst case is a no-op.
 *
 * Extracted 2026-09-16 — `base-url-display.tsx`, `copy-field.tsx` and the
 * contact section's email row had all grown their own byte-identical copy.
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall through to the legacy path */
  }

  const previouslyFocused = document.activeElement;

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* no-op — see the note above */
  }
  document.body.removeChild(ta);

  if (
    previouslyFocused instanceof HTMLElement &&
    previouslyFocused.isConnected
  ) {
    previouslyFocused.focus({ preventScroll: true });
  }
}
