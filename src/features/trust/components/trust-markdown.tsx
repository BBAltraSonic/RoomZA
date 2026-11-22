import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** Images may only come from this site; links may only use web or mail schemes. */
export function transformTrustMarkdownUrl(url: string, key: string) {
  if (key === "src") return url.startsWith("/") && !url.startsWith("//") ? url : "";
  if (url.startsWith("/") || url.startsWith("#")) return url;
  try {
    const parsed = new URL(url);
    return ["https:", "http:", "mailto:"].includes(parsed.protocol) ? url : "";
  } catch {
    return "";
  }
}

export function TrustMarkdown({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={cn("markdown-prose", className)} data-slot="trust-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={transformTrustMarkdownUrl}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          a: ({ children, href, ...props }) => {
            const external = href?.startsWith("http");
            return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} {...props}>{children}</a>;
          },
          img: ({ alt, src, ...props }: ComponentPropsWithoutRef<"img">) => {
            if (typeof src !== "string" || !src) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ""} loading="lazy" {...props} />
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
