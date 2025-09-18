import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Platform,
  Clipboard,
  Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from '../components/Icon';
import { RootState } from '../store';
import { useNavigation } from '../contexts/NavigationContext';
import { WalletService } from '../services/WalletService';
import Toast from '../utils/Toast';
import { useLocalization } from '../hooks/useLocalization';

const WalletScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLocalization();
  const wallet = useSelector((state: RootState) => state.auth.wallet);
  const walletService = WalletService.getInstance();
  
  const [balance, setBalance] = useState('0.0000');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, [wallet]);

  const loadWalletData = async () => {
    setIsLoading(true);
    try {
      console.log('[WalletScreen] 🔄 Fetching real blockchain balance...');
      
      // Fetch actual balance from wallet service (now fetches from blockchain)
      const currentBalance = await walletService.getBalance();
      setBalance(currentBalance);
      
      // Don't show mock transactions - will be empty until real transactions are implemented
      setTransactions([]);
      
      console.log('[WalletScreen] ✅ Balance updated:', currentBalance, 'ETH');
    } catch (error) {
      console.error('[WalletScreen] ❌ Error loading wallet data:', error);
      setBalance('0.0000');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = () => {
    loadWalletData();
  };

  const copyToClipboard = async () => {
    if (wallet?.address) {
      try {
        await Clipboard.setString(wallet.address);
        Toast.success(t('wallet.addressCopied'));
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        Toast.error(t('wallet.copyFailed'));
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('wallet.wallet')}</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('wallet.totalBalance')}</Text>
          <Text style={styles.balanceAmount}>{balance} ETH</Text>
          
        </View>

        {/* Address Card */}
        {wallet && (
          <View style={styles.addressCard}>
            <Text style={styles.sectionTitle}>{t('wallet.walletAddress')}</Text>
            <View style={styles.addressRow}>
              <Text style={styles.address}>
                {wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'No address'}
              </Text>
              <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                <Icon name="copy" variant="outline" size={20} color="#8B98A5" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Transactions */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>{t('wallet.recentTransactions')}</Text>
          
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t('wallet.noTransactions')}</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.transactionItem}>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionType}>{tx.type}</Text>
                  <Text style={styles.transactionTime}>
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  { color: tx.type === 'Send' ? '#EF4444' : '#10B981' }
                ]}>
                  {tx.amount} ETH
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  balanceCard: {
    margin: 20,
    padding: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#8B98A5',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  balanceUsd: {
    fontSize: 16,
    color: '#8B98A5',
    marginBottom: 24,
  },
  addressCard: {
    margin: 20,
    marginTop: 0,
    padding: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  address: {
    fontSize: 16,
    color: '#8B98A5',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  copyButton: {
    padding: 8,
    marginLeft: 12,
  },
  transactionsSection: {
    margin: 20,
    marginTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 14,
    color: '#8B98A5',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WalletScreen;
