import Database from 'better-sqlite3';

const db = new Database('./data/awa.sqlite');
const run = db.prepare('SELECT * FROM runs ORDER BY created_at DESC LIMIT 1').get();
console.log("Latest Run:", run);

if (run) {
    const pages = db.prepare('SELECT count(*) as c FROM pages WHERE run_id = ?').get(run.id);
    console.log("Pages processed:", pages.c);

    const findings = db.prepare('SELECT * FROM a11y_findings WHERE run_id = ?').all(run.id);
    console.log("Findings count:", findings.length);

    if (findings.length > 0) {
        console.log("Sample finding:", JSON.stringify(findings[0], null, 2));
    } else {
        console.log("No findings. Checking page results column...");
        const pageResults = db.prepare('SELECT url, results FROM pages WHERE run_id = ? LIMIT 5').all(run.id);
        pageResults.forEach(p => {
            console.log(`Page: ${p.url}`);
            try {
                const res = JSON.parse(p.results);
                console.log("  Violations in JSON:", res.a11y_violations?.length);
            } catch (e) {
                console.log("  Error parsing results JSON");
            }
        });
    }
}
