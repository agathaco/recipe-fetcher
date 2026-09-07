import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { RecipeForm } from "@/components/recipe-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createRecipe, importFromUrl } from "@/app/lib/actions";
import { getAllTagNames } from "@/app/lib/data";
import { param } from "@/app/lib/params";

export const metadata = { title: "Add a recipe" };
export const dynamic = "force-dynamic";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const importFailed = param(params.importFailed) === "1";
  const imageUrl = param(params.imageUrl);
  const allTags = await getAllTagNames();

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
        </CardContent>
      </Card>

      <RecipeForm
        action={createRecipe}
        allTags={allTags}
        submitLabel="Save recipe"
        sourceType={param(params.sourceType) ?? "manual"}
        defaults={{
          title: param(params.title),
          sourceUrl: param(params.sourceUrl),
          imageUrl,
          ingredients: param(params.ingredients),
          steps: param(params.steps),
          notes: param(params.notes),
        }}
      />
    </main>
  );
}
