"use client";

// Last-resort boundary for errors thrown by the root layout itself (where the
// normal error.tsx can't help, because it renders *inside* that layout). It
// replaces the whole document, so it has to bring its own <html>/<body>.
// Deliberately plain inline styles, no Tailwind, no DumplingMascot: if the
// root layout itself is failing, this is the one place that shouldn't lean
// on anything that could plausibly be implicated (the CSS pipeline, an
// imported component), same reasoning as bringing its own <html>/<body>.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          margin: 0,
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem" }}>Something went wrong</h1>
          <p style={{ color: "#666", fontSize: "0.875rem" }}>
            The app failed to load. Try again in a moment.
          </p>
          <button onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
