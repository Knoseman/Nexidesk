import React from "react";
import Image from "next/image";

/**
 * All brand values are driven by NEXT_PUBLIC_BRAND_* env vars.
 * Defaults ship Nexidesk in Nexi colours.
 * To white-label for another tenant, set the vars in Railway (or .env.local)
 * and redeploy — no code changes required.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Nexi Group",
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Simplifying Payments for People",
  colors: {
    primary: process.env.NEXT_PUBLIC_BRAND_PRIMARY ?? "#2D32AA",
    primaryForeground: process.env.NEXT_PUBLIC_BRAND_PRIMARY_FG ?? "#ffffff",
    sidebar: process.env.NEXT_PUBLIC_BRAND_SIDEBAR ?? "#0f172a",
    sidebarForeground: process.env.NEXT_PUBLIC_BRAND_SIDEBAR_FG ?? "#f8fafc",
    accent: process.env.NEXT_PUBLIC_BRAND_ACCENT ?? "#2D32AA",
  },
  logo: {
    // Path (relative to /public) or absolute URL to the wordmark image.
    // Replace the file or point this var at a new URL for a different brand.
    url: process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? "/nexi-logo.png",
    // Width-to-height ratio of the logo image (used to size it correctly).
    ratio: parseFloat(process.env.NEXT_PUBLIC_BRAND_LOGO_RATIO ?? "3.062"),
  },
} as const;

/** Horizontal wordmark — use in headers, login panels, etc. */
export function BrandLogo({
  className,
  height = 28,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <Image
      src={brand.logo.url}
      alt={brand.name}
      width={Math.round(height * brand.logo.ratio)}
      height={height}
      className={className}
      priority
    />
  );
}

// BrandIcon kept as an alias — some call sites may use either name.
export { BrandLogo as BrandIcon };
