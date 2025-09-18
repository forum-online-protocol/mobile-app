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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletService } from '../services/WalletService';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import Icon from '../components/Icon';
import { useNavigation } from '../contexts/NavigationContext';
import { useLocalization } from '../hooks/useLocalization';

const DEFAULT_RPCS = [
  { name: 'Sepolia (Infura)', url: 'https://sepolia.infura.io/v3/ce8318f6376d40fa80cec4d02a4e7be7' },
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
          console.log('Failed to get network info:', error);
        }
      }
    } catch (error) {
      console.error('Error loading RPC:', error);
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
          alert(`✅ Connection successful!\n\nNetwork: ${result.network?.name || 'Unknown'}\nChain ID: ${result.network?.chainId || 'Unknown'}\nBlock: ${result.blockNumber || 'Unknown'}`);
        } else {
          Alert.alert(
            'Connection Successful',
            `Network: ${result.network?.name || 'Unknown'}\nChain ID: ${result.network?.chainId || 'Unknown'}\nBlock: ${result.blockNumber || 'Unknown'}`,
            [{ text: 'OK' }]
          );
        }
        return true;
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(`❌ Connection failed: ${error.message}`);
      } else {
        Alert.alert('Connection Failed', error.message);
      }
      return false;
    } finally {
      setTesting(false);
    }
  };

  const saveCustomRPC = async () => {
    if (!customRPC.trim()) {
      if (Platform.OS === 'web') {
        alert('Please enter an RPC URL');
      } else {
        Alert.alert('Error', 'Please enter an RPC URL');
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
          alert('✅ RPC saved successfully!');
        } else {
          Alert.alert('Success', 'RPC saved successfully!');
        }
      } catch (error: any) {
        if (Platform.OS === 'web') {
          alert(`Failed to save RPC: ${error.message}`);
        } else {
          Alert.alert('Error', `Failed to save RPC: ${error.message}`);
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
        console.error('Error setting RPC:', error);
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
        alert('✅ Reset to default RPC');
      } else {
        Alert.alert('Success', 'Reset to default RPC');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(`Failed to reset: ${error.message}`);
      } else {
        Alert.alert('Error', `Failed to reset: ${error.message}`);
      }
    }
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigate('Feed')} style={styles.backButton}>
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
            >
              <View style={styles.themeOptionContent}>
                <Icon name="language" size={20} color={currentLanguage === code ? theme.primary : theme.textSecondary} variant={currentLanguage === code ? 'filled' : 'outline'} />
                <Text style={[styles.themeOptionText, { color: theme.text }]}>{name}</Text>
              </View>
              {currentLanguage === code && <Text style={{fontSize: 18, color: theme.primary}}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Offline Mode Warning */}
        {offlineMode && (
          <View style={[styles.section, styles.offlineWarning, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
            <View style={styles.offlineIconContainer}>
              <Icon name="warning" size={20} color={theme.warning} variant="filled" />
              <Text style={[styles.offlineTitle, { color: theme.warning, marginLeft: 8 }]}>OFFLINE MODE</Text>
            </View>
            <Text style={[styles.offlineText, { color: theme.warning }]}>
              Network connection failed. Using mock data for development.
            </Text>
            <TouchableOpacity
              style={[styles.reconnectButton, { backgroundColor: theme.warning }]}
              onPress={async () => {
                const walletService = WalletService.getInstance();
                const success = await walletService.reconnect();
                if (success) {
                  setOfflineMode(false);
                  loadCurrentRPC();
                  Alert.alert('Success', 'Reconnected to network');
                } else {
                  Alert.alert('Failed', 'Could not connect to network. Check your internet connection.');
                }
              }}
            >
              <Text style={styles.reconnectButtonText}>Try Reconnect</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Current Network Info */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>NETWORK</Text>
          <View style={styles.infoBox}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Status:</Text>
            <Text style={[styles.infoValue, { color: offlineMode ? theme.warning : theme.success }]}>
              {offlineMode ? 'Offline' : 'Connected'}
            </Text>
          </View>
          <View style={[styles.infoBox, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Network:</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{offlineMode ? 'Mock Network' : (networkInfo?.name || 'Unknown')}</Text>
          </View>
          <View style={[styles.infoBox, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Chain ID:</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{offlineMode ? '1337' : (networkInfo?.chainId || 'Unknown')}</Text>
          </View>
          <View style={[styles.infoBox, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Current RPC:</Text>
            <Text style={[styles.infoValueSmall, { color: theme.text }]} numberOfLines={1}>
              {offlineMode ? 'Offline Mode' : currentRPC}
            </Text>
          </View>
        </View>

        {/* Default RPC Options */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>QUICK SELECT</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CUSTOM RPC URL</Text>
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
            >
              {testing ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.buttonText, { color: theme.text }]}>Test Connection</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={saveCustomRPC}
              disabled={testing || !customRPC.trim()}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>Save RPC</Text>
            </TouchableOpacity>
          </View>
        </View>



        {/* Reset Button */}
        <TouchableOpacity
          style={[styles.button, styles.resetButton, { backgroundColor: theme.error }]}
          onPress={resetToDefault}
        >
          <Text style={[styles.buttonText, { color: '#fff' }]}>Reset to Default</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SettingsScreen;