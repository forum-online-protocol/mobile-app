import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface MRZInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { documentNumber: string; dateOfBirth: string; dateOfExpiry: string }) => void;
  initialData?: {
    documentNumber?: string;
    dateOfBirth?: string;
    dateOfExpiry?: string;
  };
}

const MRZInputModal: React.FC<MRZInputModalProps> = ({ visible, onClose, onSubmit, initialData }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [documentNumber, setDocumentNumber] = useState(initialData?.documentNumber || '');
  const [dateOfBirth, setDateOfBirth] = useState(initialData?.dateOfBirth || '');
  const [dateOfExpiry, setDateOfExpiry] = useState(initialData?.dateOfExpiry || '');
  
  // Update state when initialData changes
  React.useEffect(() => {
    if (initialData) {
      setDocumentNumber(initialData.documentNumber || '');
      setDateOfBirth(initialData.dateOfBirth || '');
      setDateOfExpiry(initialData.dateOfExpiry || '');
    }
  }, [initialData]);
  
  const handleSubmit = () => {
    // Basic validation
    if (!documentNumber || documentNumber.length < 5) {
      Alert.alert(t('manual.validationError'), t('manual.documentNumberRequired'));
      return;
    }
    
    if (!dateOfBirth || dateOfBirth.length !== 6) {
      Alert.alert(t('manual.validationError'), t('manual.dateOfBirthFormat'));
      return;
    }
    
    if (!dateOfExpiry || dateOfExpiry.length !== 6) {
      Alert.alert(t('manual.validationError'), t('manual.dateOfExpiryFormat'));
      return;
    }
    
    onSubmit({
      documentNumber: documentNumber.toUpperCase(),
      dateOfBirth,
      dateOfExpiry,
    });
    
    // Clear form
    setDocumentNumber('');
    setDateOfBirth('');
    setDateOfExpiry('');
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('manual.enterDocumentDetails')}</Text>
          <Text style={styles.modalSubtitle}>
            {t('manual.findInformationOnDocument')}
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder={t('manual.documentNumber')}
            placeholderTextColor={theme.placeholder}
            value={documentNumber}
            onChangeText={setDocumentNumber}
            autoCapitalize="characters"
            maxLength={9}
          />
          
          <TextInput
            style={styles.input}
            placeholder={`${t('manual.dateOfBirth')} (YYMMDD)`}
            placeholderTextColor={theme.placeholder}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numeric"
            maxLength={6}
          />
          
          <TextInput
            style={styles.input}
            placeholder={`${t('manual.dateOfExpiry')} (YYMMDD)`}
            placeholderTextColor={theme.placeholder}
            value={dateOfExpiry}
            onChangeText={setDateOfExpiry}
            keyboardType="numeric"
            maxLength={6}
          />
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>{t('auth.scanPassport')}</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.helpText}>
            {t('manual.mrzBottomInfo')}
          </Text>
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.modalBackground,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    color: theme.inputText,
    backgroundColor: theme.inputBackground,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 9999,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  submitButton: {
    backgroundColor: theme.primary,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.onPrimary,
  },
  helpText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 16,
    lineHeight: 16,
    textAlign: 'center',
  },
});

export default MRZInputModal;
