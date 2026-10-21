// Copies the domain/application/adapters code and data into docs/ so the static page runs the same code as the tests.
import { cpSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
mkdirSync(`${root}docs/data`, { recursive: true });
cpSync(`${root}src`, `${root}docs/src`, { recursive: true });
cpSync(`${root}data/gs/credits-sample.json`, `${root}docs/data/credits-sample.json`);
cpSync(`${root}data/eval/results.json`, `${root}docs/data/results.json`);
console.log('site built:', readdirSync(`${root}docs`).join(', '));
import { existsSync } from 'node:fs';
if (existsSync(`${root}data/narrative/results-browser.json`)) {
  const r = JSON.parse(readFileSync(`${root}data/narrative/results-browser.json`, 'utf8')); delete r.rows;
  cpSync(`${root}data/narrative/pairs.json`, `${root}docs/data/narrative-pairs.json`);
  (await import('node:fs')).writeFileSync(`${root}docs/data/narrative.json`, JSON.stringify(r, null, 1));
}
