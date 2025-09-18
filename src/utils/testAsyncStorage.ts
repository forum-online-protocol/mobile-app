import { Platform } from 'react-native';

export const testAsyncStorage = async () => {
  try {
    console.log('Testing AsyncStorage...');
    
    // Try to import AsyncStorage dynamically
    let AsyncStorage: any;
    try {
      AsyncStorage = require('@react-native-async-storage/async-storage').default;
    } catch (e) {
      console.warn('AsyncStorage module not available:', e);
      return false;
    }
    
    console.log('AsyncStorage object:', AsyncStorage);
    
    if (!AsyncStorage) {
      console.error('AsyncStorage is null or undefined!');
      return false;
    }
    
    if (!AsyncStorage.getItem) {
      console.error('AsyncStorage.getItem is undefined!');
      return false;
    }
    
    // Test basic operations
    await AsyncStorage.setItem('test_key', 'test_value');
    const value = await AsyncStorage.getItem('test_key');
    console.log('AsyncStorage test successful, value:', value);
    await AsyncStorage.removeItem('test_key');
    
    return true;
  } catch (error) {
    console.error('AsyncStorage test failed:', error);
    return false;
  }
};