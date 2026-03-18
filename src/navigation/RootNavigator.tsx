import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useNavigation } from '../contexts/NavigationContext';
import { useLocalization } from '../hooks/useLocalization';
import { useTheme } from '../contexts/ThemeContext';
import { hairlineWidth } from '../styles/tokens';
import { AUTH_FLOW_ROUTES, PROTECTED_ROUTES, ROUTES } from './routes';

// Screens
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PassportScanScreen from '../screens/PassportScanScreen';
import BiometricSetupScreen from '../screens/BiometricSetupScreen';
import FeedScreen from '../screens/FeedScreen';
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PostCreateScreen from '../screens/PostCreateScreen';
import TransactionScreen from '../screens/TransactionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TransactionLogScreen from '../screens/TransactionLogScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import MRZScannerScreen from '../screens/MRZScannerScreen';
import MRZManualInputScreen from '../screens/MRZManualInputScreen';

const TAB_ROUTES = new Set([ROUTES.FEED, ROUTES.WALLET, ROUTES.PROFILE]);

const MainTabNavigator = () => {
  const { currentScreen, navigate, params } = useNavigation();
  const { t } = useLocalization();
  const { theme } = useTheme();
  const passportData = useSelector((state: RootState) => state.auth.passportData);
  const sessionType = useSelector((state: RootState) => state.auth.sessionType);

  const isGuest = sessionType === 'guest';

  const getActiveTab = () => {
    if ([ROUTES.FEED].includes(currentScreen)) return ROUTES.FEED;
    if ([ROUTES.WALLET, ROUTES.TRANSACTION].includes(currentScreen)) return ROUTES.WALLET;
    if ([ROUTES.PROFILE, ROUTES.SETTINGS, ROUTES.TRANSACTION_LOG].includes(currentScreen)) {
      return ROUTES.PROFILE;
    }
    return null;
  };

  const activeTab = getActiveTab();

  const renderAuthFlowScreen = () => {
    switch (currentScreen) {
      case ROUTES.AUTH:
        return <AuthScreen />;
      case ROUTES.ONBOARDING:
        return <OnboardingScreen />;
      case ROUTES.PASSPORT_SCAN:
      case ROUTES.PASSPORT_SCAN_SCREEN:
        return <PassportScanScreen />;
      case ROUTES.BIOMETRIC_SETUP:
        return <BiometricSetupScreen />;
      case ROUTES.MRZ_SCANNER:
      case ROUTES.MRZ_SCANNER_SCREEN:
        return <MRZScannerScreen />;
      case ROUTES.MRZ_MANUAL_INPUT:
      case ROUTES.MRZ_MANUAL_INPUT_SCREEN:
        return <MRZManualInputScreen />;
      default:
        return <AuthScreen />;
    }
  };

  const renderScreen = () => {
    // Keep auth/KYC flows explicit and tab-free
    if (AUTH_FLOW_ROUTES.has(currentScreen)) {
      return renderAuthFlowScreen();
    }

    // Protect signed-only routes
    if (isGuest && PROTECTED_ROUTES.has(currentScreen)) {
      return <AuthScreen />;
    }

    switch (currentScreen) {
      case ROUTES.FEED:
        return <FeedScreen />;
      case ROUTES.WALLET:
        return <WalletScreen />;
      case ROUTES.PROFILE:
        return <ProfileScreen />;
      case ROUTES.SETTINGS:
        return <SettingsScreen />;
      case ROUTES.TRANSACTION_LOG:
        return <TransactionLogScreen />;
      case ROUTES.USER_PROFILE:
        return <UserProfileScreen />;
      case ROUTES.TRANSACTION:
        return <TransactionScreen />;
      case ROUTES.POST_CREATE:
        return <PostCreateScreen />;
      case ROUTES.POST_DETAIL:
        return <PostDetailScreen route={{ params }} />;
      default:
        return <FeedScreen />;
    }
  };

  const showTabBar = !isGuest && TAB_ROUTES.has(currentScreen);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={styles.content}>{renderScreen()}</View>

      {showTabBar && (
        <View style={[styles.tabBar, { backgroundColor: theme.tabBarBackground, borderTopColor: theme.border }]}> 
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => navigate(ROUTES.FEED)}
            accessibilityRole="tab"
            accessibilityLabel={t('navigation.home')}
            accessibilityState={{ selected: activeTab === ROUTES.FEED }}
          >
            <Icon
              name="home"
              variant={activeTab === ROUTES.FEED ? 'filled' : 'outline'}
              size={20}
              color={activeTab === ROUTES.FEED ? theme.primary : theme.textTertiary}
            />
            <Text style={[styles.tabLabel, { color: activeTab === ROUTES.FEED ? theme.primary : theme.textTertiary }]}> 
              {t('navigation.home')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => navigate(ROUTES.WALLET)}
            accessibilityRole="tab"
            accessibilityLabel={t('navigation.wallet')}
            accessibilityState={{ selected: activeTab === ROUTES.WALLET }}
          >
            <Icon
              name="wallet"
              variant={activeTab === ROUTES.WALLET ? 'filled' : 'outline'}
              size={20}
              color={activeTab === ROUTES.WALLET ? theme.primary : theme.textTertiary}
            />
            <Text style={[styles.tabLabel, { color: activeTab === ROUTES.WALLET ? theme.primary : theme.textTertiary }]}> 
              {t('navigation.wallet')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => navigate(ROUTES.PROFILE)}
            accessibilityRole="tab"
            accessibilityLabel={t('navigation.profile')}
            accessibilityState={{ selected: activeTab === ROUTES.PROFILE }}
          >
            <Icon
              name="person"
              variant={activeTab === ROUTES.PROFILE ? 'filled' : 'outline'}
              size={20}
              color={activeTab === ROUTES.PROFILE ? theme.primary : theme.textTertiary}
            />
            <Text style={[styles.tabLabel, { color: activeTab === ROUTES.PROFILE ? theme.primary : theme.textTertiary }]}> 
              {t('navigation.profile')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const RootNavigator = () => {
  return <MainTabNavigator />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: hairlineWidth,
    paddingBottom: 5,
    paddingTop: 5,
    height: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default RootNavigator;
