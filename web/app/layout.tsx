/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import "./globals.css";
import { SmoothScroll } from "@/components/smooth-scroll";
import { SplashScreen } from "@/components/splash-screen";

export const metadata: Metadata = {
  title: "LUV13 — GLM-5.2 Hosting",
  description: "We host GLM-5.2. Low costs. Low prices.",
};

const splashCriticalCss = `
html{background:#000}
#luv13-splash{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#000}
#luv13-splash img{height:48px;width:auto}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <style dangerouslySetInnerHTML={{ __html: splashCriticalCss }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <div id="luv13-splash" aria-hidden="true">
          {/* Logo already reads on black via light outlines. */}
          <img src="/BRAND_ASSETS/LUV13.png" alt="" width="48" height="48" />
        </div>
        <noscript>
          <style>{`#luv13-splash{display:none}html{background:#fff}`}</style>
        </noscript>
        <SplashScreen />
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
