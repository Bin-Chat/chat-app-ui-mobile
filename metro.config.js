const path = require('path');
const Module = require('module');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const mobileModules = path.resolve(projectRoot, 'node_modules');

// ─── Monorepo fix ─────────────────────────────────────────────────────────────
// nativewind is hoisted to root node_modules, but react-native lives only in
// apps/mobile/node_modules. Intercept resolution for react-native so that
// nativewind's nested react-native-css-interop can find it.
const _origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'react-native' || request.startsWith('react-native/')) {
    try {
      return _origResolve.call(this, request, parent, isMain, options);
    } catch (_) {
      return _origResolve.call(this, request, parent, isMain, {
        ...options,
        paths: [mobileModules, ...(options && options.paths ? options.paths : [])],
      });
    }
  }
  return _origResolve.call(this, request, parent, isMain, options);
};
// ─────────────────────────────────────────────────────────────────────────────

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [mobileModules, path.resolve(monorepoRoot, 'node_modules')];

// react-native-css-interop is nested inside nativewind/node_modules but
// expo-router v6 imports it directly. Tell Metro where to find it via
// extraNodeModules (fallback when normal lookup fails).
const cssInteropPath = path.resolve(
  monorepoRoot,
  'node_modules/nativewind/node_modules/react-native-css-interop'
);

config.resolver.extraNodeModules = {
  'react-native-css-interop': cssInteropPath,
};

config.resolver.alias = {
  '@': path.resolve(projectRoot, 'src'),
};

// ─── React version pinning ────────────────────────────────────────────────────
// Root node_modules has React 18.3.1 (hoisted from backend services).
// Mobile uses React 19.1.0. extraNodeModules is a FALLBACK — it only fires
// when normal resolution fails. Since root always has React 18, extraNodeModules
// for 'react' never activates, and react-native (in root) picks up React 18,
// causing "Cannot read property 'S' of undefined" in ReactFabric at startup.
//
// resolver.resolveRequest runs BEFORE any lookup, guaranteeing the override.
// Pre-resolve paths at config-load time (synchronous, runs once at startup).
const PINNED_TO_MOBILE = {
  react: require.resolve('react', { paths: [mobileModules] }),
  'react/jsx-runtime': require.resolve('react/jsx-runtime', { paths: [mobileModules] }),
  'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime', { paths: [mobileModules] }),
  scheduler: require.resolve('scheduler', { paths: [mobileModules] }),
};
// ─────────────────────────────────────────────────────────────────────────────

// Apply nativewind BEFORE wrapping resolveRequest so we can place our
// react-pinning resolver at the front of the chain.
const nativewindConfig = withNativeWind(config, { input: './global.css' });

const prevResolveRequest = nativewindConfig.resolver.resolveRequest;
nativewindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force react and scheduler to always come from mobile (React 19).
  if (Object.prototype.hasOwnProperty.call(PINNED_TO_MOBILE, moduleName)) {
    return { type: 'sourceFile', filePath: PINNED_TO_MOBILE[moduleName] };
  }
  // Fall through to nativewind resolver → default Metro resolver.
  const fallback = prevResolveRequest || context.resolveRequest;
  return fallback(context, moduleName, platform);
};

module.exports = nativewindConfig;
