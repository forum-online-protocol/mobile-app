import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import Logo from '../components/Logo';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../hooks/useLocalization';

interface SplashScreenProps {
  navigation?: any;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const { theme } = useTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (navigation) {
        if (isAuthenticated) {
          navigation.navigate('Feed');
        } else {
          navigation.navigate('Auth');
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Logo size="large" color="white" showText={false} />
        
        <Text style={styles.title}>Forum</Text>
        
        
        <ActivityIndicator
          size="large"
          color={theme.card}
          style={styles.loader}
        />
      </View>
      
      <Text style={styles.footer}>{t('splash.footer')}</Text>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.card,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 48,
  },
  loader: {
    marginTop: 32,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: theme.card,
    opacity: 0.85,
  },
});

export default SplashScreen;
