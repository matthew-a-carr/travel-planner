import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const config = parse(
  readFileSync(resolve(import.meta.dirname, '../../../.github/dependabot.yml'), 'utf8'),
);
const npm = config.updates.find(
  (update: { 'package-ecosystem': string }) => update['package-ecosystem'] === 'npm',
);

describe('Dependabot batching and compatibility holds', () => {
  it('groups security updates independently of routine updates for each ecosystem', () => {
    for (const update of config.updates) {
      expect(update.groups.security).toEqual({
        'applies-to': 'security-updates',
        patterns: ['*'],
      });
      expect(update.groups['minor-and-patch']['update-types']).toEqual(['minor', 'patch']);
      expect(update.groups.major['update-types']).toEqual(['major']);
    }
  });

  it('keeps the React DOM and test renderer versions aligned through deliberate upgrades', () => {
    for (const dependency of ['react', 'react-dom', '@types/react-dom', 'test-renderer']) {
      expect(npm.ignore).toContainEqual({ 'dependency-name': dependency });
    }
  });
});
