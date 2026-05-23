/**
 * Utility functions for URL handling and normalization.
 */

// Common tracking parameters to strip by default
export const DEFAULT_STRIP_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "ref",
    "source"
];

export interface NormalizationOptions {
    /**
     * List of query parameters to remove.
     * Supports wildcards like "utm_*" (simple prefix matching).
     */
    stripParams?: string[];

    /**
     * Whether to sort query parameters alphabetically.
     * Default: true
     */
    sortParams?: boolean;

    /**
     * Whether to remove trailing slashes (unless root).
     * Default: true
     */
    removeTrailingSlash?: boolean;

    /**
     * Whether to lowercase the hostname.
     * Default: true
     */
    lowercaseHostname?: boolean;

    /**
     * Whether to remove fragments (#hash).
     * Default: true
     */
    removeFragment?: boolean;
}

const DEFAULT_OPTIONS: NormalizationOptions = {
    stripParams: DEFAULT_STRIP_PARAMS,
    sortParams: true,
    removeTrailingSlash: true,
    lowercaseHostname: true,
    removeFragment: true
};

/**
 * Normalizes a URL string based on the provided options.
 * Useful for deduplication and canonicalization.
 */
export function normalizeUrl(
    inputUrl: string,
    options: NormalizationOptions = {}
): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
        const url = new URL(inputUrl);

        // 1. Lowercase hostname
        if (opts.lowercaseHostname) {
            url.hostname = url.hostname.toLowerCase();
        }

        // 2. Remove fragment
        if (opts.removeFragment) {
            url.hash = "";
        }

        // 3. Process Query Params
        if (opts.stripParams && opts.stripParams.length > 0) {
            const paramsToDelete: string[] = [];
            url.searchParams.forEach((_, key) => {
                // Check if key matches any stripped pattern
                // Only support prefix matching with '*' for now
                const shouldDelete = opts.stripParams!.some(pattern => {
                    if (pattern.endsWith("*")) {
                        return key.startsWith(pattern.slice(0, -1));
                    }
                    return key === pattern;
                });

                if (shouldDelete) {
                    paramsToDelete.push(key);
                }
            });
            paramsToDelete.forEach(key => url.searchParams.delete(key));
        }

        if (opts.sortParams) {
            url.searchParams.sort();
        }

        // 4. Trailing Slashes
        if (opts.removeTrailingSlash && url.pathname.length > 1 && url.pathname.endsWith("/")) {
            url.pathname = url.pathname.slice(0, -1);
        }

        // Return standardized string
        // Note: URL.toString() puts params in sorted order if sort() was called?
        // Yes, searchParams.sort() modifies the internal list.
        return url.toString();

    } catch {
        // If invalid URL, return original input (or throw?)
        // Usually better to return input for robustness, but maybe warn
        return inputUrl;
    }
}
