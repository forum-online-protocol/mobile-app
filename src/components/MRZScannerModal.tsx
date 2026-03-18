import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
// Using PermissionsAndroid from react-native instead of react-native-permissions
import { PermissionsAndroid } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { monoFontFamily } from '../styles/tokens';
import { useTranslation } from 'react-i18next';

// Conditional import to avoid errors on web
let MrzReader: any = null;
let CameraSelector: any = null;
let DocType: any = null;

// MRZ reader disabled: prevent attempting to load native module
// if (Platform.OS !== 'web') {
//   try {
//     const mrzModule = require('react-native-mrz-reader');
//     MrzReader = mrzModule.default;
//     CameraSelector = mrzModule.CameraSelector;
//     DocType = mrzModule.DocType;
//   } catch (error) {
//     console.log('MRZ Reader not available:', error);
//   }
// }

interface MRZScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onMRZScanned: (data: { 
    documentNumber: string; 
    dateOfBirth: string; 
    dateOfExpiry: string;
    rawMRZ?: string;
  }) => void;
}

const MRZScannerModal: React.FC<MRZScannerModalProps> = ({ 
  visible, 
  onClose, 
  onMRZScanned 
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (visible && Platform.OS !== 'web') {
      requestCameraPermission();
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('passport.cameraPermissionTitle'),
            message: t('passport.cameraPermissionMessage'),
            buttonNeutral: t('mrzScanner.askMeLater'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setHasPermission(true);
          setIsScanning(true);
        } else {
          setHasPermission(false);
          Alert.alert(
            t('passport.permissionDenied'),
            t('mrzScanner.enableCameraInSettings'),
            [
              { text: t('common.cancel'), onPress: onClose },
              { 
                text: t('nfcStatus.openSettings'), 
                onPress: () => {
                  // Use Linking to open settings
                  const { Linking } = require('react-native');
                  Linking.openSettings();
                  onClose();
                }
              }
            ]
          );
        }
      } else {
        // iOS - assume permission granted for now
        // In production, you'd use a proper permission library
        setHasPermission(true);
        setIsScanning(true);
      }
    } catch (err) {
      console.error('Camera permission error:', err);
      setHasPermission(false);
    }
  };

  const parseMRZ = (mrzString: string) => {
    // Parse MRZ string based on TD3 format (passport)
    // MRZ has 2 lines of 44 characters each
    const lines = mrzString.split('\n');
    
    if (lines.length < 2) {
      // Try to split if it's a continuous string
      if (mrzString.length >= 88) {
        lines[0] = mrzString.substring(0, 44);
        lines[1] = mrzString.substring(44, 88);
      } else {
        return null;
      }
    }

    const line2 = lines[1];
    
    // Extract data from line 2
    // Format: [Document Number (9)] [Check (1)] [Nationality (3)] [DOB (6)] [Check (1)] [Sex (1)] [Expiry (6)] [Check (1)]
    const documentNumber = line2.substring(0, 9).replace(/</g, '');
    const dateOfBirth = line2.substring(13, 19);
    const dateOfExpiry = line2.substring(21, 27);

    return {
      documentNumber,
      dateOfBirth,
      dateOfExpiry,
      rawMRZ: mrzString
    };
  };

  const handleMRZRead = (mrz: string) => {
    console.log('[MRZScanner] MRZ Read:', mrz);
    
    const parsedData = parseMRZ(mrz);
    
    if (parsedData && parsedData.documentNumber) {
      // Vibration feedback on successful scan
      if (Platform.OS !== 'web') {
        try {
          const { Vibration } = require('react-native');
          Vibration.vibrate(100);
        } catch {}
      }
      
      setIsScanning(false);
      
      // On Android, we might only get partial data
      if (Platform.OS === 'android' && 
          (!parsedData.dateOfBirth || !parsedData.dateOfExpiry)) {
        Alert.alert(
          t('mrzScanner.partialMrzDataTitle'),
          t('mrzScanner.partialMrzDataMessage'),
          [
            {
              text: t('common.continue'),
              onPress: () => onMRZScanned(parsedData)
            }
          ]
        );
      } else {
        onMRZScanned(parsedData);
      }
    }
  };

  if (Platform.OS === 'web' || !MrzReader) {
    // Fallback for web or when MRZ reader not available
    return null;
  }

  return (
    <Modal
      visible={visible && isScanning}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('passport.scanMrz')}</Text>
        </View>
        
        <View style={styles.cameraContainer}>
          {hasPermission && MrzReader ? (
            <MrzReader
              style={styles.camera}
              docType={DocType.Passport}
              cameraSelector={CameraSelector.Back}
              onMRZRead={handleMRZRead}
            />
          ) : (
            <View style={styles.noPermission}>
              <Text style={styles.noPermissionText}>
                {t('mrzScanner.cameraPermissionNotGranted')}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>{t('mrzScanner.positionMrzInFrame')}</Text>
          <Text style={styles.instructionText}>
            {t('mrzScanner.positionMrzDescription')}
          </Text>
          
          <View style={styles.mrzExample}>
            <Text style={styles.mrzExampleText}>P&lt;USADOE&lt;&lt;JOHN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</Text>
            <Text style={styles.mrzExampleText}>1234567890USA7001011M2501015&lt;&lt;&lt;&lt;&lt;&lt;</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.headerBackground,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '300',
  },
  title: {
    flex: 1,
    color: theme.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 30,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  noPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPermissionText: {
    color: theme.text,
    fontSize: 16,
  },
  instructions: {
    backgroundColor: theme.headerBackground,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  instructionTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionText: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  mrzExample: {
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  mrzExampleText: {
    color: theme.success,
    fontSize: 11,
    fontFamily: monoFontFamily,
    letterSpacing: 1,
  },
});

export default MRZScannerModal;
