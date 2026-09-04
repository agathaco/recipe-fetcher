// Server-side recipe capture. Two independent attempts, each allowed to fail
// quietly: a bad site, a dead link, or a locked-down oEmbed endpoint should
// never crash the page, only mean "the form comes up empty, paste it yourself."

type CapturedRecipe = {
  title?: string;
  ingredients?: string;
  steps?: string;
  notes?: string;
  imageUrl?: string;
};

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  // Attribute quoting is inconsistent in the wild (some sites, notably
  // WordPress/Yoast, emit type=application/ld+json with no quotes at all),
  // so quotes around the type value are optional here.
  const scriptTag = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptTag.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // one malformed script tag on the page; skip it, keep looking
    }
  }
  return blocks;
}

// Recipe JSON-LD can be a single object, an array of objects, or nested
// under an "@graph" array (common when a page also declares its own
// Organization/WebSite schema alongside the recipe).
function findRecipeNode(nodes: unknown[]): Record<string, unknown> | null {
  for (const node of nodes) {
    const candidates = Array.isArray(node) ? node : [node];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      const record = candidate as Record<string, unknown>;
      const graph = record["@graph"];
      if (Array.isArray(graph)) {
        const found = findRecipeNode(graph);
        if (found) return found;
      }
      const type = record["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (types.includes("Recipe")) return record;
    }
  }
  return null;
}

// recipeIngredient is a string array. recipeInstructions varies a lot in
// practice: a plain string, an array of strings, or an array of HowToStep
// objects with a "text" field. Flatten whatever shape shows up to one
// newline-separated block, matching how ingredients/steps are stored.
function toLines(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return (obj.text as string) ?? (obj.name as string) ?? "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function firstImageUrl(image: unknown): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return firstImageUrl(image[0]);
  if (typeof image === "object") return (image as Record<string, unknown>).url as string;
  return undefined;
}

export async function captureFromWebUrl(url: string): Promise<CapturedRecipe | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; recipe-fetcher/0.1)" },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const recipe = findRecipeNode(extractJsonLdBlocks(html));
    if (!recipe) return null;

    return {
      title: typeof recipe.name === "string" ? recipe.name : undefined,
      ingredients: toLines(recipe.recipeIngredient) || undefined,
      steps: toLines(recipe.recipeInstructions) || undefined,
      notes: typeof recipe.description === "string" ? recipe.description : undefined,
      imageUrl: firstImageUrl(recipe.image),
    };
  } catch {
    // network error, timeout, non-HTML response, the site blocked us, etc.
    return null;
  }
}

export async function captureFromInstagramUrl(url: string): Promise<CapturedRecipe | null> {
  try {
    // Instagram's public oEmbed access has been restricted for years and
    // commonly requires an approved app token. This is left calling the
    // plain endpoint on purpose: it is expected to fail more often than not,
    // which is exactly the case the fallback ladder exists for.
    const res = await fetch(`https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;

    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    const caption = data.title;

    return {
      title: caption ? caption.slice(0, 80) : undefined,
      notes: caption,
      imageUrl: data.thumbnail_url,
    };
  } catch {
    return null;
  }
}

export function isInstagramUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes("instagram.com");
  } catch {
    return false;
  }
}
