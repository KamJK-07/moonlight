// Metro config for an npm-workspaces monorepo. Without this, Metro won't
// find @moonlight/core (hoisted to the repo root's node_modules) or watch
// it for changes — the two most common "works in tsc, breaks in Expo"
// surprises in a workspace setup like this one.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so edits to packages/core are picked up.
config.watchFolders = [monorepoRoot];

// Resolve node_modules from both this package and the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// @moonlight/core is consumed from source (not its built dist/) for the
// same reason the desktop app aliases it: Metro bundles TypeScript
// directly, so there's no CJS-interop barrel-export problem to work
// around, and app code always reflects the latest source without a
// separate `npm run build --workspace packages/core` step first.
config.resolver.extraNodeModules = {
  '@moonlight/core': path.resolve(monorepoRoot, 'packages/core/src'),
};

module.exports = config;
