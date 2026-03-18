import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useDispatch } from 'react-redux';
import { setBiometricEnabled } from '../store/authSlice';
import { BiometricService } from '../services/BiometricService';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../hooks/useLocalization';
// import { LinearGradient } from 'expo-linear-gradient';

const BiometricSetupScreen: React.FC = () => {
  const dispatch = useDispatch();
  const biometricService = BiometricService.getInstance();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleSetup = async () => {
    const success = await biometricService.createKeys();
    if (success) {
      dispatch(setBiometricEnabled(true));
      navigation.navigate('Feed' as never);
    }
  };

  const handleSkip = () => {
    navigation.navigate('Feed' as never);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <View style={styles.content}>
        <Text style={styles.heroIcon}>👆</Text>
        <Text style={styles.title}>{t('biometric.title')}</Text>
        <Text style={styles.description}>
          {t('biometric.description')}
        </Text>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleSetup}
          style={styles.buttonWrapper}
          accessibilityRole="button"
          accessibilityLabel={t('biometric.enableA11y')}
        >
          <View style={styles.button}>
            <Text style={styles.buttonText}>{t('biometric.enableButton')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel={t('biometric.skipA11y')}
        >
          <Text style={styles.skipText}>{t('biometric.skipForNow')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  heroIcon: {
    fontSize: 80,
    color: theme.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    color: theme.text,
  },
  description: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  footer: {
    padding: 20,
  },
  buttonWrapper: {
    width: '100%',
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.primary,
  },
  buttonText: {
    color: theme.onPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    padding: 16,
    alignItems: 'center',
  },
  skipText: {
    color: theme.textSecondary,
    fontSize: 16,
  },
});

export default BiometricSetupScreen;
