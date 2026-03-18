import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ApiService, { PublicTransactionLogItem } from '../services/ApiService';
import { useNavigation } from '../contexts/NavigationContext';
import { useLocalization } from '../hooks/useLocalization';
import { useTheme } from '../contexts/ThemeContext';
import Icon from '../components/Icon';
import ScreenState from '../components/ui/ScreenState';
import Toast from '../utils/Toast';

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const shortHash = (value?: string) => {
  const v = String(value || '').trim();
  if (!v) return '-';
  if (v.length <= 16) return v;
  return `${v.slice(0, 8)}...${v.slice(-6)}`;
};

const statusPillStyle = (status: string, theme: ReturnType<typeof useTheme>['theme']) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'success') {
    return { backgroundColor: theme.success + '22', color: theme.success };
  }
  if (normalized === 'failed') {
    return { backgroundColor: theme.error + '22', color: theme.error };
  }
  return { backgroundColor: theme.primary + '1f', color: theme.primary };
};

const TransactionLogScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [items, setItems] = useState<PublicTransactionLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');

  const loadLog = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const apiService = ApiService.getInstance();
        const response = await apiService.getPublicTransactionLog({
          limit: 120,
          includeDerived: true,
          status: statusFilter || undefined,
          action: actionFilter.trim() || undefined,
        });

        if (!response.success) {
          throw new Error(response.error || t('txLog.loadFailed'));
        }

        setItems(response.data?.items || []);
      } catch (error) {
        Toast.error(error instanceof Error ? error.message : t('txLog.loadFailed'));
        setItems([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [actionFilter, statusFilter, t]
  );

  React.useEffect(() => {
    loadLog(false);
  }, [loadLog]);

  const openUrl = async (url?: string | null) => {
    const value = String(url || '').trim();
    if (!value) return;
    try {
      await Linking.openURL(value);
    } catch {
      Toast.error(t('txLog.openLinkFailed'));
    }
  };

  const copyValue = async (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return;
    try {
      await Clipboard.setString(raw);
      Toast.success(t('txLog.copied'));
    } catch {
      Toast.error(t('txLog.copyFailed'));
    }
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.stateWrap}>
          <ScreenState type="loading" title={t('txLog.loading')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Icon name="arrow-back" size={22} color={theme.text} variant="outline" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('txLog.title')}</Text>
        <TouchableOpacity onPress={() => loadLog(true)} style={styles.headerButton} disabled={isRefreshing}>
          {isRefreshing ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Icon name="refresh" size={20} color={theme.text} variant="outline" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.filtersWrap}>
        <View style={styles.statusRow}>
          {[
            { key: '', label: t('txLog.statusAll') },
            { key: 'success', label: t('txLog.statusSuccess') },
            { key: 'failed', label: t('txLog.statusFailed') },
            { key: 'info', label: t('txLog.statusInfo') },
          ].map((status) => (
            <TouchableOpacity
              key={status.key || 'all'}
              style={[
                styles.statusChip,
                statusFilter === status.key && styles.statusChipActive,
              ]}
              onPress={() => handleStatusFilter(status.key)}
            >
              <Text
                style={[
                  styles.statusChipText,
                  statusFilter === status.key && styles.statusChipTextActive,
                ]}
              >
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionFilterRow}>
          <TextInput
            style={styles.actionInput}
            value={actionFilter}
            onChangeText={setActionFilter}
            placeholder={t('txLog.actionFilterPlaceholder')}
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => loadLog(true)}
          />
          <TouchableOpacity style={styles.filterButton} onPress={() => loadLog(true)}>
            <Icon name="search" size={16} color={theme.onPrimary} variant="filled" />
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.stateWrap}>
          <ScreenState type="empty" title={t('txLog.empty')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.map((entry) => {
            const pill = statusPillStyle(entry.status, theme);
            return (
              <View key={entry.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.actionText}>{entry.action}</Text>
                  <View style={[styles.statusPill, { backgroundColor: pill.backgroundColor }]}>
                    <Text style={[styles.statusPillText, { color: pill.color }]}>
                      {String(entry.status || 'info').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.metaText}>
                  {formatDateTime(entry.timestamp)} · {entry.source} · {entry.actor || '-'}
                </Text>
                <Text style={styles.entityText}>
                  {(entry.entityType || '-') + ': ' + (entry.entityId || '-')}
                </Text>

                {entry.txHash ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{t('txLog.tx')}:</Text>
                    <TouchableOpacity
                      style={styles.valueButton}
                      onPress={() => (entry.explorerTxUrl ? openUrl(entry.explorerTxUrl) : copyValue(entry.txHash))}
                    >
                      <Text style={styles.valueText}>{shortHash(entry.txHash)}</Text>
                      <Icon
                        name={entry.explorerTxUrl ? 'link' : 'copy'}
                        size={13}
                        color={theme.textSecondary}
                        variant="outline"
                      />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {entry.contractAddress ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{t('txLog.contract')}:</Text>
                    <TouchableOpacity
                      style={styles.valueButton}
                      onPress={() =>
                        entry.explorerAddressUrl
                          ? openUrl(entry.explorerAddressUrl)
                          : copyValue(entry.contractAddress)
                      }
                    >
                      <Text style={styles.valueText}>{shortHash(entry.contractAddress)}</Text>
                      <Icon
                        name={entry.explorerAddressUrl ? 'link' : 'copy'}
                        size={13}
                        color={theme.textSecondary}
                        variant="outline"
                      />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      height: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.headerBackground,
    },
    headerButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    filtersWrap: {
      paddingHorizontal: 14,
      paddingTop: 12,
      gap: 10,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statusChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusChipActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '1a',
    },
    statusChipText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    statusChipTextActive: {
      color: theme.primary,
    },
    actionFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionInput: {
      flex: 1,
      height: 40,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      color: theme.text,
      backgroundColor: theme.surface,
      fontSize: 14,
    },
    filterButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
    },
    content: {
      padding: 14,
      paddingBottom: 88,
      gap: 10,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.card,
      padding: 12,
      gap: 6,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    actionText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    metaText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    entityText: {
      fontSize: 12,
      color: theme.textTertiary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rowLabel: {
      width: 68,
      fontSize: 12,
      color: theme.textSecondary,
    },
    valueButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    valueText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '600',
    },
    stateWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
  });

export default TransactionLogScreen;
