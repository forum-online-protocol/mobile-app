import React, { useState, useEffect } from 'react';
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
import { setWallet, setPassportData, setAuthenticated } from '../store/authSlice';
import { fetchFeed } from '../store/socialSlice';
import { WalletService } from '../services/WalletService';
import { useNavigation } from '../contexts/NavigationContext';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import PassportReader from '../services/PassportReader';
import { useTranslation } from 'react-i18next';

interface MRZData {
  documentNumber: string;
  dateOfBirth: string;
  dateOfExpiry: string;
}

const PassportScanScreen: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { params } = navigation;
  const walletService = WalletService.getInstance();

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mrzData, setMrzData] = useState<MRZData | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [passportResult, setPassportResult] = useState<any>(null);

  const { navigate, goBack } = navigation;

  useEffect(() => {
    console.log('[PassportScanScreen] Component mounted');
    
    // Check if MRZ data was passed from scanner
    if (params?.mrzData) {
      console.log('[PassportScan] Received MRZ data:', params.mrzData);
      setMrzData(params.mrzData);
    } else {
      console.warn('[PassportScan] No MRZ data received');
      Alert.alert(t('passport.error'), t('passport.noMrzDataReceived'), [
        { text: t('common.ok'), onPress: () => goBack() }
      ]);
    }
  }, [params]);


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
      
      // Show scanning progress with status updates
      setScanStatus(t('passport.searchingForNfcPassport'));
      setProgress(20);
      
      // Add a small delay to show the status
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setScanStatus(t('passport.connectingToPassportChip'));
      setProgress(40);
      
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

      // Generate wallet from passport data
      try {
        setScanStatus(t('passport.generatingSecureWallet'));
        setProgress(90);
        
        const walletData = await walletService.generateWalletFromPassport(passportData);
        dispatch(setWallet(walletData));
        console.log('[PassportScan] Wallet created:', walletData.address);
      } catch (walletError) {
        console.error('[PassportScan] Wallet generation error:', walletError);
      }

      // Store complete passport data in Redux and AsyncStorage
      dispatch(setPassportData(passportData));
      dispatch(setAuthenticated(true));

      // Refetch feed after authentication
      await dispatch(fetchFeed({} as any) as any);
      console.log('[PassportScan] Feed refetched after authentication');

      // Store complete passport data in AsyncStorage for persistence
      try {
        const AsyncStorageService = require('../services/AsyncStorageService').default;
        await AsyncStorageService.setItem('passport_data', JSON.stringify(passportData));
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
      setError(error.message || 'Failed to read passport');
      setIsScanning(false);
      setScanStatus('');
      setProgress(0);
      
      Alert.alert(
        t('auth.scanFailed'),
        t('passport.couldNotReadPassportNfc'),
        [{ text: t('common.ok') }]
      );
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
                <Text style={[styles.stepNumber, {color: '#FFFFFF'}]}>✓</Text>
              </View>
              <Text style={styles.stepTitle}>{t('passport.scanMrz')}</Text>
              <Text style={styles.stepDescription}>{t('passport.cameraScanCompleted')}</Text>
            </View>
            
            <View style={styles.processLine} />
            
            <View style={styles.processStep}>
              <View style={[styles.stepIndicator, styles.activeStep]}>
                <Text style={[styles.stepNumber, {color: '#FFFFFF'}]}>2</Text>
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
            disabled={isScanning}
            activeOpacity={0.8}
            style={[styles.primaryButton, isScanning && styles.buttonDisabled]}>
            {isScanning ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" style={{marginRight: 8}} />
                <Text style={styles.buttonText}>{t('passport.readingPassport')}</Text>
              </>
            ) : (
              <>
                <Icon name="send" variant="filled" size={20} color="#FFFFFF" style={{marginRight: 8}} />
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
            </View>
          )}

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Icon name="warning" variant="filled" size={24} color="#FFA500" style={{marginBottom: 8}} />
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
                  {t('passport.name')}: {passportResult.personalData?.firstName || 'N/A'} {passportResult.personalData?.lastName || 'N/A'}
                </Text>
                <Text style={styles.passportInfoText}>
                  {t('passport.nationality')}: {passportResult.personalData?.nationality || 'N/A'}
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
                <Icon name="refresh" variant="filled" size={20} color="#1D9BF0" style={{marginRight: 8}} />
                <Text style={styles.rescanButtonText}>{t('passport.rescan')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.dialogButton, styles.continueButton]}
                onPress={() => {
                  setShowSuccessDialog(false);
                  navigate('Feed');
                }}>
                <Icon name="checkmark" variant="filled" size={20} color="#FFFFFF" style={{marginRight: 8}} />
                <Text style={styles.continueButtonText}>{t('passport.continue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  completedStep: {
    backgroundColor: '#10B981',
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
    backgroundColor: '#10B981',
    marginHorizontal: 10,
    marginBottom: 40,
  },
  mrzDataContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  mrzTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F1419',
    marginBottom: 12,
  },
  mrzText: {
    fontSize: 14,
    color: '#0369A1',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
    textAlign: 'center',
  },
  errorSuggestions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    width: '100%',
  },
  suggestionTitle: {
    color: '#991B1B',
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 14,
  },
  suggestionText: {
    color: '#7F1D1D',
    fontSize: 13,
    marginVertical: 2,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
  scanningContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
  },
  scanningStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0F2FE',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0EA5E9',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#0369A1',
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
    color: '#0F1419',
    marginBottom: 8,
  },
  nfcInstructionText: {
    fontSize: 13,
    color: '#536471',
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F1419',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#536471',
    textAlign: 'center',
    marginBottom: 20,
  },
  passportInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  passportInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 8,
  },
  passportInfoText: {
    fontSize: 14,
    color: '#0369A1',
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
    borderRadius: 9999,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  rescanButton: {
    backgroundColor: '#F7F9FA',
    borderWidth: 1,
    borderColor: '#1D9BF0',
  },
  rescanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D9BF0',
  },
  continueButton: {
    backgroundColor: '#000000',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PassportScanScreen;