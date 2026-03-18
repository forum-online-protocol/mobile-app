import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NFCService } from '../services/NFCService';
import { useTheme } from '../contexts/ThemeContext';
import { monoFontFamily } from '../styles/tokens';
import { useLocalization } from '../hooks/useLocalization';

interface NFCScanModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (passportData: any) => void;
  mrzData?: string;
}

export const NFCScanModal: React.FC<NFCScanModalProps> = ({
  visible,
  onClose,
  onSuccess,
  mrzData
}) => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [scanStatus, setScanStatus] = useState<'ready' | 'scanning' | 'error' | 'success'>('ready');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const nfcService = NFCService.getInstance();

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const startScan = async () => {
    setIsScanning(true);
    setScanStatus('scanning');
    setDebugLog([]);
    setCurrentStep(t('nfcScanModal.initializingNfc'));
    addDebugLog(t('nfcScanModal.startingPassportScan'));
    addDebugLog(t('nfcScanModal.mrzDataLog', { mrzData: mrzData || t('nfcScanModal.usingDemoData') }));

    try {
      // Check NFC availability first
      setCurrentStep(t('nfcScanModal.checkingNfcAvailability'));
      addDebugLog(t('nfcScanModal.checkingNfcAvailability'));
      
      const nfcEnabled = await nfcService.checkNFCEnabled();
      addDebugLog(t('nfcScanModal.nfcEnabledLog', { enabled: String(nfcEnabled) }));
      
      if (!nfcEnabled) {
        throw new Error(t('nfcScanModal.nfcDisabledError'));
      }

      setCurrentStep(t('nfcScanModal.startingPassportScanStep'));
      addDebugLog(t('nfcScanModal.callingStartPassportScan'));
      
      const passportData = await nfcService.startPassportScan(mrzData);
      
      addDebugLog(t('nfcScanModal.passportScanCompleted'));
      setScanStatus('success');
      setCurrentStep(t('nfcScanModal.scanCompleted'));
      
      setTimeout(() => {
        onSuccess(passportData);
      }, 1000);
      
    } catch (error: any) {
      addDebugLog(`${t('common.error')}: ${error.message}`);
      setScanStatus('error');
      setCurrentStep(`${t('common.error')}: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    if (isScanning) {
      nfcService.cleanup();
      setIsScanning(false);
    }
    setScanStatus('ready');
    setDebugLog([]);
    setCurrentStep('');
    onClose();
  };

  const renderScanStatus = () => {
    switch (scanStatus) {
      case 'ready':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.statusIcon}>📱</Text>
            <Text style={styles.statusText}>{t('nfcScanModal.readyToScanPassport')}</Text>
            <Text style={styles.instructionText}>
              {t('nfcScanModal.placePassportInstruction')}
            </Text>
          </View>
        );
      case 'scanning':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.statusText}>{t('nfcScanModal.scanning')}</Text>
            <Text style={styles.currentStep}>{currentStep}</Text>
            <Text style={styles.instructionText}>
              {t('nfcScanModal.keepPassportNearAntenna')}
            </Text>
          </View>
        );
      case 'error':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.statusIcon}>❌</Text>
            <Text style={styles.errorText}>{t('auth.scanFailed')}</Text>
            <Text style={styles.currentStep}>{currentStep}</Text>
          </View>
        );
      case 'success':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.statusIcon}>✅</Text>
            <Text style={styles.successText}>{t('nfcScanModal.scanSuccessful')}</Text>
            <Text style={styles.currentStep}>{currentStep}</Text>
          </View>
        );
    }
  };

  const renderDebugLog = () => (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>{t('nfcScanModal.debugLogTitle')}</Text>
      <ScrollView style={styles.debugScroll} showsVerticalScrollIndicator={false}>
        {debugLog.map((log, index) => (
          <Text key={index} style={styles.debugText}>
            {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );

  const renderButtons = () => (
    <View style={styles.buttonContainer}>
      {scanStatus === 'ready' && (
        <>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={startScan}
            disabled={isScanning}
          >
            <Text style={styles.scanButtonText}>{t('passport.startNfcScan')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => {
              addDebugLog(t('nfcScanModal.testingDebugLog'));
              addDebugLog(t('nfcScanModal.nfcServiceInitialized'));
              addDebugLog(t('nfcScanModal.demoModeActive'));
            }}
          >
            <Text style={styles.debugButtonText}>{t('nfcScanModal.testDebugLog')}</Text>
          </TouchableOpacity>
        </>
      )}
      
      {(scanStatus === 'error' || scanStatus === 'success') && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setScanStatus('ready');
            setDebugLog([]);
            setCurrentStep('');
          }}
        >
          <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleClose}
        disabled={isScanning}
      >
        <Text style={styles.closeButtonText}>{t('common.close')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('nfcScanModal.title')}</Text>
          </View>
          
          {renderScanStatus()}
          {debugLog.length > 0 && renderDebugLog()}
          {renderButtons()}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.modalBackground,
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.error,
    marginBottom: 8,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.success,
    marginBottom: 8,
  },
  currentStep: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 12,
    color: theme.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  debugContainer: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 12,
    marginVertical: 15,
    maxHeight: 200,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  debugScroll: {
    maxHeight: 150,
  },
  debugText: {
    fontSize: 11,
    color: theme.textSecondary,
    fontFamily: monoFontFamily,
    lineHeight: 16,
  },
  buttonContainer: {
    gap: 10,
  },
  scanButton: {
    backgroundColor: theme.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanButtonText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: theme.success,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryButtonText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: theme.border,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
