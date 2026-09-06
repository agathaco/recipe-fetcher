import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RecipeFields } from "@/components/recipe-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { updateRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  // Binding `id` in a Server Component produces a Server Action reference with
  // `id` already attached. No client JS needed.
  const updateThisRecipe = updateRecipe.bind(null, id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link
        href={`/recipes/${id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Back to recipe
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Edit recipe</h1>

      <form action={updateThisRecipe} className="mt-6">
        <Card className="[--card-spacing:--spacing(6)]">
          <CardContent>
            <RecipeFields
              defaults={{
                title: recipe.title,
                sourceUrl: recipe.sourceUrl ?? undefined,
                ingredients: recipe.ingredients ?? undefined,
                steps: recipe.steps ?? undefined,
                notes: recipe.notes ?? undefined,
                tags: recipe.tags.join(", "),
                wantToMake: recipe.wantToMake,
              }}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit">Save changes</Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}
