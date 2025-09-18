import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
// import { NavigationContainer } from '@react-navigation/native';
import { RootSiblingParent } from 'react-native-root-siblings';
import { store } from './src/store';
import { Text, View, ActivityIndicator, StatusBar, Platform } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { testAsyncStorage } from './src/utils/testAsyncStorage';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { NavigationProvider } from './src/contexts/NavigationContext';
import DeepLinkService from './src/services/DeepLinkService';
import AsyncStorageService from './src/services/AsyncStorageService';
import { setPassportData, setAuthenticated, setWallet } from './src/store/authSlice';
import { WalletService } from './src/services/WalletService';
import { VersionCheckService } from './src/services/VersionCheckService';
import './src/localization/i18n'; // Initialize localization

const loadStoredAuthData = async (): Promise<boolean> => {
  try {
    let hasValidAuth = false;
    
    // Load stored passport data
    const passportDataStr = await AsyncStorageService.getItem('passport_data');
    if (passportDataStr) {
      try {
        const passportData = JSON.parse(passportDataStr);
        
        // Validate passport data has essential fields
        if (passportData && 
            (passportData.personalData?.firstName || passportData.firstName || passportData.isDemoAccount)) {
          console.log('[App] ✅ Valid passport data loaded:', 
            passportData.personalData?.firstName || passportData.firstName || 'Demo User');
          store.dispatch(setPassportData(passportData));
          store.dispatch(setAuthenticated(true));
          hasValidAuth = true;
        } else {
          console.log('[App] ⚠️ Invalid passport data structure, clearing stored data');
          await AsyncStorageService.removeItem('passport_data');
        }
      } catch (parseError) {
        console.error('[App] ❌ Failed to parse passport data, clearing stored data:', parseError);
        await AsyncStorageService.removeItem('passport_data');
      }
    }
    
    // Load stored wallet data
    const walletService = WalletService.getInstance();
    await walletService.initialize();
    const wallet = walletService.getCurrentWallet();
    if (wallet) {
      console.log('[App] Loaded wallet from storage:', wallet.address);
      store.dispatch(setWallet(wallet));
    }
    
    // Debug: Check current auth state
    const currentState = store.getState();
    console.log('[App] 📊 Current auth state after loading:');
    console.log('  - isAuthenticated:', currentState.auth.isAuthenticated);
    console.log('  - hasPassportData:', !!currentState.auth.passportData);
    console.log('  - hasWallet:', !!currentState.auth.wallet);
    console.log('[App] ✅ Auth data loaded from storage. Has valid auth:', hasValidAuth);
    return hasValidAuth;
  } catch (error) {
    console.error('[App] Failed to load stored auth data:', error);
    return false;
  }
};

const App: React.FC = () => {
  console.log('[App] App component initializing - timestamp:', Date.now());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialScreen, setInitialScreen] = useState<string>('Auth');

  useEffect(() => {
    // Simple initialization
    const init = async () => {
      try {
        // Test AsyncStorage first
        console.log('Testing AsyncStorage...');
        const asyncStorageWorks = await testAsyncStorage();
        console.log('AsyncStorage test result:', asyncStorageWorks);
        
        // Initialize deep linking
        console.log('Initializing deep links...');
        const deepLinkService = DeepLinkService.getInstance();
        await deepLinkService.initialize();
        
        // Load stored passport data
        console.log('Loading stored passport data...');
        const hasValidAuth = await loadStoredAuthData();
        
        // Check for app updates
        console.log('Checking for app updates...');
        try {
          const versionCheckService = VersionCheckService.getInstance();
          await versionCheckService.checkForUpdates();
        } catch (versionError) {
          console.error('[App] Version check failed:', versionError);
        }
        
        // Initialize ApiService and fetch feed if authenticated
        if (hasValidAuth) {
          console.log('[App] 🔐 User authenticated - initializing ApiService and fetching feed...');
          try {
            const ApiService = require('./src/services/ApiService').default;
            const apiService = ApiService.getInstance();
            
            // Initialize ApiService with current wallet
            const state = store.getState();
            if (state.auth.wallet) {
              console.log('[App] 🚀 Initializing ApiService with stored wallet...');
              await apiService.initialize(state.auth.wallet);
              console.log('[App] ✅ ApiService initialized and feed fetched');
            }
          } catch (apiError) {
            console.error('[App] ❌ Failed to initialize ApiService or fetch feed:', apiError);
          }
          
          console.log('[App] User has valid auth data - starting at Feed screen');
          setInitialScreen('Feed');
        } else {
          console.log('[App] No valid auth data - setting up guest mode and starting on Feed screen');
          // Set guest authentication (authenticated but no passport data)
          store.dispatch(setAuthenticated(true));
          setInitialScreen('Feed');
        }
        
        // Just wait a moment for things to settle
        await new Promise(resolve => setTimeout(resolve, 100));
        setIsReady(true);
      } catch (e) {
        console.error('App init error:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    };
    
    init();
  }, []);

  // Show error screen
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontSize: 18, color: '#F91880', fontWeight: '700' }}>Error</Text>
        <Text style={{ fontSize: 14, color: '#536471', marginTop: 10 }}>{error}</Text>
      </View>
    );
  }

  // Show loading screen
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontSize: 48, fontWeight: '800', color: '#000000', marginBottom: 8 }}>Forum</Text>
        <Text style={{ fontSize: 14, color: '#536471', marginBottom: 20 }}>Democracy Platform</Text>
        <ActivityIndicator size="large" color="#1D9BF0" />
      </View>
    );
  }

  // Main app with navigation and theme
  return (
    <Provider store={store}>
      <RootSiblingParent>
        <ThemeProvider>
          <NavigationProvider initialScreen={initialScreen}>
            <View style={{ flex: 1 }}>
              <StatusBar barStyle="light-content" backgroundColor="#000" />
              <RootNavigator />
            </View>
          </NavigationProvider>
        </ThemeProvider>
      </RootSiblingParent>
    </Provider>
  );
};

export default App;