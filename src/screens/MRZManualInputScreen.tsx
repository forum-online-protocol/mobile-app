import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '../contexts/NavigationContext';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import Icon from '../components/Icon';

interface MRZData {
  documentNumber: string;
  dateOfBirth: string;
  dateOfExpiry: string;
}

const MRZManualInputScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [documentNumber, setDocumentNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfExpiry, setDateOfExpiry] = useState('');
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateInput = () => {
    const newErrors: {[key: string]: string} = {};
    
    // Document number validation
    if (!documentNumber.trim()) {
      newErrors.documentNumber = t('manual.documentNumberRequired');
    } else if (documentNumber.length < 5) {
      newErrors.documentNumber = 'Document number must be at least 5 characters';
    }
    
    // Date of birth validation
    if (!dateOfBirth.trim()) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else if (!dateOfBirth.match(/^\d{6}$/)) {
      newErrors.dateOfBirth = t('manual.dateOfBirthFormat');
    }
    
    // Date of expiry validation
    if (!dateOfExpiry.trim()) {
      newErrors.dateOfExpiry = 'Date of expiry is required';
    } else if (!dateOfExpiry.match(/^\d{6}$/)) {
      newErrors.dateOfExpiry = t('manual.dateOfExpiryFormat');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateInput()) {
      return;
    }

    const mrzData: MRZData = {
      documentNumber: documentNumber.toUpperCase(),
      dateOfBirth,
      dateOfExpiry,
    };

    console.log('[MRZManualInputScreen] Submitting MRZ data:', mrzData);
    
    // Navigate to PassportScanScreen with MRZ data
    navigation.navigate('PassportScanScreen', { 
      mrzData, 
      source: 'manual_input' 
    });
  };

  const formatDateInput = (text: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    // Limit to 6 digits
    const limited = cleaned.substring(0, 6);
    setter(limited);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <Logo size="small" color="primary" />
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Icon name="arrow-back" variant="outline" size={24} color="#1D9BF0" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}>
        
        {/* Visual Guide */}
        <View style={styles.visualGuide}>
          <Text style={styles.visualTitle}>{t('manual.findInformationOnDocument')}</Text>
          <View style={styles.mrzExample}>
            <Text style={styles.mrzLine}>P&lt;USADOE&lt;&lt;JOHN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</Text>
            <View style={styles.mrzHighlights}>
              <View style={[styles.highlight, styles.highlightDoc]}>
                <Text style={styles.highlightLabel}>Doc Number</Text>
              </View>
              <View style={[styles.highlight, styles.highlightDob]}>
                <Text style={styles.highlightLabel}>Birth Date</Text>
              </View>
              <View style={[styles.highlight, styles.highlightExp]}>
                <Text style={styles.highlightLabel}>Expiry Date</Text>
              </View>
            </View>
            <Text style={styles.mrzLine}>L898902C36USA7408122M1204159ZE184226B&lt;&lt;&lt;&lt;&lt;10</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{t('manual.enterDocumentDetails')}</Text>
        <Text style={styles.subtitle}>
          Enter the information exactly as it appears in your passport's MRZ
        </Text>

        {/* Input Fields */}
        <View style={styles.inputContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('manual.documentNumber')}</Text>
            <TextInput
              style={[styles.textInput, errors.documentNumber && styles.inputError]}
              value={documentNumber}
              onChangeText={(text) => {
                setDocumentNumber(text.toUpperCase());
                if (errors.documentNumber) {
                  setErrors({...errors, documentNumber: ''});
                }
              }}
              placeholder="L898902C3"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              maxLength={9}
            />
            {errors.documentNumber ? (
              <Text style={styles.errorText}>{errors.documentNumber}</Text>
            ) : (
              <Text style={styles.inputHint}>{t('manual.usuallyNineChars')}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('manual.dateOfBirth')}</Text>
            <TextInput
              style={[styles.textInput, errors.dateOfBirth && styles.inputError]}
              value={dateOfBirth}
              onChangeText={(text) => {
                formatDateInput(text, setDateOfBirth);
                if (errors.dateOfBirth) {
                  setErrors({...errors, dateOfBirth: ''});
                }
              }}
              placeholder="740812"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={6}
            />
            {errors.dateOfBirth ? (
              <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
            ) : (
              <Text style={styles.inputHint}>{t('manual.formatYYMMDD')}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('manual.dateOfExpiry')}</Text>
            <TextInput
              style={[styles.textInput, errors.dateOfExpiry && styles.inputError]}
              value={dateOfExpiry}
              onChangeText={(text) => {
                formatDateInput(text, setDateOfExpiry);
                if (errors.dateOfExpiry) {
                  setErrors({...errors, dateOfExpiry: ''});
                }
              }}
              placeholder="120415"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={6}
            />
            {errors.dateOfExpiry ? (
              <Text style={styles.errorText}>{errors.dateOfExpiry}</Text>
            ) : (
              <Text style={styles.inputHint}>{t('manual.formatYYMMDD')}</Text>
            )}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>{t('instructions.instructionsTitle')}</Text>
          <Text style={styles.infoText}>
            • {t('instructions.forPassports')}{'\n'}
            • {t('instructions.forIdCards')}{'\n'}
            • The information is in the MRZ at the bottom of the page
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleSubmit}
            style={styles.primaryButton}
            activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>{t('common.continue')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.secondaryButton}
            activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  visualGuide: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
    position: 'relative',
  },
  mrzLine: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#00FF00',
    letterSpacing: 1,
    textAlign: 'center',
  },
  mrzHighlights: {
    position: 'absolute',
    top: 30,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  highlight: {
    backgroundColor: 'rgba(29, 155, 240, 0.3)',
    borderRadius: 4,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1D9BF0',
  },
  highlightDoc: {
    position: 'absolute',
    left: 0,
    width: 80,
  },
  highlightDob: {
    position: 'absolute',
    left: 120,
    width: 60,
  },
  highlightExp: {
    position: 'absolute',
    left: 200,
    width: 60,
  },
  highlightLabel: {
    fontSize: 8,
    color: '#1D9BF0',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F1419',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#536471',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F1419',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F7F9FA',
    borderWidth: 2,
    borderColor: '#EFF3F4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F1419',
    fontWeight: '500',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  inputHint: {
    fontSize: 12,
    color: '#536471',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 6,
    fontWeight: '500',
  },
  infoContainer: {
    backgroundColor: '#F7F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EFF3F4',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1419',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#536471',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 9999,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 9999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CFD9DE',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#536471',
  },
});

export default MRZManualInputScreen;