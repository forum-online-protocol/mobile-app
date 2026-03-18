import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Clipboard,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from '../components/Icon';
import { RootState } from '../store';
import { WalletService } from '../services/WalletService';
import Toast from '../utils/Toast';
import { useLocalization } from '../hooks/useLocalization';
import { useTheme } from '../contexts/ThemeContext';
import { hairlineWidth, monoFontFamily, radii, spacing, typography } from '../styles/tokens';

const WalletScreen: React.FC = () => {
  const { t } = useLocalization();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
      const currentBalance = await walletService.getBalance();
      setBalance(currentBalance);
      setTransactions([]);
    } catch (error) {
      console.error('[WalletScreen] Failed to load wallet:', error);
      setBalance('0.0000');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = () => {
    loadWalletData();
  };

  const copyToClipboard = async () => {
    if (!wallet?.address) return;

    try {
      await Clipboard.setString(wallet.address);
      Toast.success(t('wallet.addressCopied'));
    } catch {
      Alert.alert(t('wallet.addressFallbackTitle'), wallet.address);
    }
  };

  const shortAddress = wallet?.address
    ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`
    : t('wallet.noWallet');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('wallet.wallet')}</Text>
          <Text style={styles.subtitle}>{t('wallet.subtitle')}</Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('wallet.totalBalance')}</Text>
          <Text style={styles.balanceValue}>{balance} ETH</Text>
        </View>

        {wallet ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('wallet.walletAddress')}</Text>
            <View style={styles.addressRow}>
              <Text style={styles.addressText}>{shortAddress}</Text>
              <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                <Icon name="copy" variant="outline" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('wallet.recentTransactions')}</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Icon name="receipt" size={18} color={theme.textTertiary} variant="outline" />
              <Text style={styles.emptyText}>{t('wallet.noTransactions')}</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txMeta}>
                  <Text style={styles.txType}>{tx.type}</Text>
                  <Text style={styles.txDate}>{new Date(tx.timestamp).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.type === 'Send' ? theme.error : theme.success }]}>{tx.amount} ETH</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
    paddingBottom: 112,
  },
  header: {
    marginBottom: spacing.l,
  },
  title: {
    ...typography.title,
    color: theme.text,
  },
  subtitle: {
    ...typography.body,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  balanceCard: {
    borderRadius: radii.l,
    backgroundColor: theme.primary,
    padding: spacing.xxl,
    marginBottom: spacing.l,
  },
  balanceLabel: {
    ...typography.caption,
    color: theme.primaryLight,
    marginBottom: spacing.xs,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '800',
    color: theme.onPrimary,
  },
  card: {
    borderRadius: radii.l,
    borderWidth: hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.card,
    padding: spacing.l,
    marginBottom: spacing.l,
  },
  cardTitle: {
    ...typography.bodyStrong,
    color: theme.text,
    marginBottom: spacing.m,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressText: {
    ...typography.body,
    color: theme.textSecondary,
    fontFamily: monoFontFamily,
    flex: 1,
  },
  copyButton: {
    marginLeft: spacing.s,
    height: 32,
    width: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    borderTopWidth: hairlineWidth,
    borderTopColor: theme.divider,
    paddingTop: spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body,
    color: theme.textSecondary,
    marginTop: spacing.s,
  },
  txRow: {
    borderTopWidth: hairlineWidth,
    borderTopColor: theme.divider,
    paddingTop: spacing.m,
    marginTop: spacing.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txMeta: {
    flex: 1,
  },
  txType: {
    ...typography.bodyStrong,
    color: theme.text,
  },
  txDate: {
    ...typography.caption,
    color: theme.textSecondary,
    marginTop: 2,
  },
  txAmount: {
    ...typography.bodyStrong,
  },
});

export default WalletScreen;
