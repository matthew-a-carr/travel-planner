import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const RUNTIME_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const IMPORT_PATTERN =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

function runtimeFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...runtimeFiles(absolute));
      continue;
    }
    if (!RUNTIME_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (/\.(?:test|spec)\.[^.]+$/.test(entry.name)) continue;
    files.push(absolute);
  }
  return files;
}

function imports(source) {
  const specifiers = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) specifiers.push(match[1]);
  return specifiers;
}

export function findMobileArchitectureViolations(repoRoot) {
  const mobileRoot = path.resolve(repoRoot, 'apps/mobile');
  const sourceRoots = [path.join(mobileRoot, 'app'), path.join(mobileRoot, 'src')];
  const violations = [];

  for (const file of sourceRoots.flatMap(runtimeFiles)) {
    const relativeFile = path.relative(repoRoot, file);
    for (const specifier of imports(readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier);
        if (target !== mobileRoot && !target.startsWith(`${mobileRoot}${path.sep}`)) {
          violations.push(`${relativeFile} imports ${specifier} outside apps/mobile`);
        }
        continue;
      }
      if (specifier.startsWith('@travel-planner/') && specifier !== '@travel-planner/shared') {
        violations.push(`${relativeFile} imports forbidden workspace package ${specifier}`);
      }
    }
  }

  return violations.sort();
}
