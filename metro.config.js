/**
 * Minimal Metro configuration for React Native
 * This file ensures Metro can start and resolve project files.
 */
const { getDefaultConfig } = require('@react-native/metro-config');

// Use the default configuration provided by React Native's metro config helper.
// This ensures `assetRegistryPath` and assetExts/sourceExts are set correctly.
module.exports = getDefaultConfig(__dirname);
