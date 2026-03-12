export interface DiscoveryResult {
  foundUrls: string[];
  error?: string;
}

export interface LinkFilterOptions {
  baseUrl: string;
  includePaths?: string[];
  excludePaths?: string[];
}
