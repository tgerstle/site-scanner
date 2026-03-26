import React from "react";

interface SeoSocialPreviewProps {
  social: {
    facebook: {
      title: string;
      description: string;
      image: string | null;
      domain: string;
    };
    twitter: {
      title: string;
      description: string;
      image: string | null;
      cardType: string;
      site: string | null;
    };
  };
}

export function SeoSocialPreview({ social }: SeoSocialPreviewProps) {
  const { facebook, twitter } = social;

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Facebook Card */}
      <div className="flex-1 max-w-sm rounded border border-gray-200 overflow-hidden font-sans bg-white">
        <div className="text-xs text-slate-500 font-medium p-2 pb-0 uppercase tracking-wide">
          Facebook Preview
        </div>
        <div className="w-full h-48 bg-gray-100 flex items-center justify-center font-medium overflow-hidden">
          {facebook.image ? (
            <img
              src={facebook.image}
              alt={facebook.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-gray-400">No Image</span>
          )}
        </div>
        <div className="p-3 bg-[#F0F2F5] border-t border-gray-100">
          <div className="text-xs text-[#606770] uppercase mb-1 truncate">
            {facebook.domain}
          </div>
          <div className="font-semibold text-[#1d2129] leading-tight mb-1 line-clamp-2">
            {facebook.title || "No Title"}
          </div>
          <div className="text-sm text-[#606770] line-clamp-1">
            {facebook.description || "No Description"}
          </div>
        </div>
      </div>

      {/* Twitter Card */}
      <div className="flex-1 max-w-sm rounded border border-gray-200 overflow-hidden font-sans bg-white">
        <div className="text-xs text-slate-500 font-medium p-2 pb-0 uppercase tracking-wide">
          Twitter Card ({twitter.cardType})
        </div>
        <div className="relative border border-gray-200 rounded-xl overflow-hidden m-2">
          <div
            className={`w-full ${twitter.cardType === "summary_large_image" ? "h-48" : "h-32"} bg-gray-100 flex items-center justify-center font-medium overflow-hidden`}
          >
            {twitter.image ? (
              <img
                src={twitter.image}
                alt={twitter.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400">No Image</span>
            )}
          </div>
          <div className="p-3 bg-white border-t border-gray-100">
            <div className="text-xs text-[#536471] uppercase mb-1 truncate">
              {facebook.domain}
            </div>
            <div className="font-bold text-[#0f1419] leading-tight mb-1 truncate">
              {twitter.title || "No Title"}
            </div>
            <div className="text-sm text-[#536471] line-clamp-2">
              {twitter.description || "No Description"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
