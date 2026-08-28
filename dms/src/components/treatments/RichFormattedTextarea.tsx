"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  ChevronDown,
  Type,
  Eraser,
} from "lucide-react";

import { htmlToCleanMarkdown, markdownToHtml } from "@/lib/formatters/richText";

interface RichFormattedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  icon?: React.ReactNode;
  required?: boolean;
  helperText?: string;
  className?: string;
  minHeight?: string;
}

export function RichFormattedTextarea({
  value,
  onChange,
  label,
  icon,
  required = false,
  helperText,
  className = "",
  minHeight = "7.5rem",
}: RichFormattedTextareaProps) {
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isInternalUpdate = useRef(false);

  // Synchronize incoming value from props to editor DOM (only when external changes happen)
  useEffect(() => {
    if (editorRef.current) {
      if (isInternalUpdate.current) {
        isInternalUpdate.current = false;
        return;
      }
      const currentClean = htmlToCleanMarkdown(editorRef.current.innerHTML);
      const incomingClean = htmlToCleanMarkdown(value || "");
      // If external value changed (e.g. modal open, form reset), update innerHTML
      if (currentClean !== incomingClean) {
        editorRef.current.innerHTML = markdownToHtml(value || "");
      }
    }
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSizeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    // Convert HTML to clean markdown / formatted text
    const cleanText = htmlToCleanMarkdown(html);
    isInternalUpdate.current = true;
    onChange(cleanText);
  }, [onChange]);

  const executeCommand = useCallback(
    (command: string, value: string | undefined = undefined) => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      document.execCommand(command, false, value);
      handleInput();
    },
    [handleInput]
  );

  const applyFontSizeSpan = useCallback(
    (fontSize: string, fontWeight?: string) => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (range.collapsed) {
        // If no text selected, format the block or insert a styled span
        executeCommand("fontSize", "3");
        return;
      }

      const span = document.createElement("span");
      span.style.fontSize = fontSize;
      if (fontWeight) span.style.fontWeight = fontWeight;

      try {
        const content = range.extractContents();
        span.appendChild(content);
        range.insertNode(span);

        // Select the newly wrapped node
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);
      } catch {
        executeCommand("fontSize", "4");
      }

      handleInput();
    },
    [executeCommand, handleInput]
  );

  const applyHighlight = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    // Try hiliteColor, fallback to backColor
    const success = document.execCommand("hiliteColor", false, "#fef08a");
    if (!success) {
      document.execCommand("backColor", false, "#fef08a");
    }
    handleInput();
  }, [handleInput]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Header with label */}
      {label && (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-700">
            {icon}
            {label}
            {required && <span className="text-rose-500">*</span>}
          </span>
        </div>
      )}

      {/* Editor Box */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs focus-within:border-[#7da3b3] focus-within:ring-1 focus-within:ring-[#7da3b3]/30 transition-all">
        {/* Formatting Toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-slate-600">
          {/* Text Size / Heading Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setSizeMenuOpen((prev) => !prev)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[0.75rem] font-medium text-slate-700 hover:bg-slate-200/70 transition-colors"
              title="Change Text Size or Heading"
            >
              <Type className="h-3.5 w-3.5 text-[#3f6274]" />
              <span>Text Size</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {sizeMenuOpen && (
              <div className="absolute left-0 top-8 z-30 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl text-[0.8rem]">
                <button
                  type="button"
                  onClick={() => {
                    executeCommand("formatBlock", "<h1>");
                    setSizeMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-bold text-slate-900 hover:bg-slate-50"
                >
                  <Heading1 className="h-4 w-4 text-[#3f6274]" />
                  <span>Heading 1 (Large)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    executeCommand("formatBlock", "<h2>");
                    setSizeMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Heading2 className="h-4 w-4 text-[#3f6274]" />
                  <span>Heading 2 (Medium)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    executeCommand("formatBlock", "<h3>");
                    setSizeMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Heading3 className="h-4 w-4 text-[#3f6274]" />
                  <span>Heading 3 (Small)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    executeCommand("formatBlock", "<p>");
                    setSizeMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-600 hover:bg-slate-50"
                >
                  <span className="text-[0.8rem] font-normal">¶</span>
                  <span>Normal Text</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    applyFontSizeSpan("1.35rem", "700");
                    setSizeMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                >
                  <span className="font-bold text-[0.95rem] text-[#3f6274]">A+</span>
                  <span>Extra Large Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    applyFontSizeSpan("1.15rem", "600");
                    setSizeMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                >
                  <span className="font-semibold text-[0.85rem]">A</span>
                  <span>Large Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    applyFontSizeSpan("0.8rem");
                    setSizeMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                >
                  <span className="text-[0.75rem] text-slate-500">A-</span>
                  <span>Small Text</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-[1px] bg-slate-200 mx-0.5" />

          {/* Bold */}
          <button
            type="button"
            onClick={() => executeCommand("bold")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => executeCommand("italic")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>

          {/* Underline */}
          <button
            type="button"
            onClick={() => executeCommand("underline")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>

          {/* Strikethrough */}
          <button
            type="button"
            onClick={() => executeCommand("strikeThrough")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>

          {/* Highlight */}
          <button
            type="button"
            onClick={applyHighlight}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-amber-100 hover:text-amber-800 transition-colors"
            title="Highlight text"
          >
            <Highlighter className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-0.5" />

          {/* Bullet List */}
          <button
            type="button"
            onClick={() => executeCommand("insertUnorderedList")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </button>

          {/* Numbered List */}
          <button
            type="button"
            onClick={() => executeCommand("insertOrderedList")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
            title="Numbered List"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>

          {/* Blockquote */}
          <button
            type="button"
            onClick={() => executeCommand("formatBlock", "<blockquote>")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
            title="Quote / Note"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>

          {/* Clear formatting */}
          <button
            type="button"
            onClick={() => executeCommand("removeFormat")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors ml-auto"
            title="Clear Formatting"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Live Visual WYSIWYG Editable Area */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          style={{ minHeight }}
          className="wysiwyg-editor max-h-72 overflow-y-auto px-3.5 py-2.5 text-[0.875rem] leading-relaxed text-slate-900 outline-none focus:outline-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:my-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:my-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:my-0.5 [&_strong]:font-bold [&_strong]:text-slate-900 [&_b]:font-bold [&_b]:text-slate-900 [&_em]:italic [&_i]:italic [&_u]:underline [&_u]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_blockquote]:border-l-3 [&_blockquote]:border-[#7da3b3] [&_blockquote]:bg-slate-50/80 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-1 [&_blockquote]:rounded-r [&_blockquote]:italic [&_mark]:bg-amber-100 [&_mark]:px-1 [&_mark]:rounded [&_p]:my-0.5"
        />
      </div>

      {helperText && (
        <p className="text-[0.75rem] text-slate-500">{helperText}</p>
      )}
    </div>
  );
}
