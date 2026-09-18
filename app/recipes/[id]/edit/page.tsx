import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RecipeForm } from "@/components/recipe-form";
import { updateRecipe } from "@/app/lib/actions";
import { getAllTagNames, getRecipeById } from "@/app/lib/data";
import { requireCurrentUser } from "@/app/lib/session";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const [recipe, allTags] = await Promise.all([
    getRecipeById(id, user.id),
    getAllTagNames(user.id),
  ]);
  if (!recipe) notFound();

  // Binding `id` in a Server Component produces a Server Action reference with
  // `id` already attached; the form supplies the (prevState, formData) pair.
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

      <RecipeForm
        action={updateThisRecipe}
        allTags={allTags}
        submitLabel="Save changes"
        defaults={{
          title: recipe.title,
          sourceUrl: recipe.sourceUrl ?? undefined,
          imageUrl: recipe.imageUrl ?? undefined,
          ingredients: recipe.ingredients ?? undefined,
          steps: recipe.steps ?? undefined,
          notes: recipe.notes ?? undefined,
          tags: recipe.tags,
          wantToMake: recipe.wantToMake,
          prepTime: recipe.prepTime ?? undefined,
          cookTime: recipe.cookTime ?? undefined,
          ovenTemp: recipe.ovenTemp ?? undefined,
        }}
      />
    </main>
  );
}
