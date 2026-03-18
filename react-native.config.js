module.exports = {
  dependencies: {
    'react-native-vector-icons': {
      platforms: {
        android: {},
      },
    },
    'react-native-nfc-manager': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-nfc-manager/android',
          packageImportPath: 'import community.revteltech.nfc.NfcManagerPackage;',
        },
      },
    },
  },
};