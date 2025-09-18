module.exports = {
  dependencies: {
    'react-native-vector-icons': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-vector-icons/android',
          packageImportPath: 'import io.github.oblador.vectoricons.VectorIconsPackage;',
        },
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