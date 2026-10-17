// Copies the domain/application/adapters code and data into docs/ so the static page runs the same code as the tests.
import { cpSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
mkdirSync(`${root}docs/data`, { recursive: true });
cpSync(`${root}src`, `${root}docs/src`, { recursive: true });
cpSync(`${root}data/gs/credits-sample.json`, `${root}docs/data/credits-sample.json`);
cpSync(`${root}data/eval/results.json`, `${root}docs/data/results.json`);
console.log('site built:', readdirSync(`${root}docs`).join(', '));
