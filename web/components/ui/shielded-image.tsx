import { cn } from "@/lib/utils";

type ShieldedImageProps = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Paints a raster as a CSS background so the element is not an <img>.
 * Browsers only attach “Open Image in New Tab” / “Save Image As” to
 * replaced image nodes — a background span does not get those items.
 */
export function ShieldedImage({ src, alt, className }: ShieldedImageProps) {
  const url = src.replace(/["'\\)]/g, "");

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn(
        "inline-block bg-contain bg-center bg-no-repeat select-none [-webkit-touch-callout:none]",
        className,
      )}
      style={{ backgroundImage: `url("${url}")` }}
    />
  );
}
