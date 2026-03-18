import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation } from '../contexts/NavigationContext';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { useLocalization } from '../hooks/useLocalization';
import { useTheme } from '../contexts/ThemeContext';
import { monoFontFamily } from '../styles/tokens';

interface MRZData {
  documentNumber: string;
  dateOfBirth: string;
  dateOfExpiry: string;
}

const MRZScannerScreen = () => {
  console.log('[MRZScannerScreen] Component initializing');

  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  let navigation;
  try {
    navigation = useNavigation();
    console.log('[MRZScannerScreen] Navigation context:', navigation);
  } catch (error) {
    console.error('[MRZScannerScreen] Error getting navigation context:', error);
    navigation = null;
  }
  const { t } = useLocalization();
  const [isScanning, setIsScanning] = useState(false);

  // Check if running on HarmonyOS
  const isHarmonyOS = () => {
    try {
      const { NativeModules } = require('react-native');
      return Platform.OS === 'android' && (
        (global as any).HarmonyOS || 
        NativeModules?.HarmonyOSModule ||
        (typeof (global as any).__HARMONY__ !== 'undefined')
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

  if (!navigation || !navigation.navigate || !navigation.goBack) {
    console.error('[MRZScannerScreen] Navigation context is invalid:', navigation);
    return (
      <View style={styles.navigationErrorContainer}>
        <Text style={styles.navigationErrorTitle}>
          {t('mrzScanner.navigationErrorTitle')}
        </Text>
        <Text style={styles.navigationErrorText}>
          {t('mrzScanner.navigationErrorMessage')}
        </Text>
      </View>
    );
  }

  const { navigate, goBack } = navigation;
  console.log('[MRZScannerScreen] Navigate function:', typeof navigate, 'GoBack function:', typeof goBack);

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
            title: t('passport.cameraPermissionTitle'),
            message: t('passport.cameraPermissionMessage'),
            buttonNeutral: t('mrzScanner.askMeLater'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(t('passport.permissionDenied'), t('passport.cameraPermissionRequired'));
          setIsScanning(false);
          return;
        }
      } catch (err) {
        console.warn(err);
        setIsScanning(false);
        return;
      }
    }
    
    console.log('[MRZScannerScreen] Launching native MRZ scanner');
    const { NativeModules, NativeEventEmitter } = require('react-native');
    let PassportReader = NativeModules.PassportReader;
    
    if (!PassportReader) {
      PassportReader = NativeModules.PassportReaderModule;
      console.log('[MRZScannerScreen] Trying PassportReaderModule:', PassportReader);
    }
    
    if (!PassportReader) {
      const passportModules = Object.keys(NativeModules).filter(key => 
        key.toLowerCase().includes('passport') || key.toLowerCase().includes('reader')
      );
      console.log('[MRZScannerScreen] Found passport-related modules:', passportModules);
      if (passportModules.length > 0) {
        PassportReader = NativeModules[passportModules[0]];
        console.log('[MRZScannerScreen] Using module:', passportModules[0], PassportReader);
      }
    }
    
    console.log('[MRZScannerScreen] NativeModules available:', Object.keys(NativeModules));
    console.log('[MRZScannerScreen] PassportReader module:', PassportReader);
    console.log('[MRZScannerScreen] PassportReader methods:', PassportReader ? Object.getOwnPropertyNames(PassportReader) : 'Module not available');
    
    if (PassportReader && typeof PassportReader.startMRZScanner === 'function') {
      console.log('[MRZScannerScreen] ✅ PassportReader.startMRZScanner function found!');
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
              Alert.alert(t('mrzScanner.navigationErrorTitle'), t('mrzScanner.cannotNavigateToPassportScan'));
            }
          } catch (navError) {
            console.error('[MRZScannerScreen] Error during navigation:', navError);
            Alert.alert(t('mrzScanner.navigationErrorTitle'), `${t('mrzScanner.failedToNavigateToPassportScan')}: ${navError.message}`);
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
          Alert.alert(t('common.error'), `${t('mrzScanner.failedToProcessMrzData')}: ${error.message}`);
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
        Alert.alert(t('mrzScanner.scanErrorTitle'), error.message);
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
            Alert.alert(t('common.error'), `${t('mrzScanner.failedToStartCameraScanner')}: ${error?.message || t('common.unknown')}`);
          });
      } catch (syncError) {
        console.error('[MRZScannerScreen] Sync error starting scanner:', syncError);
        successListener.remove();
        errorListener.remove();
        setIsScanning(false);
        Alert.alert(t('common.error'), `${t('mrzScanner.failedToStartScanner')}: ${syncError?.message || t('common.unknown')}`);
      }
    } else {
      console.log('[MRZScannerScreen] PassportReader module not available');
      setIsScanning(false);
      Alert.alert(t('mrzScanner.notAvailableTitle'), t('mrzScanner.cameraScannerNotAvailable'));
    }
  };





  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
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
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('mrzScanner.backToPreviousScreen')}>
          <Text style={styles.backButtonText}>← {t('common.back')}</Text>
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
                <Text style={[styles.stepNumber, {color: theme.background}]}>1</Text>
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
              style={styles.primaryButton}
              accessibilityRole="button"
              accessibilityLabel={t('mrzScanner.scanPassportWithCamera')}>
              <Icon name="camera" variant="filled" size={20} color={theme.onPrimary} style={{marginRight: 8}} />
              <Text style={styles.buttonText}>{t('auth.scanPassport')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => startMRZScan('idcard')}
              activeOpacity={0.8}
              style={styles.secondaryButtonAlt}
              accessibilityRole="button"
              accessibilityLabel={t('mrzScanner.scanIdCardWithCamera')}>
              <Icon name="camera" variant="filled" size={20} color={theme.primary} style={{marginRight: 8}} />
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
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel={t('mrzScanner.enterMrzDetailsManually')}>
            <Icon name="document" variant="outline" size={20} color={theme.primary} style={{marginRight: 8}} />
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

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  navigationErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  navigationErrorTitle: {
    fontSize: 18,
    color: theme.error,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '700',
  },
  navigationErrorText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 10,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.primary,
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
    color: theme.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
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
    backgroundColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeStep: {
    backgroundColor: theme.primary,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textTertiary,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  processLine: {
    flex: 0.3,
    height: 2,
    backgroundColor: theme.border,
    marginHorizontal: 10,
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: theme.primary,
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
    color: theme.onPrimary,
  },
  infoContainer: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  visualGuide: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  visualTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
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
    fontFamily: monoFontFamily,
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
    backgroundColor: theme.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: theme.textTertiary,
    fontWeight: '500',
  },
  // Scan buttons container
  scanButtonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  // Secondary button styles
  secondaryButton: {
    backgroundColor: theme.card,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  secondaryButtonText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonAlt: {
    backgroundColor: theme.card,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 9999,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
  },
  secondaryButtonTextAlt: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MRZScannerScreen;

