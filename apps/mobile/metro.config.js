// Metro configuration for the Expo app inside the pnpm monorepo.
//
// As of Expo SDK 54, `getDefaultConfig` detects the pnpm workspace and
// configures `watchFolders`, `resolver.nodeModulesPaths`, and symlink
// resolution automatically. The manual Metro config that lived here
// previously (per the original ADR 052 §3) broke transitive-dep
// resolution under the SDK 54 layout where some packages ship `src/*`
// entry points whose adjacent `node_modules` is reachable only via
// hierarchical lookup.
//
// See ADR 053 for the rationale; ADR 052 §3 has an amendment pointer.
//
// Do not re-add manual `watchFolders` / `nodeModulesPaths` /
// `disableHierarchicalLookup` overrides without first reading ADR 053.

const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
