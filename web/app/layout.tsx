import type { Metadata } from "next";
import "./globals.css";
import { ScrollVideoBackground } from "@/components/scroll-video-background";

export const metadata: Metadata = {
  title: "LUV13 — GLM-5.2 Hosting",
  description: "We host GLM-5.2. Low costs. Low prices.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ScrollVideoBackground src="https://video.korgems.com/stream/index.m3u8" />
        {children}
      </body>
    </html>
  );
}
