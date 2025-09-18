import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import Icon from '../components/Icon';

interface WalletScreenProps {
  navigation?: any;
}

const WalletScreen: React.FC<WalletScreenProps> = ({ navigation }) => {
  const wallet = useSelector((state: RootState) => state.auth.wallet);
  const [balance] = useState('0.125');
  const [refreshing, setRefreshing] = useState(false);

  const transactions = [
    {
      id: '1',
      type: 'received',
      amount: '0.05',
      from: 'Democracy Vote Reward',
      timestamp: '2 hours ago'
    },
    {
      id: '2', 
      type: 'sent',
      amount: '0.02',
      to: 'Forum Tip',
      timestamp: '1 day ago'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>ETH Balance</Text>
          <Text style={styles.balanceAmount}>{balance} ETH</Text>
          <Text style={styles.balanceUsd}>≈ $245.50 USD</Text>
          
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrText}>📱</Text>
            <Text style={styles.qrLabel}>Wallet Address QR</Text>
            <Text style={styles.addressText}>0x742d...a8f3</Text>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="arrow-up-right" size={20} color="#1D9BF0" variant="outline" />
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="arrow-down-left" size={20} color="#00BA7C" variant="outline" />
            <Text style={styles.actionText}>Receive</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="ballot" size={20} color="#FF6B35" variant="outline" />
            <Text style={styles.actionText}>Vote</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsCard}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          
          {transactions.map((tx) => (
            <View key={tx.id} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <Icon name={tx.type === 'received' ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={tx.type === 'received' ? '#00BA7C' : '#1D9BF0'} variant="outline" />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>
                  {tx.type === 'received' ? tx.from : `To ${tx.to}`}
                </Text>
                <Text style={styles.transactionTime}>{tx.timestamp}</Text>
              </View>
              <Text style={[
                styles.transactionAmount,
                tx.type === 'received' ? styles.received : styles.sent
              ]}>
                {tx.type === 'received' ? '+' : '-'}{tx.amount} ETH
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      
      <Text style={styles.webNote}>Web version - Full wallet features available on mobile</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  balanceCard: {
    backgroundColor: '#4F46E5',
    margin: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  balanceUsd: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 18,
    marginBottom: 24,
  },
  qrPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  qrText: {
    fontSize: 48,
    marginBottom: 8,
  },
  qrLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  actionsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 24,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  transactionsCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  received: {
    color: '#10B981',
  },
  sent: {
    color: '#EF4444',
  },
  webNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 16,
  },
});

export default WalletScreen;
