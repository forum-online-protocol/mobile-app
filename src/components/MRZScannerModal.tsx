import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
// Using PermissionsAndroid from react-native instead of react-native-permissions
import { PermissionsAndroid } from 'react-native';

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

const { width, height } = Dimensions.get('window');

const MRZScannerModal: React.FC<MRZScannerModalProps> = ({ 
  visible, 
  onClose, 
  onMRZScanned 
}) => {
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
            title: 'Camera Permission',
            message: 'This app needs access to your camera to scan passport MRZ.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setHasPermission(true);
          setIsScanning(true);
        } else {
          setHasPermission(false);
          Alert.alert(
            'Camera Permission Required',
            'Please enable camera access in settings to scan passport MRZ.',
            [
              { text: 'Cancel', onPress: onClose },
              { 
                text: 'Open Settings', 
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
          'Partial MRZ Data',
          'Document number was scanned. Please enter birth and expiry dates manually.',
          [
            {
              text: 'Continue',
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
          <Text style={styles.title}>Scan Passport MRZ</Text>
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
                Camera permission not granted
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>Position the MRZ in the frame</Text>
          <Text style={styles.instructionText}>
            The MRZ is the two lines of text at the bottom of your passport's photo page.
            Keep your passport steady and well-lit.
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: '#1a1a1a',
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
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 30,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
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
    color: '#FFFFFF',
    fontSize: 16,
  },
  instructions: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  instructionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionText: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  mrzExample: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  mrzExampleText: {
    color: '#00FF00',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
});

export default MRZScannerModal;