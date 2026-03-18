import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { setWallet, setPassportData } from '../store/authSlice';
import { fetchFeed } from '../store/socialSlice';
import AuthService from '../services/AuthService';
import { useNavigation } from '../contexts/NavigationContext';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import PassportReader from '../services/PassportReader';
import AsyncStorageService from '../services/AsyncStorageService';
import { useTranslation } from 'react-i18next';
import { PassportData } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { hairlineWidth, monoFontFamily, radii } from '../styles/tokens';

interface MRZData {
  documentNumber: string;
  dateOfBirth: string;
  dateOfExpiry: string;
}

const PassportScanScreen: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { params } = navigation;
  const authService = AuthService.getInstance();

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mrzData, setMrzData] = useState<MRZData | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [passportResult, setPassportResult] = useState<any>(null);
  const [isResolvingMrz, setIsResolvingMrz] = useState(true);

  const { navigate, goBack } = navigation;

  const convertPassportData = (readerData: any): PassportData => {
    const personalData = readerData.personalData || {};
    
    return {
      documentType: personalData.documentType || 'P',
      issuingCountry: personalData.issuingState || '',
      documentNumber: personalData.documentNumber || '',
      nationality: personalData.nationality || '',
      dateOfBirth: personalData.dateOfBirth || '',
      sex: personalData.gender || '',
      gender: personalData.gender || '',
      dateOfExpiry: personalData.dateOfExpiry || '',
      personalNumber: '',
      firstName: personalData.firstName || '',
      lastName: personalData.lastName || '',
      dataGroups: {
        DG1: readerData.dg1Error ? { error: readerData.dg1Error } : {},
        DG2: readerData.dg2Error ? { error: readerData.dg2Error } : {}
      }
    };
  };

  useEffect(() => {
    let active = true;

    const resolveMrzData = async () => {
      console.log('[PassportScanScreen] Component mounted');
      console.log('[PassportScanScreen] Navigation params:', params);

      if (params?.mrzData) {
        console.log('[PassportScan] Received MRZ data from navigation:', params.mrzData);
        if (active) {
          setMrzData(params.mrzData);
          setIsResolvingMrz(false);
        }
        return;
      }

      try {
        const storedMrz = await AsyncStorageService.getItem('mrz_data');
        if (!active) {
          return;
        }

        if (storedMrz) {
          const parsedMrz = JSON.parse(storedMrz);
          if (
            parsedMrz &&
            typeof parsedMrz.documentNumber === 'string' &&
            typeof parsedMrz.dateOfBirth === 'string' &&
            typeof parsedMrz.dateOfExpiry === 'string'
          ) {
            console.log('[PassportScan] Recovered MRZ data from storage fallback');
            setMrzData(parsedMrz);
            setIsResolvingMrz(false);
            return;
          }
        }
      } catch (storageError) {
        console.warn('[PassportScan] Failed to restore MRZ data from storage:', storageError);
      }

      if (!active) {
        return;
      }

      setIsResolvingMrz(false);
      Alert.alert(t('passport.error'), t('passport.noMrzDataReceived'), [
        { text: t('common.ok'), onPress: () => goBack() }
      ]);
    };

    void resolveMrzData();

    return () => {
      active = false;
    };
  }, [goBack, params, t]);


  const startPassportScan = async () => {
    if (!mrzData) {
      Alert.alert(t('passport.error'), t('passport.noMrzDataAvailable'));
      return;
    }

    setIsScanning(true);
    setError(null);
    setProgress(0);
    setScanStatus(t('passport.initializingNfc'));

    try {
      console.log('[PassportScan] Starting passport scan with MRZ data:', mrzData);
      console.log('[PassportScan] PassportReader service:', PassportReader);
      
      setScanStatus(t('passport.searchingForNfcPassport'));
      setProgress(20);
      
      // Add a small delay to show the status
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setScanStatus(t('passport.connectingToPassportChip'));
      setProgress(40);
      
      console.log('[PassportScan] Calling PassportReader.readPassport...');
      const passportData = await PassportReader.readPassport(
        mrzData.documentNumber,
        mrzData.dateOfBirth,
        mrzData.dateOfExpiry
      );

      setScanStatus(t('passport.readingPassportData'));
      setProgress(60);
      
      console.log('[PassportScan] Passport scan completed:', passportData);

      setScanStatus(t('passport.verifyingPassportAuthenticity'));
      setProgress(80);

      const convertedPassportData = convertPassportData(passportData);
      console.log('[PassportScan] Converted passport data:', convertedPassportData);

      // Generate wallet and enter app immediately. On-chain registration syncs in background
      setScanStatus(t('passport.registeringOnChainIdentity'));
      setProgress(90);
      const fallbackNickname = [
        convertedPassportData.firstName || 'user',
        convertedPassportData.lastName || '',
      ]
        .join('_')
        .trim();
      const authResult = await authService.authenticateWithPassport(
        convertedPassportData,
        fallbackNickname
      );
      if (!authResult.success || !authResult.wallet) {
        throw new Error(authResult.error || 'On-chain registration failed');
      }
      dispatch(setWallet(authResult.wallet as any));
      console.log('[PassportScan] Wallet created and registered:', (authResult.wallet as any).address);

      // Store complete passport data in Redux and AsyncStorage
      dispatch(setPassportData(convertedPassportData));

      // Refetch feed after authentication
      await dispatch(fetchFeed({} as any) as any);
      console.log('[PassportScan] Feed refetched after authentication');

      // Store complete passport data in AsyncStorage for persistence
      try {
        await AsyncStorageService.setItem('passport_data', JSON.stringify(passportData));
        await AsyncStorageService.removeItem('mrz_data');
        console.log('[PassportScan] Complete passport data stored in AsyncStorage');
      } catch (storageError) {
        console.error('[PassportScan] Failed to store passport data:', storageError);
      }
      
      setScanStatus(t('passport.complete'));
      setProgress(100);
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setIsScanning(false);
      
      setPassportResult(passportData);
      setShowSuccessDialog(true);
      
    } catch (error: any) {
      console.error('[PassportScan] Error:', error);
      
      let errorMessage = error.message || t('passport.couldNotReadPassportNfc');
      
      if (errorMessage.includes('NFC is not available')) {
        if (errorMessage.includes('Simulator')) {
          errorMessage = t('passport.nfcUnavailableSimulator');
        } else if (errorMessage.includes('iOS 13')) {
          errorMessage = t('passport.nfcUnavailableIosVersion');
        } else if (errorMessage.includes('disabled')) {
          errorMessage = t('passport.nfcUnavailableDisabled');
        } else {
          errorMessage = t('passport.nfcUnavailableDevice');
        }
      }
      
      if (errorMessage.includes('Simulator')) {
        console.log('[PassportScan] NFC Test Info:');
        console.log('[PassportScan] - MRZ scanning works in simulator');
        console.log('[PassportScan] - NFC reading requires real device');
        console.log('[PassportScan] - Use iPhone 7+ or iPad Pro for NFC testing');
      }
      
      setError(errorMessage);
      setIsScanning(false);
      setScanStatus('');
      setProgress(0);
      
      Alert.alert(
        t('auth.scanFailed'),
        errorMessage || t('passport.couldNotReadPassportNfc'),
        [{ text: t('common.ok') }]
      );
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
              console.log('[PassportScanScreen] Back button pressed');
              
              if (goBack && typeof goBack === 'function') {
                goBack();
              } else {
                console.error('[PassportScanScreen] GoBack function not available');
                Alert.alert(t('passport.error'), t('passport.cannotGoBack'));
              }
            } catch (error) {
              console.error('[PassportScanScreen] Error during goBack:', error);
            }
          }}
          style={styles.backButton}>
          <Text style={styles.backButtonText}>← {t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}>
        
        {/* Main Content */}
        <View style={styles.mainContent}>
          <Text style={styles.title}>{t('passport.readYourPassport')}</Text>
          <Text style={styles.subtitle}>{t('passport.stepTwoOfTwo')}</Text>
          
          {/* Process Steps */}
          <View style={styles.processContainer}>
            <View style={styles.processStep}>
              <View style={[styles.stepIndicator, styles.completedStep]}>
                <Text style={[styles.stepNumber, {color: theme.onPrimary}]}>✓</Text>
              </View>
              <Text style={styles.stepTitle}>{t('passport.scanMrz')}</Text>
              <Text style={styles.stepDescription}>{t('passport.cameraScanCompleted')}</Text>
            </View>
            
            <View style={styles.processLine} />
            
            <View style={styles.processStep}>
              <View style={[styles.stepIndicator, styles.activeStep]}>
                <Text style={[styles.stepNumber, {color: theme.onPrimary}]}>2</Text>
              </View>
              <Text style={styles.stepTitle}>{t('passport.nfcRead')}</Text>
              <Text style={styles.stepDescription}>{t('passport.verifyWithChip')}</Text>
            </View>
          </View>

          {/* MRZ Data Display */}
          {mrzData && (
            <View style={styles.mrzDataContainer}>
              <Text style={styles.mrzTitle}>{t('passport.mrzDataReady')}</Text>
              <Text style={styles.mrzText}>{t('passport.document')}: {mrzData.documentNumber}</Text>
              <Text style={styles.mrzText}>{t('passport.birthDate')}: {mrzData.dateOfBirth}</Text>
              <Text style={styles.mrzText}>{t('passport.expiryDate')}: {mrzData.dateOfExpiry}</Text>
            </View>
          )}

          {/* Scan Button */}
          <TouchableOpacity
            onPress={startPassportScan}
            disabled={isScanning || isResolvingMrz || !mrzData}
            activeOpacity={0.8}
            style={[
              styles.primaryButton,
              (isScanning || isResolvingMrz || !mrzData) && styles.buttonDisabled,
            ]}>
            {isScanning ? (
              <>
                <ActivityIndicator size="small" color={theme.onPrimary} style={{marginRight: 8}} />
                <Text style={styles.buttonText}>{t('passport.readingPassport')}</Text>
              </>
            ) : isResolvingMrz ? (
              <>
                <ActivityIndicator size="small" color={theme.onPrimary} style={{marginRight: 8}} />
                <Text style={styles.buttonText}>{t('common.loading')}</Text>
              </>
            ) : (
              <>
                <Icon name="send" variant="filled" size={20} color={theme.onPrimary} style={{marginRight: 8}} />
                <Text style={styles.buttonText}>{t('passport.startNfcScan')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Scanning Status */}
          {isScanning && (
            <View style={styles.scanningContainer}>
              <Text style={styles.scanningStatus}>{scanStatus}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
              
              <View style={styles.nfcInstructions}>
                <Text style={styles.nfcInstructionTitle}>{t('passport.keepYourPhone')}</Text>
                <Text style={styles.nfcInstructionText}>• {t('passport.flatOnTopOfPassport')}</Text>
                <Text style={styles.nfcInstructionText}>• {t('passport.steadyAndStill')}</Text>
                <Text style={styles.nfcInstructionText}>• {t('passport.closeToPassportChip')}</Text>
              </View>
              
              {/* Cancel Button */}
              <TouchableOpacity
                onPress={() => {
                  setIsScanning(false);
                  setError(t('passport.scanCancelledByUser'));
                  setScanStatus('');
                  setProgress(0);
                }}
                style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Icon name="warning" variant="filled" size={24} color={theme.warning} style={{marginBottom: 8}} />
              <Text style={styles.errorTitle}>
                {error.includes('0x6985') || error.includes('CONDITIONS NOT SATISFIED')
                  ? t('passport.authenticationFailed')
                  : t('passport.error')}
              </Text>
              <Text style={styles.errorText}>
                {error.includes('0x6985') || error.includes('CONDITIONS NOT SATISFIED')
                  ? t('passport.authenticationFailedMessage')
                  : error.includes('Mutual authentication failed')
                  ? t('passport.mutualAuthFailedMessage')
                  : error.includes('Tag was lost')
                  ? t('passport.tagLostMessage')
                  : error.includes('Transceive failed')
                  ? t('passport.transceiveFailedMessage')
                  : error}
              </Text>
              {(error.includes('0x6985') || error.includes('authentication')) && (
                <View style={styles.errorSuggestions}>
                  <Text style={styles.suggestionTitle}>{t('passport.tryThese')}</Text>
                  <Text style={styles.suggestionText}>• {t('passport.checkMrzData')}</Text>
                  <Text style={styles.suggestionText}>• {t('passport.ensureValidPassport')}</Text>
                  <Text style={styles.suggestionText}>• {t('passport.cleanChip')}</Text>
                  <Text style={styles.suggestionText}>• {t('passport.tryDifferentPosition')}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setError(null);
                  startPassportScan();
                }}>
                <Text style={styles.retryButtonText}>{t('passport.tryAgain')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Info Container */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>{t('passport.nfcInstructions')}</Text>
            <Text style={styles.infoText}>
              • {t('passport.placePhoneOnPassport')}{'\n'}
              • {t('passport.keepPassportFlat')}{'\n'}
              • {t('passport.waitForDetection')}{'\n'}
              • {t('passport.doNotMove')}
            </Text>
          </View>

          {/* NFC Info for Simulator */}
          {Platform.OS === 'ios' && (
            <View style={[styles.infoContainer, { backgroundColor: theme.surface, borderColor: theme.warning }]}>
              <Text style={[styles.infoTitle, { color: theme.textSecondary }]}>{t('passport.simulatorTestingTitle')}</Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                • {t('passport.simulatorTestingLine1')}{'\n'}
                • {t('passport.simulatorTestingLine2')}{'\n'}
                • {t('passport.simulatorTestingLine3')}{'\n'}
                • {t('passport.simulatorTestingLine4')}
              </Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Success Dialog */}
      <Modal
        visible={showSuccessDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessDialog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.successDialog}>
            <Text style={styles.successTitle}>{t('passport.success')}</Text>
            <Text style={styles.successMessage}>{t('passport.passportVerifiedSuccessfully')}</Text>
            
            {passportResult && (
              <View style={styles.passportInfo}>
                <Text style={styles.passportInfoTitle}>{t('passport.verifiedIdentity')}</Text>
                <Text style={styles.passportInfoText}>
                  {t('passport.name')}: {passportResult.personalData?.firstName || t('profile.notAvailable')} {passportResult.personalData?.lastName || t('profile.notAvailable')}
                </Text>
                <Text style={styles.passportInfoText}>
                  {t('passport.nationality')}: {passportResult.personalData?.nationality || t('profile.notAvailable')}
                </Text>
              </View>
            )}
            
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogButton, styles.rescanButton]}
                onPress={() => {
                  setShowSuccessDialog(false);
                  setPassportResult(null);
                  // Reset to allow rescanning
                }}>
                <Icon name="refresh" variant="filled" size={20} color={theme.primary} style={{marginRight: 8}} />
                <Text style={styles.rescanButtonText}>{t('passport.rescan')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.dialogButton, styles.continueButton]}
                onPress={() => {
                  setShowSuccessDialog(false);
                  navigate('Feed');
                }}>
                <Icon name="checkmark" variant="filled" size={20} color={theme.onPrimary} style={{marginRight: 8}} />
                <Text style={styles.continueButtonText}>{t('passport.continue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
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
    backgroundColor: theme.headerBackground,
    borderBottomWidth: hairlineWidth,
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
  completedStep: {
    backgroundColor: theme.success,
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
    backgroundColor: theme.success,
    marginHorizontal: 10,
    marginBottom: 40,
  },
  mrzDataContainer: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.border,
  },
  mrzTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  mrzText: {
    fontSize: 14,
    color: theme.primaryDark,
    marginBottom: 4,
    fontFamily: monoFontFamily,
  },
  primaryButton: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: radii.pill,
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
  cancelButton: {
    backgroundColor: theme.error,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.onPrimary,
  },
  errorContainer: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.error,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.error,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: theme.error,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorSuggestions: {
    backgroundColor: theme.card,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    width: '100%',
  },
  suggestionTitle: {
    color: theme.error,
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 14,
  },
  suggestionText: {
    color: theme.error,
    fontSize: 13,
    marginVertical: 2,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: theme.error,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  retryButtonText: {
    color: theme.onPrimary,
    fontWeight: '600',
    fontSize: 14,
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
  scanningContainer: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  scanningStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primaryDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: theme.primaryDark,
    fontWeight: '600',
    marginBottom: 16,
  },
  nfcInstructions: {
    alignItems: 'flex-start',
    width: '100%',
  },
  nfcInstructionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  nfcInstructionText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successDialog: {
    backgroundColor: theme.modalBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  passportInfo: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.border,
  },
  passportInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primaryDark,
    marginBottom: 8,
  },
  passportInfoText: {
    fontSize: 14,
    color: theme.primaryDark,
    marginBottom: 4,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  rescanButton: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  rescanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  continueButton: {
    backgroundColor: theme.primary,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.onPrimary,
  },
});

export default PassportScanScreen;


