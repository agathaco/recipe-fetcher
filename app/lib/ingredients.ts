// Best-effort parser for one freeform ingredient line ("2 cups flour") into
// {quantity, unit, name}. Not an NLP parser, deliberately: a small ordered
// set of rules that gets the common cases right and leaves anything it can't
// confidently read as plain `name`, same "automate the easy case, don't
// guess the hard one" shape as app/lib/capture.ts's JSON-LD parsing.

export type ParsedIngredient = {
  quantity: number | null;
  unit: string | null;
  name: string;
};

// Real, convertible measurement units. Phase 3's unit converter only ever
// converts between members of this set; anything else (a COUNT_WORDS match,
// or no unit at all) passes through unconverted.
const MEASURE_UNITS: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
};

// Informal count words: real recipes lean on these constantly ("2 cloves
// garlic", "1 stick butter", "a pinch of salt"), but none of them convert to
// anything, they're just a counted unit. Kept in a separate dictionary from
// MEASURE_UNITS so Phase 3's converter never mistakes one for a real
// measurement, name extraction still benefits from recognising them.
const COUNT_WORDS: Record<string, string> = {
  clove: "clove",
  cloves: "clove",
  pinch: "pinch",
  pinches: "pinch",
  stick: "stick",
  sticks: "stick",
  slice: "slice",
  slices: "slice",
  can: "can",
  cans: "can",
  tin: "tin",
  tins: "tin",
  packet: "packet",
  packets: "packet",
  bunch: "bunch",
  bunches: "bunch",
  piece: "piece",
  pieces: "piece",
};

const UNIT_WORDS: Record<string, string> = { ...MEASURE_UNITS, ...COUNT_WORDS };

// A leading quantity, tried in order: a mixed number ("1 1/2"), a simple
// fraction ("1/2"), or a plain integer/decimal ("2" / "2.5"). Mixed has to
// come first in the alternation, regex tries alternatives left-to-right and
// stops at the first match, not the longest, so "1 1/2" would otherwise only
// ever match its leading "1".
const QUANTITY_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*/;

function parseQuantity(match: string): number {
  const mixed = match.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const [, whole, num, den] = mixed;
    return Number(whole) + Number(num) / Number(den);
  }
  const fraction = match.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const [, num, den] = fraction;
    return Number(num) / Number(den);
  }
  return Number(match);
}

export function parseIngredientLine(raw: string): ParsedIngredient {
  let rest = raw.trim();
  let quantity: number | null = null;

  const quantityMatch = rest.match(QUANTITY_RE);
  if (quantityMatch) {
    quantity = parseQuantity(quantityMatch[1]);
    rest = rest.slice(quantityMatch[0].length);
  }

  // Tried whether or not a quantity matched: "pinch of salt" has no digit at
  // all, but still has a recognisable unit word right at the start.
  let unit: string | null = null;
  const unitMatch = rest.match(/^([a-zA-Z]+)\b\.?\s*/);
  if (unitMatch) {
    const word = unitMatch[1].toLowerCase();
    if (UNIT_WORDS[word]) {
      unit = UNIT_WORDS[word];
      rest = rest.slice(unitMatch[0].length);
    }
    // Not a recognised unit: leave it in `rest`, it's part of the name
    // ("2 ripe bananas", "2 garlic cloves" where the unit word trails the
    // noun instead of leading it, a real long-tail case this doesn't solve).
  }

  // "pinch of salt" -> unit already stripped to "pinch", drop the "of ".
  rest = rest.replace(/^of\s+/i, "");

  return { quantity, unit, name: rest.trim() };
}
