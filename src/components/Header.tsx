import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { useSelector } from 'react-redux';
import Logo from './Logo';
import Icon from './Icon';
import { useTheme } from '../contexts/ThemeContext';
import { ROUTES } from '../navigation/routes';
import { useLocalization } from '../hooks/useLocalization';

interface HeaderProps {
  navigation?: any;
  currentScreen?: string;
}

interface RootState {
  auth: {
    passportData: any;
    sessionType: 'guest' | 'signed' | 'verified';
  };
}

const Header: React.FC<HeaderProps> = ({ navigation, currentScreen = ROUTES.FEED }) => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { passportData, sessionType } = useSelector((state: RootState) => state.auth);
  const isGuest = sessionType === 'guest';

  const menuItems = [
    { id: ROUTES.FEED, labelKey: 'navigation.home', iconName: 'home' as const },
    { id: ROUTES.WALLET, labelKey: 'navigation.wallet', iconName: 'wallet' as const, requiresAuth: true },
    { id: ROUTES.PROFILE, labelKey: 'navigation.profile', iconName: 'person' as const, requiresAuth: true },
    { id: ROUTES.SETTINGS, labelKey: 'profile.settings', iconName: 'settings' as const },
  ];

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.leftSection}>
          <TouchableOpacity
            style={styles.logo}
            onPress={() => navigation?.navigate(ROUTES.FEED)}
            accessibilityRole="button"
            accessibilityLabel={t('header.goHome')}
          >
            <Logo size="medium" color="black" />
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nav}>
            {menuItems.map((item) => {
              if (item.requiresAuth && isGuest) return null;

              const isActive = currentScreen === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => navigation?.navigate(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t(item.labelKey)}
                >
                  <Icon
                    name={item.iconName}
                    size={20}
                    color={isActive ? theme.text : theme.textSecondary}
                    variant={isActive ? 'filled' : 'outline'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{t(item.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.rightSection}>
          {isGuest ? (
            <TouchableOpacity
              style={styles.getAppButton}
              onPress={() => navigation?.navigate(ROUTES.AUTH)}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signIn')}
            >
              <Text style={styles.getAppText}>{t('auth.signIn')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.userSection}>
              <TouchableOpacity
                style={styles.userButton}
                accessibilityRole="button"
                accessibilityLabel={t('header.profileMenu')}
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {passportData?.firstName?.[0] || passportData?.personalData?.firstName?.[0] || 'U'}
                  </Text>
                </View>
                <Text style={styles.userName}>
                  {passportData?.firstName || passportData?.personalData?.firstName || t('header.userFallback')}
                </Text>
                <Icon name="chevron-down" size={12} color={theme.textSecondary} variant="outline" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    header: {
      backgroundColor: theme.headerBackground,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      height: 60,
      position: 'sticky' as any,
      top: 0,
      zIndex: 1000,
      width: '100%',
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '100%',
      paddingHorizontal: 20,
      maxWidth: 1280,
      marginHorizontal: 'auto',
      width: '100%',
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    logo: {
      marginRight: 32,
      flexDirection: 'row',
      alignItems: 'center',
    },
    nav: {
      flexDirection: 'row',
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 8,
      borderRadius: 9999,
    },
    navItemActive: {
      backgroundColor: theme.surface,
    },
    navLabel: {
      fontSize: 15,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    navLabelActive: {
      color: theme.text,
      fontWeight: '700',
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    getAppButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 9999,
    },
    getAppText: {
      fontSize: 15,
      color: theme.onPrimary,
      fontWeight: '700',
    },
    userSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    userButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 9999,
      backgroundColor: theme.surface,
    },
    userAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    userAvatarText: {
      color: theme.onPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    userName: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
      marginRight: 4,
    },
  });

export default Header;
