import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { NFCService } from '../services/NFCService';

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
    setCurrentStep('Initializing NFC...');
    addDebugLog('Starting passport scan');
    addDebugLog(`MRZ Data: ${mrzData || 'Using demo data'}`);

    try {
      // Check NFC availability first
      setCurrentStep('Checking NFC availability...');
      addDebugLog('Checking NFC availability');
      
      const nfcEnabled = await nfcService.checkNFCEnabled();
      addDebugLog(`NFC enabled: ${nfcEnabled}`);
      
      if (!nfcEnabled) {
        throw new Error('NFC is disabled. Please enable NFC in settings.');
      }

      setCurrentStep('Starting passport scan...');
      addDebugLog('Calling NFCService.startPassportScan');
      
      const passportData = await nfcService.startPassportScan(mrzData);
      
      addDebugLog('Passport scan completed successfully');
      setScanStatus('success');
      setCurrentStep('Scan completed!');
      
      setTimeout(() => {
        onSuccess(passportData);
      }, 1000);
      
    } catch (error: any) {
      addDebugLog(`Error: ${error.message}`);
      setScanStatus('error');
      setCurrentStep(`Error: ${error.message}`);
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
            <Text style={styles.statusText}>Ready to scan passport</Text>
            <Text style={styles.instructionText}>
              Place your passport on the back of your phone when scanning starts
            </Text>
          </View>
        );
      case 'scanning':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.statusText}>Scanning...</Text>
            <Text style={styles.currentStep}>{currentStep}</Text>
            <Text style={styles.instructionText}>
              Keep passport close to your phone's NFC antenna
            </Text>
          </View>
        );
      case 'error':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.statusIcon}>❌</Text>
            <Text style={styles.errorText}>Scan Failed</Text>
            <Text style={styles.currentStep}>{currentStep}</Text>
          </View>
        );
      case 'success':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.statusIcon}>✅</Text>
            <Text style={styles.successText}>Scan Successful!</Text>
            <Text style={styles.currentStep}>{currentStep}</Text>
          </View>
        );
    }
  };

  const renderDebugLog = () => (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>Debug Log:</Text>
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
            <Text style={styles.scanButtonText}>Start NFC Scan</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => {
              addDebugLog('Testing debug log functionality');
              addDebugLog('NFC Service initialized');
              addDebugLog('Demo mode active');
            }}
          >
            <Text style={styles.debugButtonText}>Test Debug Log</Text>
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
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleClose}
        disabled={isScanning}
      >
        <Text style={styles.closeButtonText}>Close</Text>
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
            <Text style={styles.title}>NFC Passport Scanner</Text>
          </View>
          
          {renderScanStatus()}
          {debugLog.length > 0 && renderDebugLog()}
          {renderButtons()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
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
    color: '#1F2937',
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
    color: '#1F2937',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
  },
  currentStep: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  debugContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginVertical: 15,
    maxHeight: 200,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  debugScroll: {
    maxHeight: 150,
  },
  debugText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  buttonContainer: {
    gap: 10,
  },
  scanButton: {
    backgroundColor: '#4F46E5',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#6B7280',
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#10B981',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#E5E7EB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
});