// Produces dist/ from src/. The site is plain ES modules, so the build is an exact copy.
// `--check` compares the two without writing and exits 1 on any difference.
import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

/** @param {string} dir @returns {Promise<string[]>} */
async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat().sort();
}

if (process.argv.includes('--check')) {
  const expected = await listFiles(src);
  const actual = await listFiles(dist).catch(() => []);
  const problems = [];
  const names = new Set(actual.map((file) => relative(dist, file)));
  for (const file of expected) {
    const name = relative(src, file);
    if (!names.delete(name)) {
      problems.push(`missing from dist: ${name}`);
      continue;
    }
    const [a, b] = await Promise.all([readFile(file), readFile(join(dist, name))]);
    if (!a.equals(b)) problems.push(`differs: ${name}`);
  }
  for (const name of names) problems.push(`not in src: ${name}`);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`dist matches src (${expected.length} files)`);
} else {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(src, dist, { recursive: true });
  const files = await listFiles(dist);
  console.log(`dist rebuilt (${files.length} files)`);
}
