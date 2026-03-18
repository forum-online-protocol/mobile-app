const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  resolver: {
    // Ensure react-native-nfc-manager is properly resolved
    extraNodeModules: {
      'react-native-nfc-manager': __dirname + '/node_modules/react-native-nfc-manager',
    },
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);