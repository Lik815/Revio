const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Resolve modules from the workspace root so pnpm symlinks work
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Explicit mappings for packages not symlinked by pnpm into project node_modules
config.resolver.extraNodeModules = {
  '@react-native/assets-registry': path.resolve(
    workspaceRoot,
    'node_modules/.pnpm/@react-native+assets-registry@0.74.87/node_modules/@react-native/assets-registry',
  ),
};

// Force React 18 for mobile — prevents duplicate React (admin uses React 19)
// Maps module name → real file path in mobile's own node_modules (no symlinks)
const REACT_MODULE_MAP = {
  'react': 'react/index.js',
  'react-dom': 'react-dom/index.js',
  'react/jsx-runtime': 'react/jsx-runtime.js',
  'react/jsx-dev-runtime': 'react/jsx-dev-runtime.js',
  'react-dom/client': 'react-dom/client.js',
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const mapped = REACT_MODULE_MAP[moduleName];
  if (mapped) {
    return {
      filePath: path.resolve(projectRoot, 'node_modules', mapped),
      type: 'sourceFile',
    };
  }
  // Stub react-native-maps on web (native-only library)
  if (moduleName === 'react-native-maps' && platform === 'web') {
    return {
      filePath: path.resolve(projectRoot, 'src/MapStub.js'),
      type: 'sourceFile',
    };
  }
  if (typeof context.resolveRequest === 'function') {
    return context.resolveRequest(context, moduleName, platform);
  }
  return null;
};

// Follow symlinks (required for pnpm)
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
