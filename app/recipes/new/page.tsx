import Link from "next/link";

import { createRecipe, importFromUrl } from "@/app/lib/actions";

export const metadata = { title: "Add a recipe" };
export const dynamic = "force-dynamic";

function field(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const importFailed = field(params.importFailed) === "1";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        &larr; All recipes
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Add a recipe</h1>

      {/* Fetches server-side, then redirects back here with whatever it found
          as query params. This form and the one below are deliberately separate
          Server Actions: importing and saving are different mutations. */}
      <form
        action={importFromUrl}
        className="mt-6 flex gap-2 rounded border border-dashed border-gray-300 p-3"
      >
        <input
          name="importUrl"
          type="url"
          placeholder="Paste a recipe or Instagram URL"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="shrink-0 rounded bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200"
        >
          Fetch
        </button>
      </form>
      {importFailed && (
        <p className="mt-2 text-sm text-amber-700">
          Couldn&apos;t find a recipe at that link. Paste it in below instead.
        </p>
      )}
      {field(params.imageUrl) && (
        // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized preview only
        <img
          src={field(params.imageUrl)}
          alt=""
          className="mt-3 h-32 w-32 rounded object-cover"
        />
      )}

      {/* Plain form + Server Action: submits even with JS disabled. */}
      <form action={createRecipe} className="mt-6 space-y-4">
        <input type="hidden" name="sourceType" value={field(params.sourceType) ?? "manual"} />
        <input type="hidden" name="imageUrl" value={field(params.imageUrl) ?? ""} />

        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            name="title"
            required
            defaultValue={field(params.title)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Source URL</span>
          <input
            name="sourceUrl"
            type="url"
            defaultValue={field(params.sourceUrl)}
            placeholder="https://"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Ingredients</span>
          <textarea
            name="ingredients"
            rows={6}
            defaultValue={field(params.ingredients)}
            placeholder="One per line"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Steps</span>
          <textarea
            name="steps"
            rows={6}
            defaultValue={field(params.steps)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Notes</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={field(params.notes)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Tags</span>
          <input
            name="tags"
            placeholder="dessert, quick, vegetarian"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-gray-500">Comma-separated</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="wantToMake" />
          Want to make
        </label>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Save recipe
        </button>
      </form>
    </main>
  );
}
