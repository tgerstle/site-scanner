import type { SeoResult } from "types";

export interface SeoPreviewData {
    serp: {
        title: string;
        description: string;
        url: string;
        date?: string;
    };
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

export function buildSeoPreview(result: SeoResult, url: string): SeoPreviewData {
    let domain = "";
    try {
        domain = new URL(url).hostname;
    } catch (e) {
        domain = url;
    }

    // SERP Logic
    const rawTitle = result.meta.title || "No Title";
    // Google typically cuts off around 600px, which is roughly 60 chars
    const serpTitle = rawTitle.length > 60 ? rawTitle.substring(0, 58) + "..." : rawTitle;

    const rawDesc = result.meta.description || "No description available.";
    const serpDesc = rawDesc.length > 160 ? rawDesc.substring(0, 158) + "..." : rawDesc;

    // Open Graph
    const ogTitle = result.openGraph["og:title"] || rawTitle;
    const ogDesc = result.openGraph["og:description"] || rawDesc;
    const ogImage = result.openGraph["og:image"] || null;

    // Twitter Card
    const twTitle = result.twitter["twitter:title"] || ogTitle;
    const twDesc = result.twitter["twitter:description"] || ogDesc;
    const twImage = result.twitter["twitter:image"] || ogImage;
    const twCard = result.twitter["twitter:card"] || "summary";
    const twSite = result.twitter["twitter:site"] || null;

    return {
        serp: {
            title: serpTitle,
            description: serpDesc,
            url: url
        },
        social: {
            facebook: {
                title: ogTitle,
                description: ogDesc,
                image: ogImage,
                domain
            },
            twitter: {
                title: twTitle,
                description: twDesc,
                image: twImage,
                cardType: twCard,
                site: twSite
            }
        }
    };
}
