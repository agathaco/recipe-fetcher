"use client";

// Route-level error boundary. Next renders this in place of the page tree
// whenever a Server Component render (or a data helper it calls) throws.
// It must be a Client Component: it holds the `reset` callback that re-runs
// the segment.

import Link from "next/link";
import { useEffect } from "react";

import { DumplingMascot } from "@/components/dumpling-mascot";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ends up in the browser console and, in production, the server logs.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <DumplingMascot mood="confused" className="size-24" />
      <h1 className="text-brand mt-4 text-2xl font-bold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This page couldn&apos;t load. It&apos;s usually the database being
        briefly unavailable rather than anything you did.
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          All recipes
        </Link>
      </div>
    </main>
  );
}
