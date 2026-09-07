import { afterEach, describe, expect, it, vi } from "vitest";

import { captureFromWebUrl, isInstagramUrl } from "./capture";

function htmlResponse(html: string, ok = true) {
  return { ok, text: async () => html } as Response;
}

function pageWithJsonLd(json: unknown, { quoted = true } = {}) {
  const attr = quoted ? 'type="application/ld+json"' : "type=application/ld+json";
  return `<!doctype html><html><head><script ${attr}>${JSON.stringify(json)}</script></head><body></body></html>`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isInstagramUrl", () => {
  it("matches instagram hosts", () => {
    expect(isInstagramUrl("https://www.instagram.com/p/abc/")).toBe(true);
    expect(isInstagramUrl("https://instagram.com/reel/xyz")).toBe(true);
  });
  it("rejects other hosts and junk", () => {
    expect(isInstagramUrl("https://example.com/recipe")).toBe(false);
    expect(isInstagramUrl("not a url")).toBe(false);
  });
});

describe("captureFromWebUrl", () => {
  it("extracts a plain Recipe node", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(
          pageWithJsonLd({
            "@type": "Recipe",
            name: "Test Brownies",
            recipeIngredient: ["120ml olive oil", "200g sugar"],
            recipeInstructions: "Mix. Bake.",
            image: "https://example.com/b.jpg",
          }),
        ),
      ),
    );

    const result = await captureFromWebUrl("https://example.com/brownies");
    expect(result).toEqual({
      title: "Test Brownies",
      ingredients: "120ml olive oil\n200g sugar",
      steps: "Mix. Bake.",
      notes: undefined,
      imageUrl: "https://example.com/b.jpg",
    });
  });

  it("finds a Recipe nested in @graph", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(
          pageWithJsonLd({
            "@graph": [
              { "@type": "WebSite", name: "Some Blog" },
              { "@type": ["Recipe"], name: "Graph Recipe", recipeIngredient: ["1 egg"] },
            ],
          }),
        ),
      ),
    );

    const result = await captureFromWebUrl("https://example.com/x");
    expect(result?.title).toBe("Graph Recipe");
    expect(result?.ingredients).toBe("1 egg");
  });

  it("parses an unquoted ld+json type attribute", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(
          pageWithJsonLd(
            { "@type": "Recipe", name: "Unquoted", recipeIngredient: ["flour"] },
            { quoted: false },
          ),
        ),
      ),
    );

    const result = await captureFromWebUrl("https://example.com/x");
    expect(result?.title).toBe("Unquoted");
  });

  it("decodes HTML entities in text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(
          pageWithJsonLd({
            "@type": "Recipe",
            name: "Quick &amp; Easy Muffins",
            recipeIngredient: ["1 cup flour (spooned &amp; leveled)"],
          }),
        ),
      ),
    );

    const result = await captureFromWebUrl("https://example.com/x");
    expect(result?.title).toBe("Quick & Easy Muffins");
    expect(result?.ingredients).toBe("1 cup flour (spooned & leveled)");
  });

  it("flattens HowToStep instruction objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(
          pageWithJsonLd({
            "@type": "Recipe",
            name: "Steps",
            recipeInstructions: [
              { "@type": "HowToStep", text: "Preheat oven" },
              { "@type": "HowToStep", text: "Combine dry ingredients" },
            ],
          }),
        ),
      ),
    );

    const result = await captureFromWebUrl("https://example.com/x");
    expect(result?.steps).toBe("Preheat oven\nCombine dry ingredients");
  });

  it("returns null when there is no Recipe node", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(pageWithJsonLd({ "@type": "WebPage", name: "Not a recipe" })),
      ),
    );
    expect(await captureFromWebUrl("https://example.com/x")).toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse("", false)));
    expect(await captureFromWebUrl("https://example.com/x")).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await captureFromWebUrl("https://example.com/x")).toBeNull();
  });
});
