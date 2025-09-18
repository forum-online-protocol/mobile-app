import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {setAuthenticated, setPassportData, setWallet} from '../store/authSlice';
import { fetchFeed } from '../store/socialSlice';
import { WalletService } from '../services/WalletService';
import { NFCService } from '../services/NFCService';
import { useNavigation } from '../contexts/NavigationContext';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
// import MRZScannerModal from '../components/MRZScannerModal'; // Disabled: MRZ scanner temporarily turned off
import NFCStatusCheck from '../components/NFCStatusCheck';
import LanguageSelector from '../components/LanguageSelector';
import { isMRZScannerSupported, getMRZUnavailableReason } from '../utils/deviceDetection';

const {width, height} = Dimensions.get('window');

const AuthScreen: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [isScanning, setIsScanning] = useState(false);
  const [showMRZScanner, setShowMRZScanner] = useState(false);
  const [showNFCCheck, setShowNFCCheck] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<any>(null);
  
  // Auto-login as guest on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Auto-login as guest after a brief delay
      setTimeout(async () => {
        dispatch(setAuthenticated(true));
        console.log('🎯 DEMO MODE: John Doe authenticated and navigating to Feed');
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
      
      // Generate wallet from passport data
      try {
        const walletService = WalletService.getInstance();
        const walletData = await walletService.generateWalletFromPassport(passportData);
        dispatch(setWallet(walletData));
        console.log('[AuthScreen] Wallet created:', walletData.address);
      } catch (walletError) {
        console.error('[AuthScreen] Failed to generate wallet:', walletError);
      }
      
      setIsScanning(false);
      dispatch(setAuthenticated(true));
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
    dispatch(setAuthenticated(true));
    // Guest user - no passport data
    // Refetch feed after authentication
    await dispatch(fetchFeed({} as any) as any);
    console.log('[AuthScreen] Feed refetched after guest authentication');
    navigation.navigate('Feed');
  };

  // Show loading for web auto-login
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.loadingBg]}>
        <StatusBar barStyle="light-content" backgroundColor="#1D9BF0" />
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
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
            style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>{t('auth.continueAsGuest')}</Text>
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
            <TouchableOpacity>
              <Text style={styles.linkText}>{t('auth.privacyPolicy')}</Text>
            </TouchableOpacity>
            <Text style={styles.linkDot}>·</Text>
            <TouchableOpacity>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  languageSelectorContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 1000,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: Platform.OS === 'web' ? '10%' : 32,
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
    backgroundColor: '#FFFFFF',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
    marginTop: 12,
  },
  logoTextLarge: {
    fontSize: 60,
    fontWeight: '800',
    color: '#17559e',
    marginBottom: 20,
    marginTop: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '400',
    opacity: 0.9,
  },
  loadingBg: {
    backgroundColor: '#1D9BF0',
  },
  logoWrapper: {
    marginBottom: 20,
  },
  tagline: {
    fontSize: 15,
    color: '#536471',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  authSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 31,
    fontWeight: '700',
    color: '#17559e',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  primaryButton: {
    backgroundColor: '#000000',
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 9999,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 9999,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CFD9DE',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1419',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EFF3F4',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#536471',
    fontSize: 15,
    fontWeight: '400',
  },
  outlineButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 9999,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#CFD9DE',
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D9BF0',
  },
  infoContainer: {
    backgroundColor: '#F7F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EFF3F4',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1419',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#536471',
    lineHeight: 20,
  },
  helpLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    fontSize: 15,
    color: '#1D9BF0',
    fontWeight: '400',
  },
  linkDot: {
    marginHorizontal: 12,
    color: '#536471',
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
    backgroundColor: '#FFA500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  comingSoonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

export default AuthScreen;