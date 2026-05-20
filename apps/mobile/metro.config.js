// Metro configuration for the Expo app inside the pnpm monorepo.
// See ADR 052 for the rationale: Metro's default module resolution
// doesn't speak pnpm's isolated symlink layout, so we point watchFolders
// at the workspace root and enable Metro's experimental symlink resolver.
// The alternative — `node-linker=hoisted` globally — would forfeit pnpm's
// strict isolation for the web app, which architecture tests rely on.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
