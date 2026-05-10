import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { brand } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const brandFaviconUrl = process.env.NEXT_PUBLIC_BRAND_FAVICON_URL;

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
  // When deploying for a different brand, set NEXT_PUBLIC_BRAND_FAVICON_URL to
  // an absolute URL or /public path pointing to their favicon, instead of
  // replacing the src/app/favicon.ico and src/app/icon.png files.
  ...(brandFaviconUrl ? { icons: { icon: brandFaviconUrl } } : {}),
};

const brandStyle = `
:root {
  --brand-primary: ${brand.colors.primary};
  --brand-primary-fg: ${brand.colors.primaryForeground};
  --brand-sidebar: ${brand.colors.sidebar};
  --brand-sidebar-fg: ${brand.colors.sidebarForeground};
  --brand-accent: ${brand.colors.accent};
}
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <style precedence="high" href="brand-theme">
          {brandStyle}
        </style>
        {children}
      </body>
    </html>
  );
}
