import { Fragment } from "react";

/** Renders inline **bold** as <strong>, leaving everything else as plain text. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

/** Plain-text article body: paragraphs separated by blank lines, optional "## " subheadings. */
export function ArticleBody({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="body">
      {blocks.map((block, i) => {
        const last = streaming && i === blocks.length - 1;
        if (/^#{2,3} /.test(block)) {
          return (
            <h2 key={i} className={last ? "cursor" : undefined}>
              {block.replace(/^#{2,3} /, "")}
            </h2>
          );
        }
        return (
          <p key={i} className={last ? "cursor" : undefined}>
            {inline(block.replace(/\n/g, " ").replace(/^[-*] /, "• "))}
          </p>
        );
      })}
      {streaming && !blocks.length && <p className="cursor" />}
    </div>
  );
}
