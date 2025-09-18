import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useNavigation } from '../contexts/NavigationContext';
import { useLocalization } from '../hooks/useLocalization';

// Screens
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PassportScanScreen from '../screens/PassportScanScreen';
import BiometricSetupScreen from '../screens/BiometricSetupScreen';
import FeedScreen from '../screens/FeedScreen';
// Use regular wallet screen
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PostCreateScreen from '../screens/PostCreateScreen';
import TransactionScreen from '../screens/TransactionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import MRZScannerScreen from '../screens/MRZScannerScreen';
import MRZManualInputScreen from '../screens/MRZManualInputScreen';

const MainTabNavigator = () => {
  const { currentScreen, navigate, params } = useNavigation();
  const { t } = useLocalization();
  const passportData = useSelector((state: RootState) => state.auth.passportData);
  const isGuest = !passportData; // Guest if no passport data
  
  // Determine active tab based on current screen
  const getActiveTab = () => {
    if (['Feed'].includes(currentScreen)) return 'Feed';
    if (!isGuest && ['Wallet', 'Transaction'].includes(currentScreen)) return 'Wallet';
    if (!isGuest && ['Profile', 'Settings'].includes(currentScreen)) return 'Profile';
    // UserProfile, PostCreate, PostDetail, and other screens don't highlight any tab
    return null;
  };
  
  const activeTab = getActiveTab();

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Feed':
        return <FeedScreen />;
      case 'Wallet':
        return <WalletScreen />;
      case 'Profile':
        return <ProfileScreen />;
      case 'Settings':
        return <SettingsScreen />;
      case 'UserProfile':
        return <UserProfileScreen />;
      case 'Transaction':
        return <TransactionScreen />;
      case 'PostCreate':
        return <PostCreateScreen />;
      case 'PostDetail':
        return <PostDetailScreen route={{ params }} />;
      case 'PassportScan':
        return <PassportScanScreen />;
      case 'BiometricSetup':
        return <BiometricSetupScreen />;
      case 'Onboarding':
        return <OnboardingScreen />;
      case 'MRZScanner':
        return <MRZScannerScreen />;
      case 'MRZManualInput':
        return <MRZManualInputScreen />;
      case 'MRZManualInputScreen':
        return <MRZManualInputScreen />;
      default:
        return <FeedScreen />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {renderScreen()}
      </View>
      {!isGuest && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => navigate('Feed')}
          >
            <Icon
              name="home"
              variant="filled"
              size={20}
              color={activeTab === 'Feed' ? '#1DA1F2' : '#8B98A5'}
            />
            <Text style={[styles.tabLabel, { color: activeTab === 'Feed' ? '#1DA1F2' : '#8B98A5' }]}>
              {t('navigation.home')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => navigate('Wallet')}
          >
            <Icon
              name="wallet"
              variant="filled"
              size={20}
              color={activeTab === 'Wallet' ? '#1DA1F2' : '#8B98A5'}
            />
            <Text style={[styles.tabLabel, { color: activeTab === 'Wallet' ? '#1DA1F2' : '#8B98A5' }]}>
              {t('navigation.wallet')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => navigate('Profile')}
          >
            <Icon
              name="person"
              variant="filled"
              size={20}
              color={activeTab === 'Profile' ? '#1DA1F2' : '#8B98A5'}
            />
            <Text style={[styles.tabLabel, { color: activeTab === 'Profile' ? '#1DA1F2' : '#8B98A5' }]}>
              {t('navigation.profile')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const RootNavigator = () => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const passportData = useSelector((state: RootState) => state.auth.passportData);
  const { currentScreen } = useNavigation();

  console.log('[RootNavigator] Current screen:', currentScreen, 'Authenticated:', isAuthenticated, 'Has passport:', !!passportData);

  // Auth screens that don't show tabs (but only if user is not authenticated)
  const authScreens = ['Auth', 'Onboarding', 'PassportScan', 'PassportScanScreen', 'BiometricSetup', 'NFCDebug', 'MRZScanner', 'MRZScannerScreen'];
  
  // If not authenticated, show auth screens only when explicitly navigating to them
  if (!isAuthenticated && authScreens.includes(currentScreen)) {
    console.log('[RootNavigator] User not authenticated, showing specific auth screen:', currentScreen);
    // Show auth flow screens without tabs
    switch (currentScreen) {
      case 'Auth':
        return <AuthScreen />;
      case 'Onboarding':
        return <OnboardingScreen />;
      case 'PassportScan':
        return <PassportScanScreen />;
      case 'PassportScanScreen':
        return <PassportScanScreen />;
      case 'BiometricSetup':
        return <BiometricSetupScreen />;
      case 'NFCDebug':
        return <NFCDebugScreen />;
      case 'MRZScanner':
        return <MRZScannerScreen />;
      case 'MRZScannerScreen':
        return <MRZScannerScreen />;
      default:
        return <AuthScreen />;
    }
  }

  // If authenticated but on specific auth screens (like Auth, MRZ scanner)
  const specialScreens = ['Auth', 'PassportScan', 'PassportScanScreen', 'BiometricSetup', 'MRZScanner', 'MRZScannerScreen'];
  if (isAuthenticated && specialScreens.includes(currentScreen)) {
    console.log('[RootNavigator] Authenticated user on special screen:', currentScreen);
    switch (currentScreen) {
      case 'Auth':
        return <AuthScreen />;
      case 'PassportScan':
        return <PassportScanScreen />;
      case 'PassportScanScreen':
        return <PassportScanScreen />;
      case 'BiometricSetup':
        return <BiometricSetupScreen />;
      case 'MRZScanner':
        return <MRZScannerScreen />;
      case 'MRZScannerScreen':
        return <MRZScannerScreen />;
      default:
        return <MainTabNavigator />;
    }
  }

  // Default: show main app with tabs
  return <MainTabNavigator />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
    paddingBottom: 5,
    paddingTop: 5,
    height: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemCentered: {
    // When guest mode, center the home tab
    marginHorizontal: 'auto',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default RootNavigator;