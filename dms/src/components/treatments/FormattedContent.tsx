"use client";

import React, { useMemo } from "react";

interface FormattedContentProps {
  content?: string | null;
  className?: string;
}

/**
 * Checks if a string contains HTML markup tags.
 */
function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

/**
 * Parses inline formatting tags inside a markdown or plain string:
 * - **bold** or <b>bold</b> or <strong>bold</strong>
 * - *italic* or _italic_ or <i>italic</i> or <em>italic</em>
 * - <u>underline</u>
 * - ~~strikethrough~~ or <s>strikethrough</s>
 * - ==highlight== or <mark>highlight</mark>
 * - [size=xs|sm|base|lg|xl|2xl]text[/size]
 * - `code`
 */
function parseInline(text: string): React.ReactNode[] {
  if (!text) return [];

  const regex =
    /(\*\*(.+?)\*\*|__(.+?)__|<b>(.+?)<\/b>|<strong>(.+?)<\/strong>|\*(.+?)\*|_(.+?)_|<i>(.+?)<\/i>|<em>(.+?)<\/em>|<u>(.+?)<\/u>|~~(.+?)~~|<s>(.+?)<\/s>|==(.+?)==|<mark>(.+?)<\/mark>|\[size=(xs|sm|base|lg|xl|2xl)\]([\s\S]*?)\[\/size\]|`([^`]+)`)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;

    if (matchStart > lastIndex) {
      elements.push(text.slice(lastIndex, matchStart));
    }

    const full = match[0];

    // Bold
    if (
      (full.startsWith("**") && full.endsWith("**")) ||
      (full.startsWith("__") && full.endsWith("__"))
    ) {
      const inner = full.slice(2, -2);
      elements.push(
        <strong key={matchStart} className="font-bold text-slate-900">
          {parseInline(inner)}
        </strong>
      );
    } else if (full.startsWith("<b>") && full.endsWith("</b>")) {
      const inner = full.slice(3, -4);
      elements.push(
        <strong key={matchStart} className="font-bold text-slate-900">
          {parseInline(inner)}
        </strong>
      );
    } else if (full.startsWith("<strong>") && full.endsWith("</strong>")) {
      const inner = full.slice(8, -9);
      elements.push(
        <strong key={matchStart} className="font-bold text-slate-900">
          {parseInline(inner)}
        </strong>
      );
    }
    // Size tag: [size=lg]...[/size]
    else if (full.startsWith("[size=")) {
      const sizeType = match[17];
      const inner = match[18];
      const sizeClasses: Record<string, string> = {
        xs: "text-[0.75rem]",
        sm: "text-[0.825rem]",
        base: "text-[0.9rem]",
        lg: "text-[1.05rem] font-medium text-slate-900",
        xl: "text-[1.25rem] font-bold text-slate-900",
        "2xl": "text-[1.45rem] font-extrabold text-slate-900",
      };
      const cls = sizeClasses[sizeType] || "text-[0.9rem]";
      elements.push(
        <span key={matchStart} className={cls}>
          {parseInline(inner)}
        </span>
      );
    }
    // Highlight
    else if (full.startsWith("==") && full.endsWith("==")) {
      const inner = full.slice(2, -2);
      elements.push(
        <mark
          key={matchStart}
          className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-900"
        >
          {parseInline(inner)}
        </mark>
      );
    } else if (full.startsWith("<mark>") && full.endsWith("</mark>")) {
      const inner = full.slice(6, -7);
      elements.push(
        <mark
          key={matchStart}
          className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-900"
        >
          {parseInline(inner)}
        </mark>
      );
    }
    // Underline
    else if (full.startsWith("<u>") && full.endsWith("</u>")) {
      const inner = full.slice(3, -4);
      elements.push(
        <span key={matchStart} className="underline underline-offset-2 decoration-slate-400">
          {parseInline(inner)}
        </span>
      );
    }
    // Strikethrough
    else if (
      (full.startsWith("~~") && full.endsWith("~~")) ||
      (full.startsWith("<s>") && full.endsWith("</s>"))
    ) {
      const inner = full.startsWith("~~") ? full.slice(2, -2) : full.slice(3, -4);
      elements.push(
        <span key={matchStart} className="line-through text-slate-400">
          {parseInline(inner)}
        </span>
      );
    }
    // Inline code
    else if (full.startsWith("`") && full.endsWith("`")) {
      const inner = full.slice(1, -1);
      elements.push(
        <code
          key={matchStart}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.8rem] text-slate-800 border border-slate-200"
        >
          {inner}
        </code>
      );
    }
    // Italic
    else if (
      (full.startsWith("*") && full.endsWith("*")) ||
      (full.startsWith("_") && full.endsWith("_"))
    ) {
      const inner = full.slice(1, -1);
      elements.push(
        <em key={matchStart} className="italic text-slate-700">
          {parseInline(inner)}
        </em>
      );
    } else if (
      (full.startsWith("<i>") && full.endsWith("</i>")) ||
      (full.startsWith("<em>") && full.endsWith("</em>"))
    ) {
      const inner = full.startsWith("<i>") ? full.slice(3, -4) : full.slice(4, -5);
      elements.push(
        <em key={matchStart} className="italic text-slate-700">
          {parseInline(inner)}
        </em>
      );
    } else {
      elements.push(full);
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

export function FormattedContent({ content, className = "" }: FormattedContentProps) {
  const isRichHtml = useMemo(() => {
    if (!content || typeof content !== "string") return false;
    return isHtml(content);
  }, [content]);

  const parsedMarkdownBlocks = useMemo(() => {
    if (!content || typeof content !== "string" || !content.trim() || isRichHtml) {
      return null;
    }

    const lines = content.split("\n");
    const blocks: React.ReactNode[] = [];
    let currentList: { type: "bullet" | "number"; items: string[] } | null = null;

    const flushList = (keyPrefix: number) => {
      if (!currentList) return;
      if (currentList.type === "bullet") {
        blocks.push(
          <ul key={`ul-${keyPrefix}`} className="my-1.5 space-y-1 pl-1">
            {currentList.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7da3b3]" />
                <span className="flex-1 leading-relaxed">{parseInline(it)}</span>
              </li>
            ))}
          </ul>
        );
      } else {
        blocks.push(
          <ol key={`ol-${keyPrefix}`} className="my-1.5 space-y-1 pl-1">
            {currentList.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.75rem] font-semibold text-slate-600">
                  {i + 1}
                </span>
                <span className="flex-1 leading-relaxed pt-0.5">{parseInline(it)}</span>
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushList(idx);
        blocks.push(<div key={`blank-${idx}`} className="h-2" />);
        return;
      }

      if (line.startsWith("# ")) {
        flushList(idx);
        blocks.push(
          <h1
            key={`h1-${idx}`}
            className="mt-3 mb-1.5 text-lg font-bold text-slate-900 border-b border-slate-100 pb-1"
          >
            {parseInline(line.slice(2))}
          </h1>
        );
        return;
      }
      if (line.startsWith("## ")) {
        flushList(idx);
        blocks.push(
          <h2
            key={`h2-${idx}`}
            className="mt-2.5 mb-1 text-[1.05rem] font-semibold text-slate-900"
          >
            {parseInline(line.slice(3))}
          </h2>
        );
        return;
      }
      if (line.startsWith("### ")) {
        flushList(idx);
        blocks.push(
          <h3
            key={`h3-${idx}`}
            className="mt-2 mb-0.5 text-[0.95rem] font-semibold text-slate-800"
          >
            {parseInline(line.slice(4))}
          </h3>
        );
        return;
      }
      if (line.startsWith("#### ")) {
        flushList(idx);
        blocks.push(
          <h4
            key={`h4-${idx}`}
            className="mt-1.5 mb-0.5 text-[0.85rem] font-semibold uppercase tracking-wider text-slate-700"
          >
            {parseInline(line.slice(5))}
          </h4>
        );
        return;
      }

      if (line.startsWith("> ") || line.startsWith(">")) {
        flushList(idx);
        const quoteText = line.startsWith("> ") ? line.slice(2) : line.slice(1);
        blocks.push(
          <div
            key={`quote-${idx}`}
            className="my-1.5 rounded-r-xl border-l-3 border-[#7da3b3] bg-slate-50/80 px-3 py-2 text-[0.85rem] text-slate-700 italic"
          >
            {parseInline(quoteText)}
          </div>
        );
        return;
      }

      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        flushList(idx);
        blocks.push(<hr key={`hr-${idx}`} className="my-2 border-slate-200" />);
        return;
      }

      const bulletMatch = line.match(/^(\s*)([-*•])\s+(.+)$/);
      if (bulletMatch) {
        const itemText = bulletMatch[3];
        if (currentList && currentList.type === "bullet") {
          currentList.items.push(itemText);
        } else {
          flushList(idx);
          currentList = { type: "bullet", items: [itemText] };
        }
        return;
      }

      const numMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (numMatch) {
        const itemText = numMatch[3];
        if (currentList && currentList.type === "number") {
          currentList.items.push(itemText);
        } else {
          flushList(idx);
          currentList = { type: "number", items: [itemText] };
        }
        return;
      }

      flushList(idx);
      blocks.push(
        <p key={`p-${idx}`} className="leading-relaxed text-slate-700">
          {parseInline(line)}
        </p>
      );
    });

    flushList(lines.length);
    return blocks;
  }, [content, isRichHtml]);

  if (!content || !content.trim() || content === "<p><br></p>" || content === "<br>") {
    return <span className="text-slate-400 italic">None provided</span>;
  }

  // Render rich HTML directly with beautiful typography
  if (isRichHtml) {
    return (
      <div
        className={`formatted-content text-[0.875rem] leading-relaxed text-slate-700 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mt-2.5 [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_strong]:font-bold [&_strong]:text-slate-900 [&_b]:font-bold [&_b]:text-slate-900 [&_em]:italic [&_i]:italic [&_u]:underline [&_u]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_blockquote]:border-l-3 [&_blockquote]:border-[#7da3b3] [&_blockquote]:bg-slate-50/80 [&_blockquote]:pl-3 [&_blockquote]:py-1.5 [&_blockquote]:my-1.5 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_mark]:bg-amber-100 [&_mark]:px-1 [&_mark]:rounded [&_p]:my-0.5 ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className={`formatted-content text-[0.875rem] leading-relaxed text-slate-700 space-y-1 ${className}`}>
      {parsedMarkdownBlocks}
    </div>
  );
}
