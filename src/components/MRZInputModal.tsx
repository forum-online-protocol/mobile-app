import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';

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
      Alert.alert('Invalid Input', 'Please enter a valid document number');
      return;
    }
    
    if (!dateOfBirth || dateOfBirth.length !== 6) {
      Alert.alert('Invalid Input', 'Date of birth must be in YYMMDD format (6 digits)');
      return;
    }
    
    if (!dateOfExpiry || dateOfExpiry.length !== 6) {
      Alert.alert('Invalid Input', 'Date of expiry must be in YYMMDD format (6 digits)');
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
          <Text style={styles.modalTitle}>Enter Passport Details</Text>
          <Text style={styles.modalSubtitle}>
            Enter the details from your passport's MRZ (Machine Readable Zone)
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Document Number"
            placeholderTextColor="#536471"
            value={documentNumber}
            onChangeText={setDocumentNumber}
            autoCapitalize="characters"
            maxLength={9}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Date of Birth (YYMMDD)"
            placeholderTextColor="#536471"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numeric"
            maxLength={6}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Date of Expiry (YYMMDD)"
            placeholderTextColor="#536471"
            value={dateOfExpiry}
            onChangeText={setDateOfExpiry}
            keyboardType="numeric"
            maxLength={6}
          />
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Scan Passport</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.helpText}>
            The document number and dates can be found in the two lines of text
            at the bottom of your passport's photo page.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F1419',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#536471',
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CFD9DE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    color: '#0F1419',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CFD9DE',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F1419',
  },
  submitButton: {
    backgroundColor: '#000000',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  helpText: {
    fontSize: 12,
    color: '#536471',
    marginTop: 16,
    lineHeight: 16,
    textAlign: 'center',
  },
});

export default MRZInputModal;