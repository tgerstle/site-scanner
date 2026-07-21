import { describe, it, expect, vi } from 'vitest';
import { resolvePlugins, resolveDocumentPlugins } from './plugin-resolver.js';
import { ScannerConfig, AuditPlugin } from '@scanner/types';

describe('resolvePlugins', () => {
    // Mock Plugins
    const MockAxe: AuditPlugin = { name: 'axe', run: vi.fn() };
    const MockLighthouse: AuditPlugin = { name: 'lighthouse', run: vi.fn() };
    const MockSeo: AuditPlugin = { name: 'seo', run: vi.fn() };
    const MockPdf: AuditPlugin = { name: 'pdf-audit', targets: ['document'], run: vi.fn() };

    const pluginRegistry = new Map<string, AuditPlugin>([
        ['axe', MockAxe],
        ['lighthouse', MockLighthouse],
        ['seo', MockSeo],
        ['pdf-audit', MockPdf]
    ]);

    it('should include global plugins by default', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            phases: {
                global: ['axe']
            }
        } as any;

        const result = resolvePlugins(pluginRegistry, config, ['global']);
        expect(result).toHaveLength(1);
        expect((result[0] as any).plugin.name).toBe('axe');
    });

    it('should include type-specific plugins', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            phases: {
                global: ['axe'],
                product: ['seo']
            }
        } as any;

        const result = resolvePlugins(pluginRegistry, config, ['global', 'product']);
        expect(result).toHaveLength(2);
        // @ts-ignore
        const names = result.map(p => 'plugin' in p ? p.plugin.name : p.name);
        expect(names).toContain('axe');
        expect(names).toContain('seo');
    });

    it('should fall back to legacy plugins array if phases.global is missing', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            plugins: ['lighthouse'], // legacy
            phases: {}
        } as any;

        const result = resolvePlugins(pluginRegistry, config, ['global']);
        expect(result).toHaveLength(1);
        expect((result[0] as any).plugin.name).toBe('lighthouse');
    });

    it('should prevent duplicate plugin execution (Global wins)', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            phases: {
                global: ['axe'],
                product: [{ name: 'axe', options: { tags: ['wcag2a'] } }] // Should be ignored
            }
        } as any;

        const result = resolvePlugins(pluginRegistry, config, ['global', 'product']);
        expect(result).toHaveLength(1);
        expect((result[0] as any).plugin.name).toBe('axe');
        // Verify options are from global (undefined) not product
        expect((result[0] as any).options).toBeUndefined();
    });

    it('should warn when plugin is missing', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            phases: {
                global: ['missing-plugin']
            }
        } as any;

        const warnSpy = vi.fn();
        resolvePlugins(pluginRegistry, config, ['global'], warnSpy);

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing-plugin"));
    });

    it('should pass options correctly', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            phases: {
                global: [{ name: 'axe', options: { rules: { 'color-contrast': { enabled: false } } } }]
            }
        } as any;

        const result = resolvePlugins(pluginRegistry, config, ['global']);
        expect(result).toHaveLength(1);
        const item = result[0] as { plugin: AuditPlugin; options: any };
        expect(item.options.rules['color-contrast'].enabled).toBe(false);
    });

    it('should respect plugin target compatibility', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            phases: {
                global: ['axe', 'pdf-audit']
            }
        } as any;

        const htmlResult = resolvePlugins(pluginRegistry, config, ['global'], undefined, 'html');
        const htmlNames = htmlResult.map(p => 'plugin' in p ? p.plugin.name : p.name);
        expect(htmlNames).toContain('axe');
        expect(htmlNames).not.toContain('pdf-audit');

        const docResult = resolvePlugins(pluginRegistry, config, ['global'], undefined, 'document');
        const docNames = docResult.map(p => 'plugin' in p ? p.plugin.name : p.name);
        expect(docNames).toContain('pdf-audit');
        expect(docNames).not.toContain('axe');
    });
});

// Phase 4: Document-specific plugin resolution
describe('resolveDocumentPlugins', () => {
    const MockAxe: AuditPlugin = { name: 'axe', targets: ['html'], run: vi.fn() };
    const MockPdfAudit: AuditPlugin = { name: 'pdf-audit', targets: ['document'], run: vi.fn() };
    const MockUniversal: AuditPlugin = { name: 'universal-check', targets: ['all'], run: vi.fn() };

    const pluginRegistry = new Map<string, AuditPlugin>([
        ['axe', MockAxe],
        ['pdf-audit', MockPdfAudit],
        ['universal-check', MockUniversal]
    ]);

    it('should resolve only document-compatible plugins', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            phases: {
                global: ['axe', 'pdf-audit', 'universal-check']
            }
        } as any;

        const result = resolveDocumentPlugins(pluginRegistry, config);
        expect(result).toHaveLength(2);
        const names = result.map(p => (p as any).plugin.name);
        expect(names).toContain('pdf-audit');
        expect(names).toContain('universal-check');
        expect(names).not.toContain('axe');
    });

    it('should warn when document plugin is missing', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            phases: {
                global: ['missing-doc-plugin']
            }
        } as any;

        const warnSpy = vi.fn();
        resolveDocumentPlugins(pluginRegistry, config, warnSpy);

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing-doc-plugin"));
    });

    it('should fall back to legacy plugins array if phases.global is missing', () => {
        const config: ScannerConfig = {
            siteUrl: 'http://test.com',
            plugins: ['pdf-audit'],
            phases: {}
        } as any;

        const result = resolveDocumentPlugins(pluginRegistry, config);
        expect(result).toHaveLength(1);
        expect((result[0] as any).plugin.name).toBe('pdf-audit');
    });
});
