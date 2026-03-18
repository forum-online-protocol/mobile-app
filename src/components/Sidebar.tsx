import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from './Icon';
import { useTheme } from '../contexts/ThemeContext';
import { ROUTES } from '../navigation/routes';
import { useLocalization } from '../hooks/useLocalization';

interface SidebarProps {
  navigation?: any;
  currentScreen?: string;
}

interface RootState {
  auth: {
    sessionType: 'guest' | 'signed' | 'verified';
  };
}

const Sidebar: React.FC<SidebarProps> = ({ navigation, currentScreen = ROUTES.FEED }) => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sessionType = useSelector((state: RootState) => state.auth.sessionType);
  const isGuest = sessionType === 'guest';

  const menuItems = [
    { id: ROUTES.FEED, labelKey: 'navigation.home', iconName: 'home' as const, path: ROUTES.FEED },
    { id: ROUTES.WALLET, labelKey: 'navigation.wallet', iconName: 'wallet' as const, path: ROUTES.WALLET, requiresAuth: true },
    { id: ROUTES.PROFILE, labelKey: 'navigation.profile', iconName: 'person' as const, path: ROUTES.PROFILE, requiresAuth: true },
    { id: ROUTES.SETTINGS, labelKey: 'profile.settings', iconName: 'settings' as const, path: ROUTES.SETTINGS },
  ];

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.sidebar}>
      <View style={styles.logoSection}>
        <Icon name="ballot" variant="filled" size={32} color={theme.text} />
        <Text style={styles.logoText}>{t('auth.forum')}</Text>
      </View>

      <View style={styles.navSection}>
        {menuItems.map((item) => {
          if (item.requiresAuth && isGuest) return null;

          const isActive = currentScreen === item.id;

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigation?.navigate(item.path)}
            >
              <Icon
                name={item.iconName}
                size={20}
                color={isActive ? theme.text : theme.textSecondary}
                variant={isActive ? 'filled' : 'outline'}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{t(item.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isGuest && (
        <View style={styles.guestPrompt}>
          <Text style={styles.guestTitle}>{t('sidebar.joinForum')}</Text>
          <Text style={styles.guestText}>{t('sidebar.verifyPassportPrompt')}</Text>
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={() => navigation?.navigate(ROUTES.AUTH)}
          >
            <Text style={styles.verifyButtonText}>{t('sidebar.getVerified')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: theme.card,
    borderRightWidth: 1,
    borderRightColor: theme.border,
    height: '100%',
    paddingTop: 20,
    paddingHorizontal: 12,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.text,
    marginLeft: 12,
  },
  navSection: {
    marginBottom: 24,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9999,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: theme.surface,
  },
  navLabel: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  navLabelActive: {
    color: theme.text,
    fontWeight: '700',
  },
  guestPrompt: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.primary,
    marginBottom: 8,
  },
  guestText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  verifyButton: {
    backgroundColor: theme.primary,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: theme.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default Sidebar;
