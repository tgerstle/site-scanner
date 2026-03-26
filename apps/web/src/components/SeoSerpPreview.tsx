import React from "react";

interface SeoSerpPreviewProps {
  serp: {
    title: string;
    description: string;
    url: string;
  };
}

export function SeoSerpPreview({ serp }: SeoSerpPreviewProps) {
  let hostname = serp.url;
  try {
    hostname = new URL(serp.url).hostname;
  } catch (e) {
    hostname = serp.url;
  }

  return (
    <div className="bg-white p-4 font-sans text-left border rounded shadow-sm max-w-2xl">
      <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">
        Google SERP Preview
      </div>

      {/* Simulation Container */}
      <div className="font-arial bg-white">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-xs text-slate-400">
            {hostname.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col text-xs leading-tight">
            <span className="text-[#202124]">{hostname}</span>
            <span className="text-[#5f6368] truncate max-w-[300px]">
              {serp.url}
            </span>
          </div>
        </div>

        <h3 className="text-[#1a0dab] text-xl cursor-pointer hover:underline mb-1 font-normal leading-snug truncate">
          {serp.title}
        </h3>

        <div className="text-[#4d5156] text-sm leading-snug">
          {serp.description}
        </div>
      </div>
    </div>
  );
}
