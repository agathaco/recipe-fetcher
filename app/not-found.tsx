// Next's file convention for the 404 UI: rendered whenever `notFound()` is
// called (recipe/edit pages, on a malformed or missing id) or a route just
// doesn't exist. A Server Component, no client state needed here.

import Link from "next/link";

import { DumplingMascot } from "@/components/dumpling-mascot";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <DumplingMascot mood="confused" className="size-24" />
      <h1 className="text-brand mt-4 text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Nothing here, or the recipe you&apos;re looking for doesn&apos;t exist (or
        isn&apos;t yours to see).
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        All recipes
      </Link>
    </main>
  );
}
