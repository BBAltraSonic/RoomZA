const MARKDOWN_PUNCTUATION = /[`*_>#\[\]()!|~-]/g;

export function createBlogSlug(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function calculateReadingMinutes(markdown: string) {
  const words = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(MARKDOWN_PUNCTUATION, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 200));
}

export function formatBlogDate(value: string | null) {
  if (!value) return "Not published";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function isAllowedBlogImageUrl(value: string) {
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname.includes("/storage/v1/object/public/blog-media/");
  } catch {
    return false;
  }
}

export function transformBlogMarkdownUrl(url: string, key: string) {
  if (key === "src") return isAllowedBlogImageUrl(url) ? url : "";
  if (url.startsWith("/") || url.startsWith("#")) return url;
  try {
    const parsed = new URL(url);
    return ["https:", "http:", "mailto:"].includes(parsed.protocol) ? url : "";
  } catch {
    return "";
  }
}
