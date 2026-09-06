import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WantToMakeToggle } from "@/app/components/want-to-make-toggle";
import { badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  return { title: recipe ? recipe.title : "Recipe not found" };
}

function lines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  const deleteThisRecipe = deleteRecipe.bind(null, recipe.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        All recipes
      </Link>

      {recipe.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external, not worth optimizing
        <img
          src={recipe.imageUrl}
          alt=""
          className="mt-4 max-h-72 w-full rounded-lg object-cover"
        />
      )}

      <div className="mt-4 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil />
            Edit
          </Link>
          <form action={deleteThisRecipe}>
            <Button type="submit" variant="destructive" size="sm">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <WantToMakeToggle recipeId={recipe.id} initialValue={recipe.wantToMake} />
        {recipe.tags.map((tag) => (
          <Link
            key={tag}
            href={`/?tag=${encodeURIComponent(tag)}`}
            className={badgeVariants({ variant: "secondary" })}
          >
            {tag}
          </Link>
        ))}
      </div>

      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-sm"
        >
          <ExternalLink className="size-3.5" />
          {recipe.sourceType ? `Source (${recipe.sourceType})` : "Source"}
        </a>
      )}

      {recipe.ingredients && (
        <section className="mt-8">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Ingredients
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {lines(recipe.ingredients).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps && (
        <section className="mt-8">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Steps
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
            {lines(recipe.steps).map((line, i) => (
              <li key={i} className="pl-1">
                {line}
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.notes && (
        <section className="mt-8">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Notes
          </h2>
          <p className="mt-2 text-sm whitespace-pre-line">{recipe.notes}</p>
        </section>
      )}
    </main>
  );
}
