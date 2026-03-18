import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NFCService } from '../services/NFCService';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../hooks/useLocalization';

interface NFCStatusCheckProps {
  onNFCEnabled: () => void;
  onSkip?: () => void;
}

const NFCStatusCheck: React.FC<NFCStatusCheckProps> = ({ onNFCEnabled, onSkip }) => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isChecking, setIsChecking] = useState(true);
  const [isNFCEnabled, setIsNFCEnabled] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    checkNFCStatus();
    
    // Set up interval to check NFC status periodically
    const interval = setInterval(() => {
      if (!isNFCEnabled) {
        checkNFCStatus();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [isNFCEnabled]);

  const checkNFCStatus = async () => {
    if (Platform.OS === 'web') {
      setIsChecking(false);
      setHasChecked(true);
      return;
    }
    
    try {
      const nfcService = NFCService.getInstance();
      const enabled = await nfcService.checkNFCEnabled();
      setIsNFCEnabled(enabled);
      setHasChecked(true);
      
      if (enabled) {
        onNFCEnabled();
      }
    } catch (error) {
      console.error('Error checking NFC status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleEnableNFC = async () => {
    const nfcService = NFCService.getInstance();
    await nfcService.promptNFCSettings();
    
    // Check again after a delay (user might have enabled it)
    setTimeout(() => {
      checkNFCStatus();
    }, 1000);
  };

  if (Platform.OS === 'web') {
    return null;
  }

  if (isChecking && !hasChecked) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.checkingText}>{t('nfcStatus.checking')}</Text>
      </View>
    );
  }

  if (!isNFCEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningTitle}>{t('nfcStatus.disabledTitle')}</Text>
          <Text style={styles.warningText}>
            {t('nfcStatus.disabledDescription')}
          </Text>
          
          <TouchableOpacity
            style={styles.enableButton}
            onPress={handleEnableNFC}>
            <Text style={styles.enableButtonText}>
              {Platform.OS === 'android' ? t('nfcStatus.openNfcSettings') : t('nfcStatus.openSettings')}
            </Text>
          </TouchableOpacity>
          
          {onSkip && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onSkip}>
              <Text style={styles.skipButtonText}>{t('nfcStatus.skipForNow')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return null;
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  checkingText: {
    marginTop: 10,
    fontSize: 14,
    color: theme.textSecondary,
  },
  warningBox: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.warning,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  warningIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  enableButton: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 9999,
    marginBottom: 10,
  },
  enableButtonText: {
    color: theme.onPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipButtonText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
});

export default NFCStatusCheck;
