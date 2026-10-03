// Copies keyboard definitions into keyboards/.
//
//   npm run add-keyboard keychron/q1        every definition under that folder of the VIA repository
//   npm run add-keyboard ./my-board.json    a definition file from disk (goes to keyboards/custom/)
//   npm run add-keyboard -- --search q1     list matching folders of the VIA repository
//
// Definitions from the VIA repository (github.com/the-via/keyboards) are GPL-3.0 licensed.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'the-via/keyboards';
const BRANCH = 'master';
const KEYBOARDS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'keyboards');

const usbId = (definition) =>
  `${Number.parseInt(definition.vendorId, 16)}:${Number.parseInt(definition.productId, 16)}`;

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

async function listRemote() {
  const url = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GitHub answered ${response.status} ${response.statusText}`);
  const { tree } = await response.json();
  return tree
    .filter((entry) => entry.type === 'blob' && /^v3\/.+\.json$/.test(entry.path))
    .map((entry) => entry.path.slice('v3/'.length));
}

async function save(relative, text, known) {
  const definition = JSON.parse(text);
  assertDefinition(definition, relative);

  const target = path.resolve(KEYBOARDS, relative);
  if (!target.startsWith(KEYBOARDS + path.sep)) throw new Error(`Refusing to write outside keyboards/: ${relative}`);

  const id = usbId(definition);
  const owner = known.get(id);
  if (owner && path.resolve(KEYBOARDS, owner) !== target) {
    console.log(`  skipped  ${definition.name}: keyboards/${owner} already covers this USB id`);
    return false;
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, text.endsWith('\n') ? text : `${text}\n`);
  known.set(id, relative);
  console.log(`  added    ${definition.name}  ->  keyboards/${relative.split(path.sep).join('/')}`);
  return true;
}

async function addFromDisk(file) {
  const text = await fs.readFile(file, 'utf8');
  return (await save(path.join('custom', path.basename(file)), text, await existingKeyboards())) ? 1 : 0;
}

async function addFromVia(query) {
  const prefix = query.replace(/^\/+|\/+$/g, '');
  const matches = (await listRemote()).filter(
    (file) => file === prefix || file === `${prefix}.json` || file.startsWith(`${prefix}/`),
  );
  if (matches.length === 0) {
    throw new Error(`Nothing called "${prefix}" in the VIA repository. Try: npm run add-keyboard -- --search ${prefix.split('/').pop()}`);
  }

  const known = await existingKeyboards();
  let added = 0;
  for (const file of matches) {
    const response = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/v3/${file}`);
    if (!response.ok) throw new Error(`Could not download ${file}: ${response.status}`);
    if (await save(file, await response.text(), known)) added += 1;
  }
  return added;
}

async function search(term) {
  const needle = term.toLowerCase();
  const folders = new Set(
    (await listRemote())
      .filter((file) => file.toLowerCase().includes(needle))
      .map((file) => path.posix.dirname(file)),
  );
  if (folders.size === 0) console.log(`No keyboard in the VIA repository matches "${term}".`);
  for (const folder of [...folders].sort()) console.log(`  npm run add-keyboard ${folder}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--search' && args[1]) return search(args[1]);
  if (args.length !== 1 || args[0].startsWith('-')) {
    console.log('Usage:');
    console.log('  npm run add-keyboard <vendor/board>     e.g. keychron/q1');
    console.log('  npm run add-keyboard <file.json>        a definition file on disk');
    console.log('  npm run add-keyboard -- --search <text>');
    process.exitCode = 1;
    return undefined;
  }

  const [target] = args;
  const isFile = target.endsWith('.json') && (await fs.stat(target).catch(() => null))?.isFile();
  const added = isFile ? await addFromDisk(target) : await addFromVia(target);
  console.log(`\n${added} keyboard${added === 1 ? '' : 's'} added. Run "npm run check" to validate.`);
  return undefined;
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
