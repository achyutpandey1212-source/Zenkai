"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content font-sans text-sm md:text-[15px] leading-[1.75] text-foreground/95">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => (
            <h1 className="font-heading text-2xl md:text-3xl font-semibold leading-tight mt-6 mb-3 text-foreground" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="font-heading text-xl md:text-2xl font-semibold leading-tight mt-5 mb-3 text-foreground" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="font-heading text-lg md:text-xl font-semibold leading-tight mt-4 mb-2 text-foreground" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="mb-4 last:mb-0 leading-[1.75]" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="list-disc pl-6 mb-4 space-y-1.5 text-foreground/90" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal pl-6 mb-4 space-y-1.5 text-foreground/90" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="leading-[1.75]" {...props} />
          ),
          blockquote: ({ ...props }) => (
            <blockquote className="pl-4 border-l-2 border-accent/60 italic text-muted-foreground my-4 bg-secondary/20 py-1 pr-2 rounded-r" {...props} />
          ),
          pre: ({ ...props }) => (
            <pre className="my-4 p-4 rounded-xl bg-secondary border border-border/40 overflow-x-auto font-mono text-[13px] leading-relaxed text-foreground scrollbar-custom" {...props} />
          ),
          code({ inline, className, children, ...props }: any) {
            return inline ? (
              <code className="px-1.5 py-0.5 rounded-md bg-secondary text-accent font-mono text-[12.5px] font-medium" {...props}>
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-4 border border-border/30 rounded-lg">
              <table className="w-full border-collapse text-sm text-left" {...props} />
            </div>
          ),
          thead: ({ ...props }) => (
            <thead className="bg-secondary/40 border-b border-border/40" {...props} />
          ),
          th: ({ ...props }) => (
            <th className="py-2.5 px-4 font-semibold text-foreground" {...props} />
          ),
          td: ({ ...props }) => (
            <td className="border-b border-border/20 py-2.5 px-4 text-muted-foreground last:border-b-0" {...props} />
          ),
          hr: ({ ...props }) => (
            <hr className="my-6 border-border/30" {...props} />
          ),
          a: ({ ...props }) => (
            <a className="text-accent hover:underline font-medium transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
