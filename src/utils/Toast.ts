import { Platform, Alert } from 'react-native';

// Simple Toast implementation using console and optional alerts
class ToastManager {
  private static shouldShowAlerts = false; // Set to true for debugging

  // Show success toast
  static success(message: string, options = {}) {
    console.log('✅ [Toast Success]:', message);
    if (this.shouldShowAlerts && Platform.OS !== 'web') {
      // Only show alerts for critical success messages
      if (message.includes('vote') || message.includes('balance')) {
        Alert.alert('✅ Success', message);
      }
    }
    return null;
  }

  // Show error toast
  static error(message: string, options = {}) {
    console.error('❌ [Toast Error]:', message);
    if (Platform.OS !== 'web') {
      // Always show error alerts as they're important
      Alert.alert('❌ Error', message);
    }
    return null;
  }

  // Show warning toast
  static warning(message: string, options = {}) {
    console.warn('⚠️ [Toast Warning]:', message);
    if (this.shouldShowAlerts && Platform.OS !== 'web') {
      Alert.alert('⚠️ Warning', message);
    }
    return null;
  }

  // Show info toast
  static info(message: string, options = {}) {
    console.info('ℹ️ [Toast Info]:', message);
    // Info toasts are usually not critical, just log them
    return null;
  }

  // Show custom toast
  static show(message: string, options = {}) {
    console.log('📱 [Toast]:', message);
    return null;
  }

  // Hide all toasts (no-op in simple implementation)
  static hideAll() {
    console.log('[Toast] Hide all toasts (no-op)');
  }
}

export default ToastManager;