import React from 'react';
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

interface HeaderProps {
  navigation?: any;
  currentScreen?: string;
}

interface RootState {
  auth: {
    isAuthenticated: boolean;
    passportData: any;
  };
}

const Header: React.FC<HeaderProps> = ({ navigation, currentScreen = 'Feed' }) => {
  const passportData = useSelector((state: RootState) => state.auth.passportData);
  const isGuest = !passportData;

  const menuItems = [
    { id: 'feed', label: 'Home', iconName: 'home' as const },
    { id: 'explore', label: 'Explore', iconName: 'search' as const },
    { id: 'proposals', label: 'Proposals', iconName: 'document' as const },
    { id: 'wallet', label: 'Wallet', iconName: 'wallet' as const, requiresAuth: true },
    { id: 'profile', label: 'Profile', iconName: 'person' as const, requiresAuth: true },
  ];

  if (Platform.OS !== 'web') {
    return null; // Header only for web
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {/* Left Section - Logo and Navigation */}
        <View style={styles.leftSection}>
          <TouchableOpacity style={styles.logo} onPress={() => navigation?.navigate('Feed')}>
            <Logo size="medium" color="black" />
          </TouchableOpacity>
          
          {/* Navigation Menu */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nav}>
            {menuItems.map((item) => {
              if (item.requiresAuth && isGuest) return null;
              
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.navItem,
                    currentScreen === item.id && styles.navItemActive,
                  ]}
                  onPress={() => navigation?.navigate(item.id)}
                >
                  <Icon 
                    name={item.iconName}
                    size={20} 
                    color={currentScreen === item.id ? '#0F1419' : '#536471'}
                    variant={currentScreen === item.id ? 'filled' : 'outline'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[
                    styles.navLabel,
                    currentScreen === item.id && styles.navLabelActive,
                  ]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Right Section - User Actions */}
        <View style={styles.rightSection}>
          {isGuest ? (
            <TouchableOpacity 
              style={styles.getAppButton}
              onPress={() => {}}
            >
              <Text style={styles.getAppText}>Get App</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.userSection}>
              <TouchableOpacity style={styles.notificationButton}>
                <Icon name="notifications" size={22} color="#536471" variant="outline" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.userButton}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {passportData?.firstName?.[0] || 'U'}
                  </Text>
                </View>
                <Text style={styles.userName}>
                  {passportData?.firstName || 'User'}
                </Text>
                <Icon name="chevron-down" size={12} color="#536471" variant="outline" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
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
    backgroundColor: '#F7F9FA',
  },
  navIcon: {
    fontSize: 18,
    marginRight: 8,
    color: '#0F1419',
    fontWeight: '400',
  },
  navLabel: {
    fontSize: 15,
    color: '#536471',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#0F1419',
    fontWeight: '700',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signInButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  signInText: {
    fontSize: 15,
    color: '#1D9BF0',
    fontWeight: '600',
  },
  getAppButton: {
    backgroundColor: '#1D9BF0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  getAppText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    padding: 8,
    marginRight: 8,
  },
  notificationIcon: {
    fontSize: 20,
  },
  userButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 9999,
    backgroundColor: '#F7F9FA',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1D9BF0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  userName: {
    fontSize: 14,
    color: '#0F1419',
    fontWeight: '600',
    marginRight: 4,
  },
  dropdownIcon: {
    fontSize: 10,
    color: '#536471',
    marginLeft: 4,
  },
});

export default Header;