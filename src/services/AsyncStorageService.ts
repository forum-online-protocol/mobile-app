import { Platform } from 'react-native';

// In-memory fallback storage for when AsyncStorage fails
const memoryStorage: Record<string, string> = {};

// Dynamic AsyncStorage import
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.warn('AsyncStorage module not available, using memory fallback');
}

class AsyncStorageService {
  private static isAvailable: boolean | null = null;

  static async checkAvailability(): Promise<boolean> {
    if (this.isAvailable !== null) {
      return this.isAvailable;
    }

    try {
      // Test if AsyncStorage is available
      if (!AsyncStorage || !AsyncStorage.getItem) {
        throw new Error('AsyncStorage not available');
      }
      
      await AsyncStorage.getItem('test');
      this.isAvailable = true;
      console.log('AsyncStorage is available');
      return true;
    } catch (error) {
      console.warn('AsyncStorage not available, using in-memory fallback:', error);
      this.isAvailable = false;
      return false;
    }
  }

  static async getItem(key: string): Promise<string | null> {
    try {
      if (AsyncStorage && await this.checkAvailability()) {
        return await AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.warn('AsyncStorage.getItem failed, using fallback:', error);
    }
    
    // Fallback to memory storage
    return memoryStorage[key] || null;
  }

  static async setItem(key: string, value: string): Promise<void> {
    try {
      if (AsyncStorage && await this.checkAvailability()) {
        await AsyncStorage.setItem(key, value);
        return;
      }
    } catch (error) {
      console.warn('AsyncStorage.setItem failed, using fallback:', error);
    }
    
    // Fallback to memory storage
    memoryStorage[key] = value;
  }

  static async removeItem(key: string): Promise<void> {
    try {
      if (AsyncStorage && await this.checkAvailability()) {
        await AsyncStorage.removeItem(key);
        return;
      }
    } catch (error) {
      console.warn('AsyncStorage.removeItem failed, using fallback:', error);
    }
    
    // Fallback to memory storage
    delete memoryStorage[key];
  }

  static async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      if (AsyncStorage && await this.checkAvailability()) {
        return await AsyncStorage.multiGet(keys);
      }
    } catch (error) {
      console.warn('AsyncStorage.multiGet failed, using fallback:', error);
    }
    
    // Fallback to memory storage
    return keys.map(key => [key, memoryStorage[key] || null]);
  }

  static async getAllKeys(): Promise<string[]> {
    try {
      if (AsyncStorage && await this.checkAvailability()) {
        return await AsyncStorage.getAllKeys();
      }
    } catch (error) {
      console.warn('AsyncStorage.getAllKeys failed, using fallback:', error);
    }
    
    // Fallback to memory storage
    return Object.keys(memoryStorage);
  }

  static async clear(): Promise<void> {
    try {
      if (AsyncStorage && await this.checkAvailability()) {
        await AsyncStorage.clear();
        return;
      }
    } catch (error) {
      console.warn('AsyncStorage.clear failed, using fallback:', error);
    }
    
    // Fallback to memory storage
    Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
  }
}

export default AsyncStorageService;