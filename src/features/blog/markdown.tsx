import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

import { transformBlogMarkdownUrl } from "./utils";

export function BlogMarkdown({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={cn("blog-prose", className)} data-slot="blog-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={transformBlogMarkdownUrl}
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
