import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from './Icon';

interface SidebarProps {
  navigation?: any;
  currentScreen?: string;
}

interface RootState {
  auth: {
    isAuthenticated: boolean;
    passportData: any;
  };
}

const Sidebar: React.FC<SidebarProps> = ({ navigation, currentScreen = 'Feed' }) => {
  const passportData = useSelector((state: RootState) => state.auth.passportData);
  const isGuest = !passportData;

  const menuItems = [
    { id: 'Feed', label: 'Home', iconName: 'home' as const, path: 'Feed' },
    { id: 'Explore', label: 'Explore', iconName: 'search' as const, path: 'Explore' },
    { id: 'Proposals', label: 'Active Proposals', iconName: 'document' as const, path: 'Proposals' },
    { type: 'divider' },
    { id: 'Wallet', label: 'Wallet', iconName: 'wallet' as const, path: 'Wallet', requiresAuth: true },
    { id: 'Profile', label: 'Profile', iconName: 'person' as const, path: 'Profile', requiresAuth: true },
    { id: 'Settings', label: 'Settings', iconName: 'settings' as const, path: 'Settings', requiresAuth: true },
  ];

  const stats = {
    activeProposals: 12,
    totalVoters: '45.2K',
    participation: '67%',
  };

  if (Platform.OS !== 'web') {
    return null; // Sidebar only for web
  }

  return (
    <View style={styles.sidebar}>
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <Icon name="ballot" variant="filled" size={32} color="#000000" />
        <Text style={styles.logoText}>Forum</Text>
      </View>
      
      {/* Navigation Items */}
      <View style={styles.navSection}>
        {menuItems.map((item, index) => {
          if (item.type === 'divider') {
            return <View key={`divider-${index}`} style={styles.divider} />;
          }
          
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
                color={isActive ? '#0F1419' : '#536471'}
                variant={isActive ? 'filled' : 'outline'}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
              {item.id === 'Proposals' && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{stats.activeProposals}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={styles.statsTitle}>Platform Stats</Text>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Active Voters</Text>
          <Text style={styles.statValue}>{stats.totalVoters}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Participation</Text>
          <Text style={styles.statValue}>{stats.participation}</Text>
        </View>
      </View>

      {/* Guest Prompt */}
      {isGuest && (
        <View style={styles.guestPrompt}>
          <Text style={styles.guestTitle}>Join Forum</Text>
          <Text style={styles.guestText}>
            Verify with your passport to participate in governance
          </Text>
          <TouchableOpacity 
            style={styles.verifyButton}
            onPress={() => navigation?.navigate('Auth')}
          >
            <Text style={styles.verifyButtonText}>Get Verified</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerLink}>
          <Text style={styles.footerText}>About</Text>
        </TouchableOpacity>
        <Text style={styles.footerDot}>·</Text>
        <TouchableOpacity style={styles.footerLink}>
          <Text style={styles.footerText}>Help</Text>
        </TouchableOpacity>
        <Text style={styles.footerDot}>·</Text>
        <TouchableOpacity style={styles.footerLink}>
          <Text style={styles.footerText}>Terms</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#EFF3F4',
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
    borderBottomColor: '#EFF3F4',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#17559e',
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
    backgroundColor: '#F7F9FA',
  },
  navIcon: {
    fontSize: 20,
    marginRight: 16,
    width: 24,
  },
  navLabel: {
    fontSize: 15,
    color: '#536471',
    fontWeight: '500',
    flex: 1,
  },
  navLabelActive: {
    color: '#0F1419',
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#1D9BF0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFF3F4',
    marginVertical: 12,
  },
  statsSection: {
    backgroundColor: '#F7F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1419',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#536471',
  },
  statValue: {
    fontSize: 14,
    color: '#0F1419',
    fontWeight: '600',
  },
  guestPrompt: {
    backgroundColor: '#E8F5FD',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1D9BF0',
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17559e',
    marginBottom: 8,
  },
  guestText: {
    fontSize: 14,
    color: '#536471',
    marginBottom: 12,
    lineHeight: 20,
  },
  verifyButton: {
    backgroundColor: '#1D9BF0',
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 'auto',
  },
  footerLink: {
    padding: 4,
  },
  footerText: {
    fontSize: 13,
    color: '#536471',
  },
  footerDot: {
    marginHorizontal: 8,
    color: '#536471',
    fontSize: 13,
  },
});

export default Sidebar;