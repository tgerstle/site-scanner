import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface PerformanceFinding {
  title: string;
  description: string;
  score: number;
  display_value?: string;
  details_json?: string;
}

const DetailTable = ({ details }: { details: any }) => {
  if (!details || !details.items || details.items.length === 0) return null;

  const headings = details.headings || [];
  if (headings.length === 0) return null;

  return (
    <div className="mt-4 overflow-x-auto bg-gray-50 rounded border border-gray-200">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            {headings.map((h: any, i: number) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
              >
                {h.label || h.text || h.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {details.items.map((item: any, rowIdx: number) => (
            <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
              {headings.map((h: any, colIdx: number) => {
                const val = item[h.key];
                let content: React.ReactNode = val;

                if (val === undefined || val === null) {
                  content = "-";
                } else if (h.key === "url" || h.valueType === "url") {
                  const url =
                    typeof val === "string"
                      ? val
                      : val.url || JSON.stringify(val);
                  content = (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all block max-w-md"
                    >
                      {url}
                    </a>
                  );
                } else if (h.valueType === "bytes" && typeof val === "number") {
                  content = `${(val / 1024).toFixed(1)} KB`;
                } else if (
                  h.valueType === "timespanMs" &&
                  typeof val === "number"
                ) {
                  content = `${Math.round(val)} ms`;
                } else if (
                  h.valueType === "thumbnail" &&
                  typeof val === "string"
                ) {
                  content = (
                    <img
                      src={val}
                      alt="thumbnail"
                      className="h-8 w-8 object-cover rounded border"
                    />
                  );
                } else if (typeof val === "object" && val !== null) {
                  if (val.type === "link") {
                    content = (
                      <a
                        href={val.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {val.text}
                      </a>
                    );
                  } else if (val.type === "node") {
                    content = (
                      <div className="group relative">
                        <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-pink-600 break-all block max-w-xs overflow-hidden text-ellipsis cursor-help">
                          {val.snippet || val.selector}
                        </code>
                        <div className="hidden group-hover:block absolute z-10 p-2 bg-gray-800 text-white text-xs rounded shadow-lg max-w-sm whitespace-pre-wrap left-0 mt-1">
                          {val.snippet || val.selector}
                        </div>
                      </div>
                    );
                  } else if (val.type === "thumbnail") {
                    content = (
                      <img
                        src={val.url}
                        alt="thumbnail"
                        className="h-12 w-12 object-cover rounded border bg-gray-100"
                      />
                    );
                  } else {
                    // Fallback for objects
                    content = (
                      <span className="text-xs text-gray-400 font-mono">
                        {JSON.stringify(val).slice(0, 50)}...
                      </span>
                    );
                  }
                }

                return (
                  <td
                    key={colIdx}
                    className="px-3 py-2 whitespace-normal text-gray-700 align-top border-b border-gray-100 last:border-0"
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Description = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  const content = parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      return (
        <a
          key={i}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {match[1]}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });

  return (
    <div
      className={`text-xs text-gray-500 mt-1 max-w-3xl cursor-pointer ${expanded ? "" : "line-clamp-2"}`}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(!expanded);
      }}
      title={expanded ? "Click to collapse" : "Click to read more"}
    >
      {content}
    </div>
  );
};

const FindingRow = ({ finding }: { finding: PerformanceFinding }) => {
  const [expanded, setExpanded] = useState(false);
  let details = null;
  try {
    details = finding.details_json ? JSON.parse(finding.details_json) : null;
  } catch {}

  const hasDetails = details && details.items && details.items.length > 0;
  const scoreColor = (score: number) => {
    if (score === null || score === undefined)
      return "bg-gray-100 text-gray-800";
    if (score >= 0.9) return "bg-green-100 text-green-800";
    if (score >= 0.5) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <li
      className={`block transition-colors ${expanded ? "bg-gray-50" : "hover:bg-gray-50"}`}
    >
      <div className="px-4 py-4 sm:px-6">
        <div
          className="flex items-start justify-between cursor-pointer"
          onClick={() => hasDetails && setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <div
                className={`text-gray-400 w-5 flex-shrink-0 ${hasDetails ? "visible" : "invisible"}`}
              >
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              <div>
                <p className="text-sm font-medium text-blue-600 truncate">
                  {finding.title}
                </p>
                <Description text={finding.description} />
              </div>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0 flex flex-col items-end">
            <span
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${scoreColor(finding.score)}`}
            >
              Score: {Math.round(finding.score * 100)}
            </span>
            {finding.display_value && (
              <span className="mt-1 text-xs text-gray-500 text-right">
                {finding.display_value}
              </span>
            )}
          </div>
        </div>
        {expanded && hasDetails && (
          <div className="mt-4 pl-7 animate-in fade-in duration-200">
            <DetailTable details={details} />
          </div>
        )}
      </div>
    </li>
  );
};

export default function PerformanceFindingsList({
  findings,
}: {
  findings: PerformanceFinding[];
}) {
  if (!findings || findings.length === 0) return null;
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
      <ul className="divide-y divide-gray-200">
        {findings.map((finding, i) => (
          <FindingRow key={i} finding={finding} />
        ))}
      </ul>
    </div>
  );
}
