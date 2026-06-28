import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
