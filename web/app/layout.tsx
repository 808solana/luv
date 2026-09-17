import type { Metadata } from "next";
import "./globals.css";
import { SmoothScroll } from "@/components/smooth-scroll";

export const metadata: Metadata = {
  title: "luv13",
  description: "We host GLM-5.2. Low costs. Low prices.",
  // Safari's start page and the iOS home screen take the tile *label* from
  // this, not from <title>. Keep it the site name alone — the tile must never
  // read as `LUV13 — GLM-5.2 Hosting`.
  // `capable: false` is deliberate: Next defaults it to true, which emits
  // `mobile-web-app-capable: yes` and makes a home-screen shortcut open
  // chrome-less. This is a website, not an installed app.
  appleWebApp: { capable: false, title: "luv13" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          rel="preload"
          href="/BRAND_ASSETS/HelveticaNeue-Bold.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/BRAND_ASSETS/HelveticaNeueUltraLightItalic.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
