const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const assetsRegistryPath = path.dirname(
  require.resolve('@react-native/assets-registry/package.json', {
    paths: [projectRoot, workspaceRoot],
  }),
);

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
  '@react-native/assets-registry': assetsRegistryPath,
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

  // ── Map platform split ────────────────────────────────────────────────────
  // react-native-maps is a native-only library (MapKit on iOS, Google Maps on
  // Android). It must never be bundled into the web build.
  //
  // Strategy: two independent guards so neither can fail alone.
  //   1. Metro resolver (here): replaces the import at bundle time for web.
  //      This is the authoritative guard — react-native-maps never enters the
  //      web bundle even if dead-code elimination misses the branch below.
  //   2. Runtime Platform.OS check (mobile-discover-screen.js): signals dead
  //      code to the bundler so the else-branch is eliminated on web. Acts as
  //      an explicit, readable declaration of intent in the source file.
  //
  // MapStub.js exports the same API surface (default MapView, Marker, Circle)
  // so the rest of mobile-discover-screen.js is platform-agnostic.
  // ─────────────────────────────────────────────────────────────────────────
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
