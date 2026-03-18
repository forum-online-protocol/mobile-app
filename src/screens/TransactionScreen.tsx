import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { WalletService } from '../services/WalletService';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../hooks/useLocalization';

const TransactionScreen: React.FC = () => {
  const walletService = WalletService.getInstance();
  const { theme } = useTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  const handleSend = async () => {
    try {
      const txHash = await walletService.sendTransaction(recipient, amount);
      console.log('Navigate back');
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => console.log('Navigate back')}
          accessibilityRole="button"
          accessibilityLabel={t('transaction.closeA11y')}
        >
          <Text style={{fontSize: 24}}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('transaction.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={t('transaction.recipientPlaceholder')}
          value={recipient}
          onChangeText={setRecipient}
        />
        
        <TextInput
          style={styles.input}
          placeholder={t('transaction.amountPlaceholder')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>{t('transaction.sendButton')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '600', color: theme.text },
  form: { padding: 16 },
  input: {
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: theme.inputText,
    backgroundColor: theme.inputBackground,
  },
  sendButton: { backgroundColor: theme.primary, padding: 16, borderRadius: 8, alignItems: 'center' },
  sendButtonText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600' },
});

export default TransactionScreen;
