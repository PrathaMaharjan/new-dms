/**
 * Utility functions for converting and sanitizing Rich Text (HTML), Markdown, and Plain Text.
 */

/**
 * Decodes standard HTML entities.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&bull;/gi, "•");
}

/**
 * Checks if a string contains HTML markup tags.
 */
export function isHtmlString(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  return /<[a-z][\s\S]*>/i.test(str);
}

/**
 * Converts any input (Markdown or existing HTML) to clean, valid Semantic HTML.
 * Produces clean <p>, <strong>, <em>, <ul><li>, <ol><li>, <h3>, <blockquote>
 * without messy editor artifacts or bloated styles.
 */
export function toSemanticHtml(input?: string | null): string {
  if (!input || typeof input !== "string") return "";

  let trimmed = input.trim();
  if (
    !trimmed ||
    trimmed === "<p><br></p>" ||
    trimmed === "<br>" ||
    trimmed === "<div><br></div>" ||
    trimmed === "<p></p>" ||
    trimmed === "<div></div>"
  ) {
    return "";
  }

  // If input already has HTML tags, sanitize and clean it up
  if (isHtmlString(trimmed)) {
    let clean = trimmed;
    // Replace empty breaks
    clean = clean.replace(/<p><br\s*\/?><\/p>/gi, "");
    clean = clean.replace(/<div><br\s*\/?><\/div>/gi, "");
    // Normalize tags
    clean = clean.replace(/<b>/gi, "<strong>").replace(/<\/b>/gi, "</strong>");
    clean = clean.replace(/<i>/gi, "<em>").replace(/<\/i>/gi, "</em>");
    // Strip unnecessary inline style attributes except basic colors/highlight
    clean = clean.replace(/\s*style="(?!(background-color|color))[^"]*"/gi, "");
    return clean.trim();
  }

  // If it's Markdown or plain text, convert to semantic HTML
  const lines = trimmed.split("\n");
  const htmlBlocks: string[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (!currentList) return;
    if (currentList.type === "ul") {
      htmlBlocks.push(`<ul>${currentList.items.map((it) => `<li>${formatInlineMarkdownToHtml(it)}</li>`).join("")}</ul>`);
    } else {
      htmlBlocks.push(`<ol>${currentList.items.map((it) => `<li>${formatInlineMarkdownToHtml(it)}</li>`).join("")}</ol>`);
    }
    currentList = null;
  };

  lines.forEach((line) => {
    const l = line.trim();

    if (!l) {
      flushList();
      return;
    }

    if (l.startsWith("# ")) {
      flushList();
      htmlBlocks.push(`<h1>${formatInlineMarkdownToHtml(l.slice(2))}</h1>`);
      return;
    }
    if (l.startsWith("## ")) {
      flushList();
      htmlBlocks.push(`<h2>${formatInlineMarkdownToHtml(l.slice(3))}</h2>`);
      return;
    }
    if (l.startsWith("### ") || l.startsWith("#### ")) {
      flushList();
      const textAfter = l.startsWith("#### ") ? l.slice(5) : l.slice(4);
      htmlBlocks.push(`<h3>${formatInlineMarkdownToHtml(textAfter)}</h3>`);
      return;
    }

    if (l.startsWith("> ") || l.startsWith(">")) {
      flushList();
      const quoteText = l.startsWith("> ") ? l.slice(2) : l.slice(1);
      htmlBlocks.push(`<blockquote>${formatInlineMarkdownToHtml(quoteText)}</blockquote>`);
      return;
    }

    // Bullet list: - item, * item, • item
    const bulletMatch = l.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (currentList && currentList.type === "ul") {
        currentList.items.push(bulletMatch[1]);
      } else {
        flushList();
        currentList = { type: "ul", items: [bulletMatch[1]] };
      }
      return;
    }

    // Numbered list: 1. item
    const numMatch = l.match(/^\d+\.\s+(.+)$/);
    if (numMatch) {
      if (currentList && currentList.type === "ol") {
        currentList.items.push(numMatch[1]);
      } else {
        flushList();
        currentList = { type: "ol", items: [numMatch[1]] };
      }
      return;
    }

    flushList();
    htmlBlocks.push(`<p>${formatInlineMarkdownToHtml(l)}</p>`);
  });

  flushList();
  return htmlBlocks.join("");
}

