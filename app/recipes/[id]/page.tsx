import { ArrowLeft, Clock, ExternalLink, Flame, Pencil, Thermometer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteRecipeButton } from "@/app/components/delete-recipe-button";
import { PhotoGallery } from "@/app/components/photo-gallery";
import { RatingStars } from "@/app/components/rating-stars";
import { WantToMakeToggle } from "@/app/components/want-to-make-toggle";
import { cn } from "cn";
import { RecipeChecklist } from "@/components/recipe-checklist";
import { tagColorClasses } from "@/components/tag-pill";
import { buttonVariants } from "@/components/ui/button";
import { deleteRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";

// The link text should read as "the site this came from", not the literal
// word "Source" or the internal sourceType label. Hostname minus "www." is
// the simplest honest version of that, no curated site-name list to maintain.
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

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
          <DeleteRecipeButton action={deleteThisRecipe} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <WantToMakeToggle recipeId={recipe.id} initialValue={recipe.wantToMake} />
        <RatingStars recipeId={recipe.id} initialValue={recipe.rating ?? 0} />
      </div>

      {(recipe.prepTime || recipe.cookTime || recipe.ovenTemp) && (
        <div className="bg-primary/10 mt-4 flex flex-wrap gap-x-6 gap-y-3 rounded-lg px-4 py-3">
          {recipe.prepTime && (
            <div className="flex items-center gap-2">
              <Clock className="text-primary size-4 shrink-0" />
              <div className="leading-tight">
                <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Prep
                </div>
                <div className="text-sm font-medium">{recipe.prepTime}</div>
              </div>
            </div>
          )}
          {recipe.cookTime && (
            <div className="flex items-center gap-2">
              <Flame className="text-primary size-4 shrink-0" />
              <div className="leading-tight">
                <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Cook
                </div>
                <div className="text-sm font-medium">{recipe.cookTime}</div>
              </div>
            </div>
          )}
          {recipe.ovenTemp && (
            <div className="flex items-center gap-2">
              <Thermometer className="text-primary size-4 shrink-0" />
              <div className="leading-tight">
                <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Oven
                </div>
                <div className="text-sm font-medium">{recipe.ovenTemp}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.tags.map((tag) => (
            <Link
              key={tag}
              href={`/?tag=${encodeURIComponent(tag)}`}
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium transition hover:opacity-80",
                tagColorClasses(tag),
              )}
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-sm"
        >
          <ExternalLink className="size-3.5" />
          {hostnameOf(recipe.sourceUrl)}
        </a>
      )}

      {recipe.ingredients && (
        <section className="mt-8">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Ingredients
          </h2>
          <RecipeChecklist
            items={lines(recipe.ingredients)}
            storageKey={`checklist:${recipe.id}:ingredients`}
          />
        </section>
      )}

      {recipe.steps && (
        <section className="mt-8">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Steps
          </h2>
          <RecipeChecklist
            items={lines(recipe.steps)}
            storageKey={`checklist:${recipe.id}:steps`}
            ordered
          />
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

      <section className="mt-8">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Photos
        </h2>
        <PhotoGallery recipeId={recipe.id} images={recipe.images} />
      </section>
    </main>
  );
}
