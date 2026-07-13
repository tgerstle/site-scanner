import type { AuditDisposition, ResourceType } from "types";

const DOCUMENT_EXTENSIONS = new Set([
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "rtf",
]);

const MEDIA_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
    "mp4",
    "webm",
    "mp3",
    "wav",
    "woff",
    "woff2",
]);

function getExtension(url: string): string {
    try {
        const pathname = new URL(url).pathname.toLowerCase();
        const lastSegment = pathname.split("/").pop() || "";
        const parts = lastSegment.split(".");
        if (parts.length < 2) return "";
        return (parts.pop() || "").split("?")[0].split("#")[0];
    } catch {
        return "";
    }
}

export function inferResourceType(url: string): ResourceType {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".html") || pathname.endsWith(".htm")) {
        return "html";
    }

    const extension = getExtension(url);
    if (!extension) {
        return "unknown";
    }

    if (DOCUMENT_EXTENSIONS.has(extension)) {
        return "document";
    }

    if (MEDIA_EXTENSIONS.has(extension)) {
        return "media";
    }

    return "binary";
}

export function assignAuditDisposition(resourceType: ResourceType): AuditDisposition {
    if (resourceType === "html" || resourceType === "unknown") {
        return "auditable_html";
    }

    if (resourceType === "document") {
        return "auditable_document";
    }

    return "inventory_only";
}

export function triageResource(url: string): {
    resourceType: ResourceType;
    auditDisposition: AuditDisposition;
    skipReason: string | null;
} {
    const resourceType = inferResourceType(url);
    const auditDisposition = assignAuditDisposition(resourceType);
    const skipReason = auditDisposition === "inventory_only" ? `non_html_${resourceType}` : null;

    return {
        resourceType,
        auditDisposition,
        skipReason,
    };
}

/**
 * Phase 5: Check if two-track model is enabled in config.
 * Returns true if nonHtmlPolicy.enabled is true, false otherwise.
 * Allows gradual rollout and emergency rollback.
 */
export function isTwoTrackModeEnabled(config: any): boolean {
    return config?.nonHtmlPolicy?.enabled === true;
}