/**
 * Formats inline markdown tags (**bold**, *italic*, ==mark==, ~~strike~~) into semantic HTML.
 */
function formatInlineMarkdownToHtml(text: string): string {
  if (!text) return "";
  let res = text;
  // Bold
  res = res.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  res = res.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic
  res = res.replace(/\*(.+?)\*/g, "<em>$1</em>");
  res = res.replace(/_(.+?)_/g, "<em>$1</em>");
  // Strikethrough
  res = res.replace(/~~(.+?)~~/g, "<s>$1</s>");
  // Highlight
  res = res.replace(/==(.+?)==/g, "<mark>$1</mark>");
  return res;
}

/**
 * Converts HTML into clean Markdown.
 */
export function htmlToCleanMarkdown(html: string): string {
  if (!html || typeof html !== "string") return "";

  let clean = html.trim();
  if (
    clean === "<p><br></p>" ||
    clean === "<br>" ||
    clean === "<div><br></div>" ||
    clean === "<p></p>" ||
    clean === "<div></div>"
  ) {
    return "";
  }

  if (!isHtmlString(clean)) {
    return clean;
  }

  // Replace line breaks and empty block elements
  clean = clean.replace(/<p><br\s*\/?><\/p>/gi, "\n\n");
  clean = clean.replace(/<div><br\s*\/?><\/div>/gi, "\n");
  clean = clean.replace(/<br\s*\/?>/gi, "\n");

  // Headings
  clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, text) => `\n# ${text.trim()}\n`);
  clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, text) => `\n## ${text.trim()}\n`);
  clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, text) => `\n### ${text.trim()}\n`);
  clean = clean.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, (_, text) => `\n### ${text.trim()}\n`);

  // Blockquotes
  clean = clean.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text) => `\n> ${text.trim()}\n`);

  // Lists
  clean = clean.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, listContent) => {
    const items: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = liRegex.exec(listContent)) !== null) {
      const itemText = match[1].trim();
      if (itemText && itemText !== "<br>") {
        items.push(`- ${itemText}`);
      }
    }
    return `\n${items.join("\n")}\n`;
  });

  clean = clean.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, listContent) => {
    const items: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    let count = 1;
    while ((match = liRegex.exec(listContent)) !== null) {
      const itemText = match[1].trim();
      if (itemText && itemText !== "<br>") {
        items.push(`${count}. ${itemText}`);
        count++;
      }
    }
    return `\n${items.join("\n")}\n`;
  });

  clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => `- ${text.trim()}\n`);

  // Inline formatting
  clean = clean.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text) => `**${text.trim()}**`);
  clean = clean.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text) => `*${text.trim()}*`);
  clean = clean.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, (_, text) => `==${text.trim()}==`);
  clean = clean.replace(/<(s|strike|del)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text) => `~~${text.trim()}~~`);
  clean = clean.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, (_, text) => `<u>${text.trim()}</u>`);

  // Paragraphs and Divs to newlines
  clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => `\n${text.trim()}\n`);
  clean = clean.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_, text) => `\n${text.trim()}\n`);

  // Strip any remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, "");

  // Decode entities
  clean = decodeHtmlEntities(clean);

  // Normalize newlines
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();

  return clean;
}

/**
 * Pure plain text without any HTML tags or markdown symbols (** or #).
 */
export function toCleanPlainText(input?: string | null): string {
  if (!input || typeof input !== "string") return "";
  const md = htmlToCleanMarkdown(input);
  return md
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/==(.*?)==/g, "$1")
    .replace(/<u>(.*?)<\/u>/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .trim();
}

export const markdownToHtml = toSemanticHtml;
export const cleanToPlainText = toCleanPlainText;
