const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, 'data', 'history.json');

// Get all commits that touched data/jars.json
const log = execSync('git log --format="%H %aI" origin/main -- data/jars.json', { encoding: 'utf8' }).trim();
if (!log) {
  console.log('Немає комітів з data/jars.json');
  process.exit(0);
}

const commits = log.split('\n').map(line => {
  const [hash, ts] = line.split(' ');
  return { hash, ts };
}).reverse(); // oldest first

console.log(`Знайдено ${commits.length} комітів з data/jars.json`);

const snapshots = [];

for (const { hash, ts } of commits) {
  try {
    const raw = execSync(`git show ${hash}:data/jars.json`, { encoding: 'utf8' });
    const data = JSON.parse(raw);
    if (!data.jars || data.jars.length === 0) continue;

    const withData = data.jars.filter(j => j.amountNum != null);
    if (withData.length === 0) continue;

    const total = withData.reduce((s, j) => s + j.amountNum, 0);
    const byId = Object.fromEntries(data.jars.map(j => [j.id, j.amountNum]));

    snapshots.push({ ts: data.updatedAt || ts, total, byId });
    console.log(`${ts.substring(0, 16)}  →  ${total.toLocaleString('uk-UA')} ₴`);
  } catch (e) {
    console.warn(`  Пропускаємо ${hash}: ${e.message}`);
  }
}

// Merge with existing history (keep unique timestamps)
let existing = { snapshots: [] };
if (fs.existsSync(outputPath)) {
  try { existing = JSON.parse(fs.readFileSync(outputPath, 'utf8')); } catch (_) {}
}

const existingTs = new Set(existing.snapshots.map(s => s.ts));
const merged = [...snapshots.filter(s => !existingTs.has(s.ts)), ...existing.snapshots]
  .sort((a, b) => new Date(a.ts) - new Date(b.ts));

fs.writeFileSync(outputPath, JSON.stringify({ snapshots: merged }), 'utf8');
console.log(`\n✓ Збережено ${merged.length} знімків у data/history.json`);
