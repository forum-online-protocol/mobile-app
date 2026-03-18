import React, {useMemo, useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Animated,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {setGuestSession, setPassportData, setWallet} from '../store/authSlice';
import { fetchFeed } from '../store/socialSlice';
import { NFCService } from '../services/NFCService';
import { DemoService } from '../services/DemoService';
import AuthService from '../services/AuthService';
import { useNavigation } from '../contexts/NavigationContext';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
// import MRZScannerModal from '../components/MRZScannerModal'; // Disabled: MRZ scanner temporarily turned off
import NFCStatusCheck from '../components/NFCStatusCheck';
import LanguageSelector from '../components/LanguageSelector';
import { isMRZScannerSupported, getMRZUnavailableReason } from '../utils/deviceDetection';
import { useTheme } from '../contexts/ThemeContext';
import { hairlineWidth, radii, spacing, typography } from '../styles/tokens';
import { openExternalUrl } from '../utils/openExternalUrl';

const AuthScreen: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isScanning, setIsScanning] = useState(false);
  const [showNFCCheck, setShowNFCCheck] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<any>(null);
  
  // Auto-login as guest on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Auto-login as guest after a brief delay
      setTimeout(async () => {
        dispatch(setGuestSession());
        console.log('[AuthScreen] Web demo mode: authenticated and navigating to Feed');
        // Refetch feed after authentication
        await dispatch(fetchFeed({} as any) as any);
        navigation.navigate('Feed');
      }, 1000);
    }
    
    // Cleanup animation on unmount
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, []);

  // Reset scanning state when returning to AuthScreen
  useEffect(() => {
    const resetScanningState = () => {
      console.log('[AuthScreen] Screen focused - resetting scanning state');
      setIsScanning(false);
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      scaleAnim.setValue(1);
    };

    // Reset state immediately when component mounts/focuses
    resetScanningState();
  }, []);

  

  const startNFCScanWithMRZ = async (mrzInfo: { documentNumber: string; dateOfBirth: string; dateOfExpiry: string }) => {
    try {
      setIsScanning(true);
      
      console.log('[AuthScreen] Starting NFC scan with MRZ...');
      console.log('[AuthScreen] MRZ:', JSON.stringify(mrzInfo));
      
      // Start animation
      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animationRef.current.start();
      
      const nfcService = NFCService.getInstance();
      console.log('[AuthScreen] NFCService instance obtained');
      
      const passportData = await nfcService.startPassportScan(mrzInfo);
      console.log('[AuthScreen] Passport scan completed');
      
      // Stop animation
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      scaleAnim.setValue(1);
      
      // Generate wallet + enforce on-chain registration before entering app
      const fallbackNickname = [
        passportData?.personalData?.firstName || passportData?.firstName || 'user',
        passportData?.personalData?.lastName || passportData?.lastName || '',
      ]
        .join('_')
        .trim();
      const authService = AuthService.getInstance();
      const authResult = await authService.authenticateWithPassport(passportData, fallbackNickname);
      if (!authResult.success || !authResult.wallet) {
        throw new Error(authResult.error || 'On-chain registration failed');
      }
      dispatch(setWallet(authResult.wallet as any));
      console.log('[AuthScreen] Wallet created and registered:', (authResult.wallet as any).address);
      
      setIsScanning(false);
      dispatch(setPassportData(passportData));

      // Refetch feed after authentication
      await dispatch(fetchFeed({} as any) as any);
      console.log('[AuthScreen] Feed refetched after authentication');

      // Navigate to main app
      navigation.navigate('Feed');
    } catch (error: any) {
      console.error('[AuthScreen] NFC Error:', error);
      // Stop animation on error
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      scaleAnim.setValue(1);
      setIsScanning(false);
      
      // Handle different error types
      if (error.message && error.message.includes('canceled')) {
        console.log('[AuthScreen] Scan was canceled by user');
        // Don't show error dialog for user cancellation
      } else {
        Alert.alert(
          t('auth.scanFailed'),
          t('auth.couldNotReadPassport'),
          [{text: t('common.ok')}]
        );
      }
    }
  };

  const startNFCScan = async () => {
    try {
      // Check NFC availability on native platforms
      if (Platform.OS !== 'web') {
        const nfcService = NFCService.getInstance();
        try {
          const isEnabled = await nfcService.isNFCEnabled();
          
          if (!isEnabled) {
            // Show NFC status check component
            setShowNFCCheck(true);
            return;
          }
        } catch (error) {
          console.error('NFC check failed:', error);
          Alert.alert(
            t('auth.nfcError'),
            t('auth.couldNotAccessNFC'),
            [{text: t('common.ok')}]
          );
          setIsScanning(false);
          return;
        }
      }
      
      // Check if MRZ scanner is supported on this device
      if (!isMRZScannerSupported()) {
        setIsScanning(false);
        Alert.alert(
          t('auth.mrzScannerUnavailable'),
          getMRZUnavailableReason(),
          [
            {
              text: t('auth.enterManually'),
              onPress: () => navigation.navigate('MRZManualInputScreen')
            },
            {
              text: t('common.cancel'),
              style: 'cancel'
            }
          ]
        );
        return;
      }

      // Navigate directly to MRZ Scanner
      console.log('[AuthScreen] Navigating to MRZ Scanner...');
      navigation.navigate('MRZScannerScreen');
      
    } catch (error) {
      console.error('NFC Error:', error);
      // Stop animation on error and reset value
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      scaleAnim.setValue(1);
      setIsScanning(false);
      Alert.alert(
        t('auth.scanFailed'),
        t('auth.couldNotNavigateToScanner'),
        [{text: t('common.ok')}]
      );
    }
  };


  const continueAsGuest = async () => {
    dispatch(setGuestSession());
    // Refetch feed after authentication
    await dispatch(fetchFeed({} as any) as any);
    console.log('[AuthScreen] Feed refetched after guest authentication');
    navigation.navigate('Feed');
  };

  const openDemoModal = () => {
    setShowDemoModal(true);
    setPrivateKeyInput('');
  };

  const closeDemoModal = () => {
    setShowDemoModal(false);
    setPrivateKeyInput('');
  };

  const activateDemoWithNewKey = async () => {
    try {
      setIsScanning(true);
      closeDemoModal();
      console.log('[AuthScreen] Activating demo mode with new key...');

      const demoService = DemoService.getInstance();
      const { passportData, wallet } = await demoService.activateDemoModeWithNewKey();

      // Update Redux store
      dispatch(setPassportData(passportData));
      dispatch(setWallet(wallet));

      // Skip API initialization in demo mode - no API requests
      console.log('[AuthScreen] Demo mode: Skipping API initialization (offline mode)');

      // Refetch feed (will use mock data in demo mode)
      await dispatch(fetchFeed({} as any) as any);
      console.log('[AuthScreen] Demo mode activated successfully with new key');

      setIsScanning(false);
      navigation.navigate('Feed');
    } catch (error) {
      console.error('[AuthScreen] Demo mode activation failed:', error);
      setIsScanning(false);
      Alert.alert(
        t('common.error'),
        t('auth.demoModeError'),
        [{text: t('common.ok')}]
      );
    }
  };

  const activateDemoWithPrivateKey = async () => {
    if (!privateKeyInput.trim()) {
      Alert.alert(
        t('common.error'),
        t('auth.enterPrivateKey'),
        [{text: t('common.ok')}]
      );
      return;
    }

    try {
      setIsScanning(true);
      closeDemoModal();
      console.log('[AuthScreen] Activating demo mode with private key...');

      const demoService = DemoService.getInstance();
      const { passportData, wallet } = await demoService.activateDemoModeWithPrivateKey(privateKeyInput);

      // Update Redux store
      dispatch(setPassportData(passportData));
      dispatch(setWallet(wallet));

      // Skip API initialization in demo mode - no API requests
      console.log('[AuthScreen] Demo mode: Skipping API initialization (offline mode)');

      // Refetch feed (will use mock data in demo mode)
      await dispatch(fetchFeed({} as any) as any);
      console.log('[AuthScreen] Demo mode activated successfully with private key');

      setIsScanning(false);
      navigation.navigate('Feed');
    } catch (error) {
      console.error('[AuthScreen] Demo mode activation failed:', error);
      setIsScanning(false);
      Alert.alert(
        t('common.error'),
        t('auth.invalidPrivateKey'),
        [{text: t('common.ok')}]
      );
    }
  };

  // Show loading for web auto-login
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.loadingBg]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
        <View style={styles.loadingContainer}>
          <Logo size="large" color="white" showText={false} />
          <Text style={styles.logoTextLarge}>{t('auth.forum')}</Text>
          <Text style={styles.loadingText}>{t('auth.loadingDemocracyPlatform')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}>
        
        {/* Language Selector */}
        <View style={styles.languageSelectorContainer}>
          <LanguageSelector size="small" />
        </View>
        
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Logo size="large" color="primary" />
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
          
        </View>


        {/* Auth Options */}
        <View style={styles.authSection}>
          
          {/* NFC Status Check */}
          {showNFCCheck && (
            <NFCStatusCheck
              onNFCEnabled={() => {
                setShowNFCCheck(false);
                // Navigate to manual input screen
                navigation.navigate('MRZManualInputScreen');
              }}
              onSkip={() => {
                setShowNFCCheck(false);
                navigation.navigate('MRZManualInputScreen');
              }}
            />
          )}

          {/* Passport Sign In */}
          <TouchableOpacity
            onPress={startNFCScan}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('auth.signInWithPassportNFC')}
            style={[styles.primaryButton, !isMRZScannerSupported() && styles.buttonWithBadge]}>
            <Text style={styles.buttonText}>{t('auth.signInWithPassportNFC')}</Text>
            {!isMRZScannerSupported() && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>{t('auth.mrzComingSoon')}</Text>
              </View>
            )}
          </TouchableOpacity>


          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Guest Mode */}
          <TouchableOpacity
            onPress={continueAsGuest}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('auth.continueAsGuest')}
            style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>{t('auth.continueAsGuest')}</Text>
          </TouchableOpacity>

          {/* Demo Mode - For App Store reviewers and testing */}
          <TouchableOpacity
            onPress={openDemoModal}
            activeOpacity={0.8}
            disabled={isScanning}
            accessibilityRole="button"
            accessibilityLabel={t('auth.demoMode')}
            style={[styles.demoButton, isScanning && styles.buttonDisabled]}>
            <Text style={styles.demoButtonText}>
              {isScanning ? t('common.loading') : t('auth.demoMode')}
            </Text>
            <Text style={styles.demoButtonSubtext}>{t('auth.demoModeDescription')}</Text>
          </TouchableOpacity>

          {/* Info Text */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>{t('auth.whyPassportAuth')}</Text>
            <Text style={styles.infoText}>
              {t('auth.passportAuthDescription')}
            </Text>
          </View>
          
          {/* Help Links */}
          <View style={styles.helpLinks}>
            <TouchableOpacity
              onPress={() =>
                void openExternalUrl([
                  'https://github.com/forum-online-protocol/privacy-policy',
                  'https://forum.online',
                ])
              }>
              <Text style={styles.linkText}>{t('auth.privacyPolicy')}</Text>
            </TouchableOpacity>
            <Text style={styles.linkDot}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://forum.online')}>
              <Text style={styles.linkText}>{t('auth.learnMore')}</Text>
            </TouchableOpacity>
          </View>
          
        </View>

      </ScrollView>
      
      {/* MRZ Scanner Modal - DISABLED
      <MRZScannerModal
        visible={showMRZScanner}
        onClose={() => setShowMRZScanner(false)}
        onMRZScanned={handleMRZScanned}
      />
      */}

      {/* Demo Mode Modal */}
      <Modal
        visible={showDemoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeDemoModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('auth.demoMode')}</Text>
            <Text style={styles.modalDescription}>{t('auth.demoModeFullDescription')}</Text>

            {/* Option 1: Generate New Key */}
            <TouchableOpacity
              onPress={activateDemoWithNewKey}
              style={styles.modalOptionButton}>
              <Text style={styles.modalOptionTitle}>{t('auth.generateNewKey')}</Text>
              <Text style={styles.modalOptionDescription}>{t('auth.generateNewKeyDescription')}</Text>
            </TouchableOpacity>

            {/* Option 2: Use Private Key */}
            <View style={styles.modalDivider}>
              <View style={styles.modalDividerLine} />
              <Text style={styles.modalDividerText}>{t('auth.or')}</Text>
              <View style={styles.modalDividerLine} />
            </View>

            <Text style={styles.inputLabel}>{t('auth.usePrivateKey')}</Text>
            <TextInput
              style={styles.privateKeyInput}
              placeholder={t('auth.privateKeyPlaceholder')}
                placeholderTextColor={theme.placeholder}
              value={privateKeyInput}
              onChangeText={setPrivateKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={false}
              multiline={false}
            />
            <TouchableOpacity
              onPress={activateDemoWithPrivateKey}
              disabled={!privateKeyInput.trim()}
              style={[styles.modalSubmitButton, !privateKeyInput.trim() && styles.buttonDisabled]}>
              <Text style={styles.modalSubmitButtonText}>{t('auth.useThisKey')}</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity onPress={closeDemoModal} style={styles.modalCancelButton}>
              <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  languageSelectorContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: spacing.xl,
    zIndex: 1000,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: Platform.OS === 'web' ? '10%' : spacing.xxxl,
    paddingTop: 80,
    paddingBottom: 30,
    maxWidth: Platform.OS === 'web' ? 400 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '800',
    color: theme.text,
    marginBottom: spacing.m,
    marginTop: spacing.m,
  },
  logoTextLarge: {
    fontSize: 60,
    fontWeight: '800',
    color: theme.primaryDark,
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: theme.onPrimary,
    opacity: 0.9,
  },
  loadingBg: {
    backgroundColor: theme.primary,
  },
  logoWrapper: {
    marginBottom: spacing.xl,
  },
  tagline: {
    ...typography.body,
    color: theme.textSecondary,
    letterSpacing: 0.3,
  },
  authSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 31,
    fontWeight: '700',
    color: theme.primaryDark,
    marginBottom: spacing.xxxl,
    letterSpacing: -0.5,
  },
  primaryButton: {
    backgroundColor: theme.primary,
    paddingVertical: 15,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.bodyStrong,
    color: theme.onPrimary,
  },
  secondaryButton: {
    backgroundColor: theme.card,
    paddingVertical: 15,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginBottom: spacing.m,
    borderWidth: hairlineWidth,
    borderColor: theme.border,
  },
  secondaryButtonText: {
    ...typography.bodyStrong,
    color: theme.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: hairlineWidth,
    backgroundColor: theme.border,
  },
  dividerText: {
    marginHorizontal: spacing.l,
    ...typography.body,
    color: theme.textSecondary,
  },
  outlineButton: {
    backgroundColor: theme.card,
    paddingVertical: 15,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginBottom: spacing.xxxl,
    borderWidth: hairlineWidth,
    borderColor: theme.border,
  },
  outlineButtonText: {
    ...typography.bodyStrong,
    color: theme.primary,
  },
  infoContainer: {
    backgroundColor: theme.surface,
    borderRadius: radii.m,
    padding: spacing.l,
    marginBottom: spacing.xxl,
    borderWidth: hairlineWidth,
    borderColor: theme.border,
  },
  infoTitle: {
    ...typography.bodyStrong,
    color: theme.text,
    marginBottom: spacing.s,
  },
  infoText: {
    ...typography.caption,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  helpLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  linkText: {
    ...typography.body,
    color: theme.primary,
  },
  linkDot: {
    marginHorizontal: spacing.m,
    color: theme.textSecondary,
    fontSize: 15,
  },
  buttonWithBadge: {
    position: 'relative',
    overflow: 'visible',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: theme.warning,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    borderRadius: radii.m,
    elevation: 3,
    shadowColor: theme.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  comingSoonText: {
    color: theme.onPrimary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  demoButton: {
    backgroundColor: 'rgba(29, 155, 240, 0.1)',
    paddingVertical: spacing.l,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radii.m,
    alignItems: 'center',
    marginBottom: spacing.xxl,
    borderWidth: 2,
    borderColor: theme.primary,
    borderStyle: 'dashed',
  },
  demoButtonText: {
    ...typography.bodyStrong,
    color: theme.primary,
    marginBottom: spacing.xs,
  },
  demoButtonSubtext: {
    ...typography.small,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.modalBackground,
    borderRadius: radii.l,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 400,
    borderWidth: hairlineWidth,
    borderColor: theme.border,
  },
  modalTitle: {
    ...typography.headline,
    color: theme.text,
    textAlign: 'center',
    marginBottom: spacing.s,
  },
  modalDescription: {
    ...typography.caption,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 20,
  },
  modalOptionButton: {
    backgroundColor: theme.primary,
    paddingVertical: spacing.l,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.m,
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  modalOptionTitle: {
    ...typography.bodyStrong,
    color: theme.onPrimary,
    marginBottom: spacing.xs,
  },
  modalOptionDescription: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  modalDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.l,
  },
  modalDividerLine: {
    flex: 1,
    height: hairlineWidth,
    backgroundColor: theme.border,
  },
  modalDividerText: {
    marginHorizontal: spacing.l,
    ...typography.caption,
    color: theme.textSecondary,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: theme.text,
    marginBottom: spacing.s,
  },
  privateKeyInput: {
    backgroundColor: theme.inputBackground,
    borderWidth: hairlineWidth,
    borderColor: theme.inputBorder,
    borderRadius: radii.s,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    ...typography.caption,
    color: theme.inputText,
    marginBottom: spacing.m,
  },
  modalSubmitButton: {
    backgroundColor: theme.primary,
    paddingVertical: spacing.m,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  modalSubmitButtonText: {
    ...typography.bodyStrong,
    color: theme.onPrimary,
  },
  modalCancelButton: {
    paddingVertical: spacing.m,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: theme.textSecondary,
  },
});

export default AuthScreen;
