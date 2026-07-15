"use client";

import Image from "next/image";
import { AspectRatio } from "@/components/ui/astryx-aspect-ratio";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import "@astryxdesign/theme-neutral/theme.css";

export function HostingImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Theme theme={neutralTheme}>
      <div className="w-full max-w-2xl rounded-2xl ring-1 ring-black/[0.08] shadow-lg overflow-hidden">
        <AspectRatio ratio={1}>
          <Image
            src={src}
            alt={alt}
            fill
            style={{ objectFit: "cover" }}
            priority={false}
          />
        </AspectRatio>
      </div>
    </Theme>
  );
}
