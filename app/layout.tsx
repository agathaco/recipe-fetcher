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

export const metadata: Metadata = {
  title: {
    default: "Recipes",
    // Child pages set their own title (a string, via `metadata`, or via
    // `generateMetadata`); this template wraps it, e.g. "Add a recipe · Recipes".
    template: "%s · Recipes",
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
