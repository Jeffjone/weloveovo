import { mkdirSync, writeFileSync } from 'node:fs';
import audit from '../../reports/genius/import-audit.json';

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_[\]{}|]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ');
const entries = (action: string) =>
  audit.decisions
    .filter((entry) => entry.action === action)
    .sort((a, b) => a.title.localeCompare(b.title, 'en') || a.genius_id - b.genius_id);
function section(action: string, title: string) {
  const rows = entries(action);
  return `## ${title} (${rows.length})\n\n| Entry | Genius ID | Reason | Source |\n| --- | --- | --- | --- |\n${rows.map((entry) => `| ${escape(entry.title)} | ${entry.genius_id} | ${escape(entry.reason)} | [Genius](${new URL(entry.url).href}) |`).join('\n')}\n`;
}
const intro = `Snapshot: ${audit.retrieved_at}. Reviewed ${audit.source_entries} Genius entries across ${audit.pages} pages. Added ${audit.summary.added} recordings to the original ${audit.existing_tracks}-track catalog.\n\nThese are import decisions, not a definitive judgment on whether a recording exists. Genius entries can include non-song pages, alternate versions, and unverified submissions. No lyrics are reproduced.\n\nGenerated from [the complete audit](import-audit.json) with \`npm run genius:report\`.\n\n`;
mkdirSync('reports/genius', { recursive: true });
writeFileSync(
  'reports/genius/excluded-and-uncertain.md',
  '# Excluded and uncertain Genius entries\n\n' +
    intro +
    'Excluded entries were omitted under the catalog rules. Uncertain entries remain outside the catalog pending verification. Duplicate editions are listed [separately](duplicates.md).\n\n' +
    section('excluded', 'Excluded entries') +
    '\n' +
    section('review', 'Uncertain entries'),
);
writeFileSync(
  'reports/genius/duplicates.md',
  '# Duplicate Genius entries\n\n' + intro + section('duplicate', 'Duplicates'),
);
console.log(
  `Reports written: ${entries('excluded').length} excluded, ${entries('review').length} uncertain, ${entries('duplicate').length} duplicates.`,
);
