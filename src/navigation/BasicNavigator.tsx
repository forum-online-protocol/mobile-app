import React, { useEffect, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

// Screens
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Platform-specific screens
const WalletScreen = Platform.OS === 'web'
  ? require('../screens/WalletScreen.web').default
  : require('../screens/WalletScreen').default;

const BasicNavigator = () => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [currentScreen, setCurrentScreen] = useState('Splash');

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('BasicNavigator mount. Types =>', {
      SplashScreen: typeof SplashScreen,
      AuthScreen: typeof AuthScreen,
      FeedScreen: typeof FeedScreen,
      ProfileScreen: typeof ProfileScreen,
      WalletScreen: typeof WalletScreen,
    });
  }, []);

  // Simple navigation without any native dependencies
  const navigate = (screenName: string) => {
    setCurrentScreen(screenName);
  };

  // Navigation prop mock
  const navigation = {
    navigate: (screen: string) => {
      setCurrentScreen(screen);
    },
    goBack: () => setCurrentScreen('Splash'),
    replace: (screen: string) => setCurrentScreen(screen),
  };

  const safeRender = (Component: any, name: string, props: any = {}) => {
    const isValid = Component && (typeof Component === 'function' || typeof Component === 'object');
    if (!isValid) {
      // eslint-disable-next-line no-console
      console.error(`Attempted to render ${name}, but it is`, Component);
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#EF4444', textAlign: 'center' }}>
            {name} is invalid (got {String(Component)})
          </Text>
        </View>
      );
    }
    // @ts-ignore
    return <Component {...props} />;
  };

  if (!isAuthenticated) {
    if (currentScreen === 'Splash') {
      return safeRender(SplashScreen, 'SplashScreen', { navigation });
    }
    if (currentScreen === 'Auth') {
      return safeRender(AuthScreen, 'AuthScreen', { navigation });
    }
    // Default to splash if unknown screen
    return safeRender(SplashScreen, 'SplashScreen', { navigation });
  }

  // Authenticated screens
  switch (currentScreen) {
    case 'Wallet':
      return safeRender(WalletScreen, 'WalletScreen', { navigation });
    case 'Profile':
      return safeRender(ProfileScreen, 'ProfileScreen');
    case 'Feed':
    default:
      return safeRender(FeedScreen, 'FeedScreen', { navigation });
  }
};

export default BasicNavigator;