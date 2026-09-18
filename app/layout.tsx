import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  // shadcn's theme maps Tailwind's `font-sans` to `--font-sans`.
  variable: "--font-sans",
  subsets: ["latin"],
});

// Chunky grotesque for headings, for character without the editorial-serif cliche.
const heading = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Every page reads live data from Postgres, which Next can't detect (it only
// watches fetch(), not a Drizzle call), so it would otherwise freeze pages at
// build time. Setting this on the root layout opts the whole app out of static
// rendering in one place. See DECISIONS.md "force-dynamic over cache-plus-revalidate".
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Miam",
    // Child pages set their own title (a string, via `metadata`, or via
    // `generateMetadata`); this template wraps it, e.g. "Add a recipe · Miam".
    template: "%s · Miam",
  },
  description: "Capture, store, and find recipes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="min-h-full" suppressHydrationWarning>
        {children}
        {/* One app-wide toast outlet; client components call toast() from sonner. */}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
