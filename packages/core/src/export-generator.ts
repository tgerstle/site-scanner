import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import type { ExportDatasets } from '@scanner/types';

/**
 * Generates an XLSX file Buffer. 
 * Each key in the ExportDatasets object becomes a separate WorkSheet tab.
 */
export async function generateXlsxBuffer(datasets: ExportDatasets): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Adaptive Web Auditor';
    workbook.lastModifiedBy = 'Adaptive Web Auditor';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Tab 1: Global Rollup Sheet
    const globalSheet = workbook.addWorksheet('Global Action Plan');
    globalSheet.columns = [
        { header: 'Severity', key: 'severity', width: 15 },
        { header: 'Plugin', key: 'plugin', width: 15 },
        { header: 'Rule ID', key: 'ruleId', width: 25 },
        { header: 'Total Occurrences', key: 'totalOccurrences', width: 15 },
        { header: 'Affected URLs', key: 'affectedUrls', width: 15 },
        { header: 'Description', key: 'description', width: 50 },
    ];
    globalSheet.addRows(datasets.global);
    // Make headers bold
    globalSheet.getRow(1).font = { bold: true };

    // Tab 2: Axe Audit Sheet
    const axeSheet = workbook.addWorksheet('Accessibility Audit');
    axeSheet.columns = [
        { header: 'URL', key: 'url', width: 40 },
        { header: 'Impact', key: 'impact', width: 15 },
        { header: 'Rule ID', key: 'ruleId', width: 25 },
        { header: 'Selector (Target)', key: 'targetSelector', width: 40 },
        { header: 'HTML Snippet', key: 'htmlSnippet', width: 50 },
        { header: 'Failure Summary', key: 'failureSummary', width: 60 },
    ];
    axeSheet.addRows(datasets.a11y);
    axeSheet.getRow(1).font = { bold: true };

    // Tab 3: Performance Sheet
    const perfSheet = workbook.addWorksheet('Performance Audit');
    perfSheet.columns = [
        { header: 'URL', key: 'url', width: 40 },
        { header: 'Audit Title', key: 'title', width: 35 },
        { header: 'Score', key: 'score', width: 10 },
        { header: 'Savings (ms)', key: 'potentialSavingsMs', width: 15 },
        { header: 'Resource/Hint', key: 'resourceHint', width: 50 },
    ];
    perfSheet.addRows(datasets.performance);
    perfSheet.getRow(1).font = { bold: true };

    // Tab 4: SEO Sheet
    const seoSheet = workbook.addWorksheet('SEO Audit');
    seoSheet.columns = [
        { header: 'URL', key: 'url', width: 40 },
        { header: 'Issue Type', key: 'issueType', width: 15 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Path', key: 'propertyPath', width: 25 },
        { header: 'Message', key: 'message', width: 50 },
    ];
    seoSheet.addRows(datasets.seo);
    seoSheet.getRow(1).font = { bold: true };

    // Phase 3: Tab 5: Resource Inventory Sheet
    if (datasets.resource_inventory && datasets.resource_inventory.length > 0) {
        const inventorySheet = workbook.addWorksheet('Resource Inventory');
        inventorySheet.columns = [
            { header: 'URL', key: 'url', width: 50 },
            { header: 'Type', key: 'resource_type', width: 12 },
            { header: 'Disposition', key: 'audit_disposition', width: 18 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Skip Reason', key: 'skip_reason', width: 20 },
            { header: 'Discovered From', key: 'discovered_from', width: 50 },
            { header: 'Source', key: 'source', width: 10 },
        ];
        inventorySheet.addRows(datasets.resource_inventory);
        inventorySheet.getRow(1).font = { bold: true };
    }

    // Phase 3: Tab 6: Audit Target Summary Sheet
    if (datasets.audit_target_summary && datasets.audit_target_summary.length > 0) {
        const auditTargetSheet = workbook.addWorksheet('Audit Target Summary');
        auditTargetSheet.columns = [
            { header: 'URL', key: 'url', width: 50 },
            { header: 'Type', key: 'resource_type', width: 12 },
            { header: 'Disposition', key: 'audit_disposition', width: 18 },
            { header: 'Audit Status', key: 'audit_status', width: 12 },
            { header: 'Violations', key: 'violation_count', width: 10 },
            { header: 'SEO Score', key: 'seo_score', width: 10 },
            { header: 'Performance', key: 'performance_score', width: 12 },
            { header: 'Accessibility', key: 'accessibility_score', width: 14 },
            { header: 'Best Practices', key: 'best_practices_score', width: 14 },
        ];
        auditTargetSheet.addRows(datasets.audit_target_summary);
        auditTargetSheet.getRow(1).font = { bold: true };
    }

    // Write to Buffer
    return Buffer.from(await workbook.xlsx.writeBuffer());
}

/**
 * Generates a ZIP Buffer containing multiple .csv files
 */
export async function generateCsvZipBuffer(datasets: ExportDatasets): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const zipArchive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        const buffers: Buffer[] = [];
        const passThrough = new PassThrough();

        passThrough.on('data', (data) => buffers.push(data));
        passThrough.on('end', () => resolve(Buffer.concat(buffers)));
        passThrough.on('error', reject);
        zipArchive.on('error', reject);

        zipArchive.pipe(passThrough);

        // Map sheets directly to filenames and append their CSV strings
        const filesToMap = [
            { name: 'global-action-plan.csv', data: datasets.global },
            { name: 'accessibility-audit.csv', data: datasets.a11y },
            { name: 'performance-audit.csv', data: datasets.performance },
            { name: 'seo-audit.csv', data: datasets.seo },
            // Phase 3: Include inventory and audit target summary if available
            ...(datasets.resource_inventory ? [{ name: 'resource-inventory.csv', data: datasets.resource_inventory }] : []),
            ...(datasets.audit_target_summary ? [{ name: 'audit-target-summary.csv', data: datasets.audit_target_summary }] : []),
        ];

        for (const file of filesToMap) {
            if (file.data.length > 0) {
                const csvString = stringify(file.data, { header: true });
                zipArchive.append(csvString, { name: file.name });
            }
        }

        zipArchive.finalize();
    });
}
