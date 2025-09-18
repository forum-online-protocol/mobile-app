import { Platform, NativeModules } from 'react-native';

/**
 * Detects if the device is running HarmonyOS
 * HarmonyOS devices typically report as Android but have specific characteristics
 */
export const isHarmonyOS = (): boolean => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    // Check for Huawei/Honor specific properties
    const { PlatformConstants } = NativeModules;
    const brand = PlatformConstants?.Brand?.toLowerCase() || '';
    const manufacturer = PlatformConstants?.Manufacturer?.toLowerCase() || '';

    // HarmonyOS devices are typically Huawei or Honor branded
    const isHuaweiBrand = brand.includes('huawei') || brand.includes('honor');
    const isHuaweiManufacturer = manufacturer.includes('huawei') || manufacturer.includes('honor');

    // Check for HarmonyOS specific system properties (if accessible)
    const systemVersion = PlatformConstants?.Version || 0;

    // HarmonyOS 2.0+ runs on Android 10 (API 29) or higher
    // Combined with Huawei brand, this is a strong indicator
    const likelyHarmonyOS = (isHuaweiBrand || isHuaweiManufacturer) && systemVersion >= 29;

    return likelyHarmonyOS;
  } catch (error) {
    console.log('[DeviceDetection] Error detecting HarmonyOS:', error);
    return false;
  }
};

/**
 * Checks if MRZ camera scanning is supported on this device
 */
export const isMRZScannerSupported = (): boolean => {
  // Disable for HarmonyOS due to ML Kit compatibility issues
  if (isHarmonyOS()) {
    return false;
  }

  // Disable for web platform
  if (Platform.OS === 'web') {
    return false;
  }

  // Enable for iOS and standard Android
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

/**
 * Gets a user-friendly message for why MRZ scanning is not available
 */
export const getMRZUnavailableReason = (): string => {
  if (isHarmonyOS()) {
    return 'Coming soon for HarmonyOS';
  }

  if (Platform.OS === 'web') {
    return 'Not available on web';
  }

  return 'Not supported on this device';
};