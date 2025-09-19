import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translations
import en from './translations/en.json';
import ru from './translations/ru.json';
import ua from './translations/ua.json';
import ro from './translations/ro.json';

const STORAGE_KEY = 'user_language';

// Supported languages
export const supportedLanguages = {
  en: 'English',
  ru: 'Русский',
  ua: 'Українська',
  ro: 'Română'
};

// Get device language using React Native's built-in locale detection
const getDeviceLanguage = () => {
  try {
    let deviceLanguage = 'en'; // Default fallback
    
    if (Platform.OS === 'android') {
      // For Android, get language from native modules
      const locale = NativeModules.I18nManager?.localeIdentifier || 
                    NativeModules.SettingsManager?.settings?.AppleLocale || 
                    'en';
      deviceLanguage = locale.split('_')[0].toLowerCase();
    } else if (Platform.OS === 'ios') {
      // For iOS, get language from native modules
      const locale = NativeModules.SettingsManager?.settings?.AppleLocale || 
                    NativeModules.I18nManager?.localeIdentifier || 
                    'en';
      deviceLanguage = locale.split('_')[0].toLowerCase();
    }
    
    // Check if device language is supported
    if (deviceLanguage && Object.keys(supportedLanguages).includes(deviceLanguage)) {
      return deviceLanguage;
    }
    
    // Check for language variants (e.g., 'uk' -> 'ua')
    if (deviceLanguage === 'uk') return 'ua';
    
    // Default to English if not supported
    return 'en';
  } catch (error) {
    console.log('Error detecting device language, defaulting to English:', error);
    return 'en';
  }
};

// Initialize i18n with a better approach
const initializeI18n = async () => {
  try {
    // First, try to get stored language preference
    const storedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
    const initialLanguage = storedLanguage && Object.keys(supportedLanguages).includes(storedLanguage) 
      ? storedLanguage 
      : getDeviceLanguage();

    await i18n
      .use(initReactI18next)
      .init({
        compatibilityJSON: 'v3', // Important for React Native
        resources: {
          en: { translation: en },
          ru: { translation: ru },
          ua: { translation: ua },
          ro: { translation: ro }
        },
        lng: initialLanguage,
        fallbackLng: 'en',
        
        interpolation: {
          escapeValue: false // Not needed for React
        },
        
        // React i18next options
        react: {
          useSuspense: false // Important for React Native
        },
        
        // Add pluralization support
        pluralSeparator: '_',
        contextSeparator: '_',
        returnObjects: false,
        joinArrays: false,
        returnEmptyString: false,
        returnNull: false,
        parseMissingKeyHandler: false
  } as any);

    console.log('i18n initialized with language:', initialLanguage);
  } catch (error) {
    console.log('Error initializing i18n, using defaults:', error);
    // Fallback initialization
    await i18n
      .use(initReactI18next)
      .init({
        compatibilityJSON: 'v3',
        resources: {
          en: { translation: en },
          ru: { translation: ru },
          ua: { translation: ua },
          ro: { translation: ro }
        },
        lng: 'en',
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
        // Add pluralization support
        pluralSeparator: '_',
        contextSeparator: '_',
        returnObjects: false,
        joinArrays: false,
        returnEmptyString: false,
        returnNull: false,
        parseMissingKeyHandler: false
  } as any);
  }
};

// Save language preference
export const saveLanguagePreference = async (language: string) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, language);
    await i18n.changeLanguage(language);
    console.log('Language changed to:', language);
  } catch (error) {
    console.log('Error saving language preference:', error);
  }
};

// Initialize i18n immediately
initializeI18n();

export default i18n;