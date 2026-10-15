import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isStreaming = false,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to parse inline styles (bold, code, links)
  const renderInline = (text: string): React.ReactNode => {
    // Split by inline code first
    const codeParts = text.split(/(`[^`]+`)/g);

    return codeParts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono bg-neutral-800 text-indigo-300 border border-neutral-700/60"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Check bold **bold**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, j) => {
        if (bPart.startsWith('**') && bPart.endsWith('**')) {
          return (
            <strong key={`${i}-${j}`} className="font-semibold text-neutral-100">
              {bPart.slice(2, -2)}
            </strong>
          );
        }

        // Check italic *italic*
        const italicParts = bPart.split(/(\*[^*]+\*)/g);
        return italicParts.map((itPart, k) => {
          if (itPart.startsWith('*') && itPart.endsWith('*')) {
            return (
              <em key={`${i}-${j}-${k}`} className="italic text-neutral-300">
                {itPart.slice(1, -1)}
              </em>
            );
          }
          return itPart;
        });
      });
    });
  };

  // Block parser
  const renderBlocks = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let blockIdx = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 1. Code Block (```lang ... ```)
      if (line.trim().startsWith('```')) {
        const lang = line.trim().replace(/^```/, '') || 'code';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        const fullCode = codeLines.join('\n');
        const currentIdx = blockIdx++;

        elements.push(
          <div
            key={`code-${currentIdx}`}
            className="my-3 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 text-xs shadow-xs"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-[11px] text-neutral-400">
              <div className="flex items-center gap-1.5 font-mono">
                <Terminal className="w-3.5 h-3.5 text-neutral-500" />
                <span>{lang}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCode(fullCode, currentIdx)}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
                title="Copy snippet"
              >
                {copiedIndex === currentIdx ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 overflow-x-auto font-mono text-[11px] leading-relaxed text-neutral-300 selection:bg-indigo-500/30">
              <code>{fullCode}</code>
            </pre>
          </div>
        );
        continue;
      }

      // 2. Table (| col1 | col2 |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        const currentIdx = blockIdx++;
        if (tableLines.length >= 2) {
          const headerCells = tableLines[0]
            .split('|')
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
            .map((c) => c.trim());

          const bodyLines = tableLines.slice(2); // skip header and separator row

          elements.push(
            <div
              key={`table-${currentIdx}`}
              className="my-3 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950/50"
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-300 font-semibold">
                    {headerCells.map((h, hIdx) => (
                      <th key={hIdx} className="px-3 py-2 font-medium">
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {bodyLines.map((rowStr, rIdx) => {
                    const rowCells = rowStr
                      .split('|')
                      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
                      .map((c) => c.trim());

                    return (
                      <tr key={rIdx} className="hover:bg-neutral-800/30 transition-colors">
                        {rowCells.map((c, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-neutral-300">
                            {renderInline(c)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      // 3. Headings
      if (line.startsWith('### ')) {
        elements.push(
          <h3
            key={`h3-${i}`}
            className="text-sm font-semibold text-neutral-100 mt-3 mb-1.5 flex items-center gap-1.5"
          >
            {renderInline(line.replace('### ', ''))}
          </h3>
        );
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h2
            key={`h2-${i}`}
            className="text-base font-bold text-neutral-100 mt-4 mb-2"
          >
            {renderInline(line.replace('## ', ''))}
          </h2>
        );
        i++;
        continue;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h1
            key={`h1-${i}`}
            className="text-lg font-bold text-neutral-100 mt-4 mb-2"
          >
            {renderInline(line.replace('# ', ''))}
          </h1>
        );
        i++;
        continue;
      }

      // 4. Blockquotes
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote
            key={`quote-${i}`}
            className="my-2 pl-3 py-1 border-l-2 border-indigo-500 text-xs text-neutral-400 italic bg-neutral-900/40 rounded-r"
          >
            {renderInline(line.replace('> ', ''))}
          </blockquote>
        );
        i++;
        continue;
      }

      // 5. Lists (- or * or 1.)
      if (/^(\s*[-*]|\s*\d+\.)\s+/.test(line)) {
        const isNumbered = /^\s*\d+\.\s+/.test(line);
        const match = line.match(/^(\s*[-*]|\s*\d+\.)\s+(.*)/);
        const textPart = match ? match[2] : line;

        elements.push(
          <div key={`list-${i}`} className="flex items-start gap-2 my-1 text-xs">
            <span className="text-neutral-500 font-mono text-[11px] shrink-0 mt-0.5">
              {isNumbered ? `${line.match(/^\s*(\d+\.)/)?.[1]}` : '•'}
            </span>
            <div className="flex-1 text-neutral-300 leading-relaxed">
              {renderInline(textPart)}
            </div>
          </div>
        );
        i++;
        continue;
      }

      // 6. Normal paragraph or blank line
      if (!line.trim()) {
        elements.push(<div key={`blank-${i}`} className="h-2" />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="text-xs text-neutral-300 leading-relaxed my-1">
            {renderInline(line)}
          </p>
        );
      }
      i++;
    }

    return elements;
  };

  return (
    <div className="markdown-content">
      {renderBlocks()}
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 bg-indigo-400 ml-1 animate-pulse align-middle" />
      )}
    </div>
  );
};
