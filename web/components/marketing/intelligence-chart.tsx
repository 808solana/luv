import { IntelligenceCarousel } from "@/components/marketing/intelligence-carousel";

/**
 * Artificial Analysis Intelligence Index charts, under the hosted model list.
 *
 * A slow carousel of the exported charts: drag, arrow keys, or the thumbnail
 * rail step through them, and it advances on its own while it is on screen and
 * the visitor is not interacting with it.
 *
 * Every slide is painted with `ShieldedImage` (CSS background, not `<img>`) so
 * the browser attaches no image context-menu items — no “Open image in new
 * tab”, “Save image as”, “Copy image”, “Copy image address”, “Copy text from
 * image”, “Create QR code”, or image search. `web/middleware.ts` 404s the
 * assets on document navigations so the URLs are dead in the address bar.
 */
export function IntelligenceChart() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[80rem]">
      <IntelligenceCarousel />
    </div>
  );
}
