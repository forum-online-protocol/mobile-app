import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Animated,
} from 'react-native';
import { useNavigation } from '../contexts/NavigationContext';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { useLocalization } from '../hooks/useLocalization';

interface MRZData {
  documentNumber: string;
  dateOfBirth: string;
  dateOfExpiry: string;
}

const MRZScannerScreen = () => {
  console.log('[MRZScannerScreen] Component initializing');
  
  let navigation;
  try {
    navigation = useNavigation();
    console.log('[MRZScannerScreen] Navigation context:', navigation);
  } catch (error) {
    console.error('[MRZScannerScreen] Error getting navigation context:', error);
    navigation = null;
  }
  
  if (!navigation || !navigation.navigate || !navigation.goBack) {
    console.error('[MRZScannerScreen] Navigation context is invalid:', navigation);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: 'red', textAlign: 'center', marginBottom: 10 }}>
          Navigation Error
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
          Navigation context not available. Please restart the app.
        </Text>
      </View>
    );
  }
  
  const { navigate, goBack } = navigation;
  const { t } = useLocalization();
  console.log('[MRZScannerScreen] Navigate function:', typeof navigate, 'GoBack function:', typeof goBack);
  
  const [isScanning, setIsScanning] = useState(false);

  // Check if running on HarmonyOS
  const isHarmonyOS = () => {
    try {
      const { NativeModules } = require('react-native');
      return Platform.OS === 'android' && (
        global.HarmonyOS || 
        NativeModules?.HarmonyOSModule ||
        (typeof __HARMONY__ !== 'undefined')
      );
    } catch {
      return false;
    }
  };

  useEffect(() => {
    console.log('[MRZScannerScreen] Component mounted');
    if (isHarmonyOS()) {
      console.log('[MRZScannerScreen] HarmonyOS detected - OCR scanner may not work properly');
    }
  }, []);


  const startMRZScan = async (documentType: 'passport' | 'idcard') => {
    console.log('[MRZScannerScreen] startMRZScan button clicked for:', documentType);
    
    // Check for HarmonyOS compatibility
    if (isHarmonyOS()) {
      Alert.alert(
        t('harmonyos.compatibilityTitle'),
        t('harmonyos.compatibilityMessage'),
        [
          { text: t('harmonyos.tryAnyway'), onPress: () => continueWithScan(documentType) },
          { text: t('harmonyos.manualEntry'), onPress: () => handleManualInput() }
        ]
      );
      return;
    }
    
    continueWithScan(documentType);
  };

  const handleManualInput = () => {
    console.log('[MRZScannerScreen] Navigating to manual input screen');
    navigate('MRZManualInputScreen');
  };

  
  const continueWithScan = async (documentType: 'passport' | 'idcard') => {
    setIsScanning(true);
    
    // Request camera permission first
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs camera access to scan passport MRZ',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Camera permission is required to scan MRZ');
          setIsScanning(false);
          return;
        }
      } catch (err) {
        console.warn(err);
        setIsScanning(false);
        return;
      }
    }
    
    // Launch native MRZ scanner
    console.log('[MRZScannerScreen] Launching native MRZ scanner');
    const { NativeModules, NativeEventEmitter } = require('react-native');
    const { PassportReader } = NativeModules;
    
    console.log('[MRZScannerScreen] NativeModules available:', Object.keys(NativeModules));
    console.log('[MRZScannerScreen] PassportReader module:', PassportReader);
    
    if (PassportReader && PassportReader.startMRZScanner) {
      console.log('[MRZScannerScreen] Calling PassportReader.startMRZScanner()');
      
      // Set up event listeners with proper checks
      let eventEmitter;
      try {
        // Check if the module supports EventEmitter interface
        if (PassportReader && typeof PassportReader.addListener === 'function') {
          console.log('[MRZScannerScreen] Using PassportReader as EventEmitter');
          eventEmitter = new NativeEventEmitter(PassportReader);
        } else {
          console.log('[MRZScannerScreen] Creating standalone EventEmitter');
          // Create a standalone EventEmitter when module doesn't support it
          eventEmitter = new NativeEventEmitter();
        }
      } catch (error) {
        console.warn('[MRZScannerScreen] EventEmitter creation failed, using fallback:', error);
        eventEmitter = new NativeEventEmitter();
      }
      
      const successListener = eventEmitter.addListener('mrzScanSuccess', async (data) => {
        try {
          console.log('[MRZScannerScreen] ✅ MRZ scan success received:', data);
          console.log('[MRZScannerScreen] Data type:', typeof data);
          
          if (data && typeof data === 'object') {
            console.log('[MRZScannerScreen] Data keys:', Object.keys(data));
          } else {
            console.warn('[MRZScannerScreen] Data is not an object:', data);
            setIsScanning(false);
            return;
          }
          
          // Clean up event listeners safely
          if (successListener && typeof successListener.remove === 'function') {
            successListener.remove();
          }
          if (errorListener && typeof errorListener.remove === 'function') {
            errorListener.remove();
          }
          
          const mrz: MRZData = {
            documentNumber: data.documentNumber || '',
            dateOfBirth: data.dateOfBirth || '',
            dateOfExpiry: data.dateOfExpiry || '',
          };
          console.log('[MRZScannerScreen] Created MRZ object:', mrz);
          
          // Store MRZ data in AsyncStorage
          try {
            const AsyncStorageService = require('../services/AsyncStorageService').default;
            await AsyncStorageService.setItem('mrz_data', JSON.stringify(mrz));
            console.log('[MRZScannerScreen] MRZ data stored in AsyncStorage');
          } catch (storageError) {
            console.error('[MRZScannerScreen] Failed to store MRZ data:', storageError);
          }
          
          setIsScanning(false);
          
          console.log('[MRZScannerScreen] About to navigate to PassportScanScreen with MRZ data');
          
          // Navigate directly to PassportScanScreen with MRZ data
          try {
            if (navigate && typeof navigate === 'function') {
              navigate('PassportScanScreen', { mrzData: mrz });
              console.log('[MRZScannerScreen] Navigation to PassportScanScreen completed');
            } else {
              console.error('[MRZScannerScreen] Navigate function not available');
              Alert.alert('Navigation Error', 'Cannot navigate to passport scan.');
            }
          } catch (navError) {
            console.error('[MRZScannerScreen] Error during navigation:', navError);
            Alert.alert('Navigation Error', 'Failed to navigate to passport scan: ' + navError.message);
          }
        } catch (error) {
          console.error('[MRZScannerScreen] Error in mrzScanSuccess handler:', error);
          // Clean up event listeners safely
          if (successListener && typeof successListener.remove === 'function') {
            successListener.remove();
          }
          if (errorListener && typeof errorListener.remove === 'function') {
            errorListener.remove();
          }
          setIsScanning(false);
          Alert.alert('Error', 'Failed to process MRZ data: ' + error.message);
        }
      });
      
      const errorListener = eventEmitter.addListener('mrzScanError', (error) => {
        console.log('[MRZScannerScreen] ❌ MRZ scan error received:', error);
        console.log('[MRZScannerScreen] Error type:', typeof error);
        console.log('[MRZScannerScreen] Error keys:', Object.keys(error));
        console.log('[MRZScannerScreen] Error code:', error.code);
        console.log('[MRZScannerScreen] Error message:', error.message);
        
        successListener.remove();
        errorListener.remove();
        setIsScanning(false);
        
        console.log('[MRZScannerScreen] Showing error alert');
        Alert.alert('Scan Error', error.message);
      });
      
      // Start the appropriate scanner based on document type
      try {
        const scannerPromise = documentType === 'passport' 
          ? PassportReader.startMRZScanner()
          : PassportReader.startIDCardScanner();
          
        scannerPromise
          .then(() => {
            console.log('[MRZScannerScreen] MRZ Scanner started successfully for:', documentType);
          })
          .catch((error: any) => {
            console.error('[MRZScannerScreen] Failed to start scanner:', error);
            successListener.remove();
            errorListener.remove();
            setIsScanning(false);
            Alert.alert('Error', 'Failed to start camera scanner: ' + (error?.message || 'Unknown error'));
          });
      } catch (syncError) {
        console.error('[MRZScannerScreen] Sync error starting scanner:', syncError);
        successListener.remove();
        errorListener.remove();
        setIsScanning(false);
        Alert.alert('Error', 'Failed to start scanner: ' + (syncError?.message || 'Unknown error'));
      }
    } else {
      console.log('[MRZScannerScreen] PassportReader module not available');
      setIsScanning(false);
      Alert.alert('Not Available', 'Camera scanner not available.');
    }
  };





  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header with small logo */}
      <View style={styles.header}>
        <Logo size="small" color="primary" />
        <TouchableOpacity
          onPress={() => {
            try {
              console.log('[MRZScannerScreen] Back button pressed');
              console.log('[MRZScannerScreen] Current screen history:', navigation.screenHistory);
              console.log('[MRZScannerScreen] Can go back:', navigation.canGoBack());
              
              if (navigation.canGoBack()) {
                console.log('[MRZScannerScreen] Executing goBack...');
                goBack();
                console.log('[MRZScannerScreen] GoBack executed');
              } else {
                console.warn('[MRZScannerScreen] Cannot go back, navigating to Auth');
                navigate('Auth');
              }
            } catch (error) {
              console.error('[MRZScannerScreen] Error during goBack:', error);
              // Fallback navigation to Auth screen
              navigate('Auth');
            }
          }}
          style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}>
        
        {/* Main Content */}
        <View style={styles.mainContent}>
          <Text style={styles.title}>{t('passport.scanYourDocument')}</Text>
          <Text style={styles.subtitle}>{t('passport.stepOneOfTwo')}</Text>
          
          {/* Process Steps */}
          <View style={styles.processContainer}>
            <View style={styles.processStep}>
              <View style={[styles.stepIndicator, styles.activeStep]}>
                <Text style={[styles.stepNumber, {color: '#FFFFFF'}]}>1</Text>
              </View>
              <Text style={styles.stepTitle}>{t('passport.scanMrz')}</Text>
              <Text style={styles.stepDescription}>{t('passport.stepOneOfTwo')}</Text>
            </View>
            
            <View style={styles.processLine} />
            
            <View style={styles.processStep}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepNumber}>2</Text>
              </View>
              <Text style={styles.stepTitle}>{t('passport.nfcRead')}</Text>
              <Text style={styles.stepDescription}>{t('passport.verifyWithChip')}</Text>
            </View>
          </View>

          {/* Scan Buttons */}
          <View style={styles.scanButtonsContainer}>
            <TouchableOpacity
              onPress={() => startMRZScan('passport')}
              activeOpacity={0.8}
              style={styles.primaryButton}>
              <Icon name="camera" variant="filled" size={20} color="#FFFFFF" style={{marginRight: 8}} />
              <Text style={styles.buttonText}>{t('auth.scanPassport')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => startMRZScan('idcard')}
              activeOpacity={0.8}
              style={styles.secondaryButtonAlt}>
              <Icon name="camera" variant="filled" size={20} color="#1D9BF0" style={{marginRight: 8}} />
              <Text style={styles.secondaryButtonTextAlt}>{t('auth.scanIdCard')}</Text>
            </TouchableOpacity>
          </View>

          {/* OR Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Manual Input Button */}
          <TouchableOpacity
            onPress={handleManualInput}
            activeOpacity={0.8}
            style={styles.secondaryButton}>
            <Icon name="document" variant="outline" size={20} color="#1D9BF0" style={{marginRight: 8}} />
            <Text style={styles.secondaryButtonText}>{t('auth.enterManually')}</Text>
          </TouchableOpacity>

          {/* Info Container */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>{t('instructions.instructionsTitle')}</Text>
            <Text style={styles.infoText}>
              • {t('instructions.forPassports')}{'\n'}
              • {t('instructions.forIdCards')}{'\n'}
              • {t('instructions.positionCamera')}{'\n'}
              • {t('instructions.holdSteady')}{'\n'}
              • {t('instructions.goodLighting')}
            </Text>
          </View>

          {/* Visual Guide */}
          <View style={styles.visualGuide}>
            <Text style={styles.visualTitle}>{t('instructions.lookForMrz')}</Text>
            <View style={styles.mrzExample}>
              <Text style={styles.mrzLine}>P&lt;USADOE&lt;&lt;JOHN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</Text>
              <Text style={styles.mrzLine}>L898902C36USA7408122M1204159ZE184226B&lt;&lt;&lt;&lt;&lt;10</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1D9BF0',
    fontWeight: '600',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: Platform.OS === 'web' ? '10%' : 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxWidth: Platform.OS === 'web' ? 400 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  mainContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F1419',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#536471',
    textAlign: 'center',
    marginBottom: 32,
  },
  processContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  processStep: {
    alignItems: 'center',
    flex: 1,
  },
  stepIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeStep: {
    backgroundColor: '#1D9BF0',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F1419',
    marginBottom: 4,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 12,
    color: '#536471',
    textAlign: 'center',
  },
  processLine: {
    flex: 0.3,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 10,
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 9999,
    alignItems: 'center',
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoContainer: {
    backgroundColor: '#F7F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EFF3F4',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1419',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#536471',
    lineHeight: 20,
  },
  visualGuide: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  visualTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F1419',
    marginBottom: 12,
    textAlign: 'center',
  },
  mrzExample: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  mrzLine: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#00FF00',
    letterSpacing: 1,
  },
  // Divider styles
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  // Scan buttons container
  scanButtonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  // Secondary button styles
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#1D9BF0',
  },
  secondaryButtonText: {
    color: '#1D9BF0',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonAlt: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 9999,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1D9BF0',
  },
  secondaryButtonTextAlt: {
    color: '#1D9BF0',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MRZScannerScreen;