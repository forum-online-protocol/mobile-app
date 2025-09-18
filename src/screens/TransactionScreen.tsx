import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { WalletService } from '../services/WalletService';

const TransactionScreen: React.FC = () => {
  const walletService = WalletService.getInstance();
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
        <TouchableOpacity onPress={() => console.log('Navigate back')}>
          <Text style={{fontSize: 24}}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Send ETH</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Recipient Address"
          value={recipient}
          onChangeText={setRecipient}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Amount (ETH)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  form: { padding: 16 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 16 },
  sendButton: { backgroundColor: '#4F46E5', padding: 16, borderRadius: 8, alignItems: 'center' },
  sendButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default TransactionScreen;