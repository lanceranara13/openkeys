// Adds keyboard definitions to keyboards/ and checks them.
//
//   npm run add-keyboard q1               find "q1" in the VIA collection and add it
//   npm run add-keyboard keychron q1      several words narrow the search
//   npm run add-keyboard ./my-board.json  add a definition file from disk
//
// Definitions from the VIA collection (github.com/the-via/keyboards) are GPL-3.0 licensed.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const REPO = 'the-via/keyboards';
const BRANCH = 'master';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEYBOARDS = path.join(ROOT, 'keyboards');
// More matches than this is a search that needs another word, not a list to read.
const MAX_CHOICES = 15;

const usbId = (definition) =>
  `${Number.parseInt(definition.vendorId, 16)}:${Number.parseInt(definition.productId, 16)}`;

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function assertDefinition(definition, source) {
  const missing = ['name', 'vendorId', 'productId', 'matrix', 'layouts'].filter(
    (field) => definition?.[field] === undefined,
  );
  if (missing.length > 0) {
    throw new Error(`${source} is not a keyboard definition (missing ${missing.join(', ')})`);
  }
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(full);
      return entry.name.endsWith('.json') ? [full] : [];
    }),
  );
  return nested.flat();
}

/** USB id -> file, for every definition already in keyboards/. */
async function existingKeyboards() {
  const known = new Map();
  for (const file of await listFiles(KEYBOARDS)) {
    const definition = JSON.parse(await fs.readFile(file, 'utf8'));
    known.set(usbId(definition), path.relative(KEYBOARDS, file));
  }
  return known;
}

/** Every definition of the VIA collection, as "vendor/board/.../file.json". */
async function listRemote() {
  const url = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GitHub answered ${response.status} ${response.statusText}`);
  const { tree } = await response.json();
  return tree
    .filter((entry) => entry.type === 'blob' && /^v3\/.+\.json$/.test(entry.path))
    .map((entry) => entry.path.slice('v3/'.length));
}

/** "keychron/q1/v2/ansi.json" -> "keychron/q1": one board with all its variants. */
const boardOf = (file) => file.replace(/\.json$/, '').split('/').slice(0, 2).join('/');

async function save(relative, text, known) {
  const definition = JSON.parse(text);
  assertDefinition(definition, relative);

  const target = path.resolve(KEYBOARDS, relative);
  if (!target.startsWith(KEYBOARDS + path.sep)) {
    throw new Error(`Refusing to write outside keyboards/: ${relative}`);
  }

  const id = usbId(definition);
  const owner = known.get(id);
  if (owner && path.resolve(KEYBOARDS, owner) !== target) {
    console.log(`  skipped  ${definition.name}: keyboards/${owner} already covers this USB id`);
    return false;
  }

  const verb = owner ? 'updated' : 'added  ';
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, text.endsWith('\n') ? text : `${text}\n`);
  known.set(id, relative);
  console.log(`  ${verb}  ${definition.name}  ->  keyboards/${relative.split(path.sep).join('/')}`);
  return true;
}

async function addFromDisk(file) {
  const text = await fs.readFile(file, 'utf8');
  const definition = JSON.parse(text);
  assertDefinition(definition, file);

  // The first folder is the brand a keyboard is listed under: use the first word of its name.
  const name = typeof definition.name === 'string' ? definition.name : '';
  const brand = name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'custom';
  const added = await save(path.join(brand, path.basename(file)), text, await existingKeyboards());
  return added ? 1 : 0;
}

async function addFromVia(files) {
  const known = await existingKeyboards();
  let added = 0;
  for (const file of files) {
    const response = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/v3/${file}`);
    if (!response.ok) throw new Error(`Could not download ${file}: ${response.status}`);
    if (await save(file, await response.text(), known)) added += 1;
  }
  return added;
}

/** Finds the board the words describe, asking when several fit. Returns its files. */
async function chooseFromVia(words) {
  const files = await listRemote();

  // "keychron/q1" or "keychron/q1/v2" names a folder outright.
  const exact = words.join('/').replace(/^\/+|\/+$/g, '');
  const inFolder = files.filter(
    (file) => file === exact || file === `${exact}.json` || file.startsWith(`${exact}/`),
  );
  if (inFolder.length > 0) return inFolder;

  const boards = new Map();
  for (const file of files) {
    const text = file.toLowerCase();
    if (words.every((word) => text.includes(word.toLowerCase()))) {
      const board = boardOf(file);
      boards.set(board, [...(boards.get(board) ?? []), file]);
    }
  }

  const names = [...boards.keys()].sort();
  if (names.length === 0) {
    throw new Error(
      `No keyboard in the VIA collection matches "${words.join(' ')}". ` +
        'Try a shorter word, or get the definition file from the maker and run: ' +
        'npm run add-keyboard ./that-file.json',
    );
  }
  if (names.length === 1) return boards.get(names[0]);
  if (names.length > MAX_CHOICES) {
    throw new Error(
      `${names.length} keyboards match "${words.join(' ')}". Add a word to narrow it down, ` +
        `for example: npm run add-keyboard ${names[0].replace('/', ' ')}`,
    );
  }

  console.log(`\n${names.length} keyboards match "${words.join(' ')}":\n`);
  names.forEach((name, index) => {
    console.log(`  ${String(index + 1).padStart(2)}. ${name}  (${plural(boards.get(name).length, 'definition')})`);
  });

  if (!process.stdin.isTTY) {
    console.log(`\nRun it again with the one you want, for example: npm run add-keyboard ${names[0]}`);
    return [];
  }
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question('\nWhich one? Type its number (Enter cancels): ');
  prompt.close();
  const picked = names[Number.parseInt(answer, 10) - 1];
  if (!picked) {
    console.log('Nothing added.');
    return [];
  }
  return boards.get(picked);
}

/** Runs every definition in keyboards/ through the parser the app uses. */
function check() {
  console.log('\nChecking keyboards/ ...');
  // One command string: npx is a script on Windows and needs the shell to run.
  const result = spawnSync('npx vitest run tests/keyboards.test.ts', {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  return result.status === 0;
}

async function main() {
  // "--search" was a separate step once; searching is what plain words do now.
  const words = process.argv.slice(2).filter((word) => word !== '--search');
  if (words.length === 0 || words.some((word) => word.startsWith('-'))) {
    console.log('Usage:');
    console.log('  npm run add-keyboard <words>        find a keyboard in the VIA collection, e.g. q1');
    console.log('  npm run add-keyboard <file.json>    add a definition file from disk');
    process.exitCode = 1;
    return;
  }

  const [first] = words;
  const isFile =
    words.length === 1 &&
    first.endsWith('.json') &&
    (await fs.stat(first).catch(() => null))?.isFile();
  const added = isFile ? await addFromDisk(first) : await addFromVia(await chooseFromVia(words));
  if (added === 0) return;

  console.log(`\n${plural(added, 'keyboard')} written.`);
  if (!check()) {
    console.log('\nA definition has a problem. The message above names the file and what is wrong.');
    process.exitCode = 1;
    return;
  }
  console.log('\nDone. To look at it: npm run dev, then open the Keyboards page.');
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
