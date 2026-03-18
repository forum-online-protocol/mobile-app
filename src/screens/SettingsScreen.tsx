import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletService } from '../services/WalletService';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import Icon from '../components/Icon';
import { useNavigation } from '../contexts/NavigationContext';
import { useLocalization } from '../hooks/useLocalization';
import { ROUTES } from '../navigation/routes';

const DEFAULT_RPCS = [
  { name: 'Sepolia (Alchemy)', url: 'https://eth-sepolia.g.alchemy.com/v2/MvkSiPYWc7yc9GBfE5OEVqSewnMDrWfK' },
  { name: 'Sepolia (PublicNode)', url: 'https://ethereum-sepolia.publicnode.com' },
  { name: 'Sepolia (Public RPC)', url: 'https://rpc.sepolia.org' },
];

const SettingsScreen = () => {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const { navigate } = useNavigation();
  const { t, currentLanguage, availableLanguages, changeLanguage } = useLocalization();
  const [customRPC, setCustomRPC] = useState('');
  const [currentRPC, setCurrentRPC] = useState('');
  const [testing, setTesting] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    loadCurrentRPC();
  }, []);

  const loadCurrentRPC = async () => {
    try {
      const savedRPC = await AsyncStorage.getItem('customRPC');
      if (savedRPC) {
        setCustomRPC(savedRPC);
        setCurrentRPC(savedRPC);
      } else {
        setCurrentRPC(DEFAULT_RPCS[0].url);
      }
      
      // Get current network info and offline status
      const walletService = WalletService.getInstance();
      const isOffline = walletService.isOfflineMode();
      setOfflineMode(isOffline);
      
      if (!isOffline) {
        try {
          const network = await walletService.getNetworkInfo();
          setNetworkInfo(network);
        } catch (error) {
          console.log(t('settings.failedToGetNetworkInfo'), error);
        }
      }
    } catch (error) {
      console.error(t('settings.errorLoadingRpc'), error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (rpcUrl: string) => {
    setTesting(true);
    try {
      const walletService = WalletService.getInstance();
      const result = await walletService.testRPCConnection(rpcUrl);
      
      if (result.success) {
        if (Platform.OS === 'web') {
          alert(
            `${t('settings.connectionSuccessful')}\n\n${t('settings.networkLabel')} ${result.network?.name || t('settings.unknown')}\n${t('settings.chainId')} ${result.network?.chainId || t('settings.unknown')}\n${t('settings.block')}: ${result.blockNumber || t('settings.unknown')}`
          );
        } else {
          Alert.alert(
            t('settings.connectionSuccessful'),
            `${t('settings.networkLabel')} ${result.network?.name || t('settings.unknown')}\n${t('settings.chainId')} ${result.network?.chainId || t('settings.unknown')}\n${t('settings.block')}: ${result.blockNumber || t('settings.unknown')}`,
            [{ text: t('common.ok') }]
          );
        }
        return true;
      } else {
        throw new Error(result.error || t('settings.connectionFailed'));
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(`${t('settings.connectionFailed')}: ${error.message}`);
      } else {
        Alert.alert(t('settings.connectionFailed'), error.message);
      }
      return false;
    } finally {
      setTesting(false);
    }
  };

  const saveCustomRPC = async () => {
    if (!customRPC.trim()) {
      if (Platform.OS === 'web') {
        alert(t('settings.enterRpcUrl'));
      } else {
        Alert.alert(t('common.error'), t('settings.enterRpcUrl'));
      }
      return;
    }

    // Test connection first
    const success = await testConnection(customRPC);
    if (success) {
      try {
        await AsyncStorage.setItem('customRPC', customRPC);
        const walletService = WalletService.getInstance();
        await walletService.changeRPCProvider(customRPC);
        setCurrentRPC(customRPC);
        
        // Refresh network info
        const network = await walletService.getNetworkInfo();
        setNetworkInfo(network);
        
        if (Platform.OS === 'web') {
          alert(t('settings.rpcSaved'));
        } else {
          Alert.alert(t('common.success'), t('settings.rpcSaved'));
        }
      } catch (error: any) {
        if (Platform.OS === 'web') {
          alert(`${t('settings.failedToSaveRpc')}: ${error.message}`);
        } else {
          Alert.alert(t('common.error'), `${t('settings.failedToSaveRpc')}: ${error.message}`);
        }
      }
    }
  };

  const selectDefaultRPC = async (rpcUrl: string) => {
    setCustomRPC(rpcUrl);
    const success = await testConnection(rpcUrl);
    if (success) {
      try {
        await AsyncStorage.setItem('customRPC', rpcUrl);
        const walletService = WalletService.getInstance();
        await walletService.changeRPCProvider(rpcUrl);
        setCurrentRPC(rpcUrl);
        
        // Refresh network info
        const network = await walletService.getNetworkInfo();
        setNetworkInfo(network);
      } catch (error) {
        console.error(t('settings.errorSettingRpc'), error);
      }
    }
  };

  const resetToDefault = async () => {
    try {
      await AsyncStorage.removeItem('customRPC');
      const defaultUrl = DEFAULT_RPCS[0].url;
      setCustomRPC('');
      setCurrentRPC(defaultUrl);
      
      const walletService = WalletService.getInstance();
      await walletService.changeRPCProvider(defaultUrl);
      
      // Refresh network info
      const network = await walletService.getNetworkInfo();
      setNetworkInfo(network);
      
      if (Platform.OS === 'web') {
        alert(t('settings.resetSuccess'));
      } else {
        Alert.alert(t('common.success'), t('settings.resetSuccess'));
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(`${t('settings.failedToReset')}: ${error.message}`);
      } else {
        Alert.alert(t('common.error'), `${t('settings.failedToReset')}: ${error.message}`);
      }
    }
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigate('Feed')}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Icon name="arrow-back" size={24} color={theme.text} variant="outline" />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>{t('settings.settings')}</Text>
          </View>

        {/* Theme Settings */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('settings.appearance')}</Text>
          
          <TouchableOpacity
            style={[styles.themeOption, themeMode === 'light' && styles.themeOptionActive, 
              { borderColor: themeMode === 'light' ? theme.primary : theme.border }]}
            onPress={() => handleThemeModeChange('light')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.lightMode')}
          >
            <View style={styles.themeOptionContent}>
              <Icon name="bulb" size={20} color={themeMode === 'light' ? theme.primary : theme.textSecondary} variant={themeMode === 'light' ? 'filled' : 'outline'} />
              <Text style={[styles.themeOptionText, { color: theme.text }]}>{t('settings.lightMode')}</Text>
            </View>
            {themeMode === 'light' && <Text style={{fontSize: 18, color: theme.primary}}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.themeOption, themeMode === 'dark' && styles.themeOptionActive,
              { borderColor: themeMode === 'dark' ? theme.primary : theme.border }]}
            onPress={() => handleThemeModeChange('dark')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.darkMode')}
          >
            <View style={styles.themeOptionContent}>
              <Icon name="moon" size={20} color={themeMode === 'dark' ? theme.primary : theme.textSecondary} variant={themeMode === 'dark' ? 'filled' : 'outline'} />
              <Text style={[styles.themeOptionText, { color: theme.text }]}>{t('settings.darkMode')}</Text>
            </View>
            {themeMode === 'dark' && <Text style={{fontSize: 18, color: theme.primary}}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.themeOption, themeMode === 'system' && styles.themeOptionActive,
              { borderColor: themeMode === 'system' ? theme.primary : theme.border }]}
            onPress={() => handleThemeModeChange('system')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.systemDefault')}
          >
            <View style={styles.themeOptionContent}>
              <Icon name="settings" size={20} color={themeMode === 'system' ? theme.primary : theme.textSecondary} variant={themeMode === 'system' ? 'filled' : 'outline'} />
              <Text style={[styles.themeOptionText, { color: theme.text }]}>{t('settings.systemDefault')}</Text>
            </View>
            {themeMode === 'system' && <Text style={{fontSize: 18, color: theme.primary}}>✓</Text>}
          </TouchableOpacity>
        </View>

        {/* Language Settings */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('settings.language')}</Text>
          
          {Object.entries(availableLanguages).map(([code, name]) => (
            <TouchableOpacity
              key={code}
              style={[styles.themeOption, currentLanguage === code && styles.themeOptionActive, 
                { borderColor: currentLanguage === code ? theme.primary : theme.border }]}
              onPress={() => changeLanguage(code)}
              accessibilityRole="button"
              accessibilityLabel={name}
            >
              <View style={styles.themeOptionContent}>
                <Icon name="language" size={20} color={currentLanguage === code ? theme.primary : theme.textSecondary} variant={currentLanguage === code ? 'filled' : 'outline'} />
                <Text style={[styles.themeOptionText, { color: theme.text }]}>{name}</Text>
              </View>
              {currentLanguage === code && <Text style={{fontSize: 18, color: theme.primary}}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Transparency */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('settings.transparency')}</Text>
          <TouchableOpacity
            style={[styles.linkRow, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={() => navigate(ROUTES.TRANSACTION_LOG)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.transactionLog')}
          >
            <View style={styles.linkRowLeft}>
              <Icon name="receipt" size={20} color={theme.textSecondary} variant="outline" />
              <Text style={[styles.linkRowText, { color: theme.text }]}>{t('settings.transactionLog')}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={theme.textTertiary} variant="outline" />
          </TouchableOpacity>
        </View>

        {/* Offline Mode Warning */}
        {offlineMode && (
          <View style={[styles.section, styles.offlineWarning, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
            <View style={styles.offlineIconContainer}>
              <Icon name="warning" size={20} color={theme.warning} variant="filled" />
              <Text style={[styles.offlineTitle, { color: theme.warning, marginLeft: 8 }]}>{t('settings.offlineMode')}</Text>
            </View>
            <Text style={[styles.offlineText, { color: theme.warning }]}>
              {t('settings.offlineDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.reconnectButton, { backgroundColor: theme.warning }]}
              onPress={async () => {
                const walletService = WalletService.getInstance();
                const success = await walletService.reconnect();
                if (success) {
                  setOfflineMode(false);
                  loadCurrentRPC();
                  Alert.alert(t('common.success'), t('settings.reconnected'));
                } else {
                  Alert.alert(t('settings.connectionFailed'), t('settings.couldNotReconnect'));
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={t('settings.tryReconnect')}
            >
              <Text style={[styles.reconnectButtonText, { color: theme.onPrimary }]}>{t('settings.tryReconnect')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Current Network Info */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('settings.network')}</Text>
          <View style={styles.infoBox}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('settings.status')}</Text>
            <Text style={[styles.infoValue, { color: offlineMode ? theme.warning : theme.success }]}>
              {offlineMode ? t('settings.offline') : t('settings.connected')}
            </Text>
          </View>
          <View style={[styles.infoBox, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('settings.networkLabel')}</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{offlineMode ? t('settings.mockNetwork') : (networkInfo?.name || t('settings.unknown'))}</Text>
          </View>
          <View style={[styles.infoBox, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('settings.chainId')}</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{offlineMode ? '1337' : (networkInfo?.chainId || t('settings.unknown'))}</Text>
          </View>
          <View style={[styles.infoBox, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('settings.currentRpc')}</Text>
            <Text style={[styles.infoValueSmall, { color: theme.text }]} numberOfLines={1}>
              {offlineMode ? t('settings.offlineMode') : currentRPC}
            </Text>
          </View>
        </View>

        {/* Default RPC Options */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('settings.quickSelect')}</Text>
          {DEFAULT_RPCS.map((rpc, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.rpcOption,
                currentRPC === rpc.url && styles.rpcOptionActive,
                { 
                  backgroundColor: theme.card,
                  borderColor: currentRPC === rpc.url ? theme.primary : theme.border
                }
              ]}
              onPress={() => selectDefaultRPC(rpc.url)}
              accessibilityRole="button"
              accessibilityLabel={rpc.name}
            >
              <Text style={[
                styles.rpcOptionText,
                { color: currentRPC === rpc.url ? theme.primary : theme.text }
              ]}>
                {rpc.name}
              </Text>
              {currentRPC === rpc.url && (
                <Text style={{fontSize: 18, color: theme.primary}}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom RPC */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{t('settings.customRpcUrl')}</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.inputBackground,
              borderColor: theme.inputBorder,
              color: theme.inputText
            }]}
            placeholder="https://your-rpc-url.com"
            placeholderTextColor={theme.placeholder}
            value={customRPC}
            onChangeText={setCustomRPC}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.testButton, { backgroundColor: theme.card }]}
              onPress={() => testConnection(customRPC)}
              disabled={testing || !customRPC.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('settings.testConnection')}
            >
              {testing ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.buttonText, { color: theme.text }]}>{t('settings.testConnection')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={saveCustomRPC}
              disabled={testing || !customRPC.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('settings.saveRpc')}
            >
              <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{t('settings.saveRpc')}</Text>
            </TouchableOpacity>
          </View>
        </View>



        {/* Reset Button */}
        <TouchableOpacity
          style={[styles.button, styles.resetButton, { backgroundColor: theme.error }]}
          onPress={resetToDefault}
          accessibilityRole="button"
          accessibilityLabel={t('settings.resetToDefault')}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{t('settings.resetToDefault')}</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: 1,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeOptionActive: {
    borderWidth: 2,
  },
  themeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkRow: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkRowText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
  },
  infoValue: {
    flex: 2,
    fontSize: 14,
    fontWeight: '500',
  },
  infoValueSmall: {
    flex: 2,
    fontSize: 12,
  },
  rpcOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  rpcOptionActive: {
    borderWidth: 2,
  },
  rpcOptionText: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    fontSize: 14,
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButton: {},
  saveButton: {},
  resetButton: {
    width: '100%',
    marginTop: 20,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  offlineWarning: {
    borderWidth: 1,
  },
  offlineIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  offlineText: {
    fontSize: 14,
    marginBottom: 16,
  },
  reconnectButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reconnectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SettingsScreen;
