export function slugify(input: string): string {
  return input
    .normalize("NFKD") // split accented characters into base + accent marks
    .replace(/[\u0300-\u036f]/g, "") // drop the accent marks, keep the base letter
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // drop anything that isn't a letter, number, space, or hyphen
    .replace(/[\s-]+/g, "-") // collapse spaces/hyphens into a single hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}