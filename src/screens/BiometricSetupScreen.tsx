import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useDispatch } from 'react-redux';
import { setBiometricEnabled } from '../store/authSlice';
import { BiometricService } from '../services/BiometricService';
// import { LinearGradient } from 'expo-linear-gradient';

const BiometricSetupScreen: React.FC = () => {
  const dispatch = useDispatch();
  const biometricService = BiometricService.getInstance();

  const handleSetup = async () => {
    const success = await biometricService.createKeys();
    if (success) {
      dispatch(setBiometricEnabled(true));
      console.log('Navigate to: MainApp');
    }
  };

  const handleSkip = () => {
    navigation.navigate('MainApp' as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={{fontSize: 80, color: '#4F46E5'}}>👆</Text>
        <Text style={styles.title}>Secure Your Wallet</Text>
        <Text style={styles.description}>
          Enable biometric authentication for quick and secure access
        </Text>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleSetup} style={styles.button}>
          <View style={[styles.button, { backgroundColor: '#4F46E5' }]}>
            <Text style={styles.buttonText}>Enable Biometric</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 20 },
  description: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginTop: 10 },
  footer: { padding: 20 },
  button: { padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  skipButton: { padding: 16, alignItems: 'center' },
  skipText: { color: '#6B7280', fontSize: 16 },
});

export default BiometricSetupScreen;