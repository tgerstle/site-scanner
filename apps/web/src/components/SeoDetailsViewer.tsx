import React from "react";
import type { SeoResult } from "@scanner/types";
import { buildSeoPreview } from "../lib/seo-preview";
import { SeoSerpPreview } from "./SeoSerpPreview";
import { SeoSocialPreview } from "./SeoSocialPreview";

interface SeoDetailsViewerProps {
  seoResult: SeoResult;
  url: string;
}

export default function SeoDetailsViewer({
  seoResult,
  url,
}: SeoDetailsViewerProps) {
  const preview = buildSeoPreview(seoResult, url);
  const validation = seoResult.validation;

  return (
    <div className="flex flex-col gap-8">
      {/* Validation Summary */}
      {validation && (
        <div className="p-4 bg-white rounded border border-gray-200 shadow-sm relative overflow-hidden">
          <div
            className={`absolute left-0 top-0 bottom-0 w-1 ${
              validation.meta.status === "pass"
                ? "bg-green-500"
                : validation.meta.status === "warn"
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          ></div>

          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-bold text-gray-800 text-lg">
                SEO Health Check
              </h4>
              <p className="text-sm text-gray-500">
                Analysis of meta tags and structured data
              </p>
            </div>
            <div className="flex flex-col items-end">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  validation.meta.status === "pass"
                    ? "bg-green-100 text-green-800"
                    : validation.meta.status === "warn"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                Status: {validation.meta.status}
              </span>
              <span className="text-2xl font-bold text-gray-700 mt-1">
                {Math.round(validation.score)}
                <span className="text-sm text-gray-400 font-normal">/100</span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {(validation.meta.errors.length > 0 ||
              validation.meta.warnings.length === 0) && (
              <div>
                <div className="text-red-700 text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1">
                  Issues Found ({validation.meta.errors.length})
                </div>
                {validation.meta.errors.length > 0 ? (
                  <ul className="space-y-1">
                    {validation.meta.errors.map((e, i) => (
                      <li
                        key={i}
                        className="text-sm text-red-700 flex items-start gap-2"
                      >
                        <span className="mt-1 block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                        {e}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No critical errors found
                  </div>
                )}
              </div>
            )}

            {(validation.meta.warnings.length > 0 ||
              validation.meta.errors.length === 0) && (
              <div>
                <div className="text-yellow-700 text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1">
                  Suggestions ({validation.meta.warnings.length})
                </div>
                {validation.meta.warnings.length > 0 ? (
                  <ul className="space-y-1">
                    {validation.meta.warnings.map((w, i) => (
                      <li
                        key={i}
                        className="text-sm text-yellow-700 flex items-start gap-2"
                      >
                        <span className="mt-1 block w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0"></span>
                        {w}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No warnings found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-8 flex-wrap items-start">
        <div className="flex-1 min-w-[300px]">
          <h4 className="font-bold mb-3 text-gray-500 text-xs uppercase tracking-wider">
            Google Search Preview
          </h4>
          <SeoSerpPreview serp={preview.serp} />
        </div>
        <div className="flex-[2] min-w-[300px]">
          <h4 className="font-bold mb-3 text-gray-500 text-xs uppercase tracking-wider">
            Social Share Cards
          </h4>
          <SeoSocialPreview social={preview.social} />
        </div>
      </div>

      {/* Structured Data & Headings (Added Detail) */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded border border-gray-200">
          <h4 className="font-bold mb-3 text-gray-500 text-xs uppercase tracking-wider">
            Headings Structure ({seoResult.headings.length})
          </h4>
          <div className="max-h-60 overflow-y-auto text-sm">
            {seoResult.headings.length > 0 ? (
              <ul className="space-y-1">
                {seoResult.headings.map((h, i) => (
                  <li
                    key={i}
                    style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                    className="truncate"
                  >
                    <span className="font-mono text-xs text-gray-400 mr-2">
                      H{h.level}
                    </span>
                    {h.text}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-gray-400 italic">No headings found</span>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-gray-200">
          <h4 className="font-bold mb-3 text-gray-500 text-xs uppercase tracking-wider">
            Structured Data (JSON-LD)
          </h4>
          <div className="max-h-60 overflow-y-auto text-xs font-mono bg-gray-50 p-2 rounded">
            {seoResult.jsonLd.length > 0 ? (
              <pre>{JSON.stringify(seoResult.jsonLd, null, 2)}</pre>
            ) : (
              <span className="text-gray-400 italic font-sans text-sm">
                No JSON-LD found
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
