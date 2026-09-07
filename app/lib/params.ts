// Next gives searchParams values as string | string[] | undefined. Most of the
// time we want the single-string case and ignore the rest.
export function param(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}
