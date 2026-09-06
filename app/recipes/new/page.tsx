import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { RecipeFields } from "@/components/recipe-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createRecipe, importFromUrl } from "@/app/lib/actions";

export const metadata = { title: "Add a recipe" };
export const dynamic = "force-dynamic";

function field(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const importFailed = field(params.importFailed) === "1";
  const imageUrl = field(params.imageUrl);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        All recipes
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Add a recipe</h1>

      {/* Fetches server-side, then redirects back here with what it found as
          query params. Separate Server Action from the save form below. */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Import from a link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={importFromUrl} className="flex gap-2">
            <Input
              name="importUrl"
              type="url"
              placeholder="Paste a recipe or Instagram URL"
              autoComplete="off"
            />
            <Button type="submit" variant="secondary">
              Fetch
            </Button>
          </form>
          {importFailed && (
            <p className="text-destructive text-sm">
              Couldn&apos;t find a recipe at that link. Fill it in below instead.
            </p>
          )}
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external preview only
            <img src={imageUrl} alt="" className="size-28 rounded-md object-cover" />
          )}
        </CardContent>
      </Card>

      {/* Plain form + Server Action: submits even with JS disabled. */}
      <form action={createRecipe} className="mt-6">
        <Card className="[--card-spacing:--spacing(6)]">
          <CardContent>
            <input type="hidden" name="sourceType" value={field(params.sourceType) ?? "manual"} />
            <input type="hidden" name="imageUrl" value={imageUrl ?? ""} />
            <RecipeFields
              defaults={{
                title: field(params.title),
                sourceUrl: field(params.sourceUrl),
                ingredients: field(params.ingredients),
                steps: field(params.steps),
                notes: field(params.notes),
              }}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit">Save recipe</Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}
