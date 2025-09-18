import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Transaction } from '../types';

interface WalletState {
  balance: string;
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  gasPrice: string;
  network: string;
}

const initialState: WalletState = {
  balance: '0',
  transactions: [],
  pendingTransactions: [],
  gasPrice: '0',
  network: 'mainnet',
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setBalance: (state, action: PayloadAction<string>) => {
      state.balance = action.payload;
    },
    addTransaction: (state, action: PayloadAction<Transaction>) => {
      state.transactions.unshift(action.payload);
    },
    setPendingTransaction: (state, action: PayloadAction<Transaction>) => {
      state.pendingTransactions.push(action.payload);
    },
    confirmTransaction: (state, action: PayloadAction<string>) => {
      const index = state.pendingTransactions.findIndex(tx => tx.hash === action.payload);
      if (index !== -1) {
        const tx = state.pendingTransactions[index];
        tx.status = 'confirmed';
        state.transactions.unshift(tx);
        state.pendingTransactions.splice(index, 1);
      }
    },
    setGasPrice: (state, action: PayloadAction<string>) => {
      state.gasPrice = action.payload;
    },
    setNetwork: (state, action: PayloadAction<string>) => {
      state.network = action.payload;
    },
    clearTransactions: (state) => {
      state.transactions = [];
      state.pendingTransactions = [];
    },
    resetWalletState: (state) => {
      state.balance = '0';
      state.transactions = [];
      state.pendingTransactions = [];
      state.gasPrice = '0';
      state.network = 'mainnet';
    },
  },
});

export const {
  setBalance,
  addTransaction,
  setPendingTransaction,
  confirmTransaction,
  setGasPrice,
  setNetwork,
  clearTransactions,
  resetWalletState,
} = walletSlice.actions;

export default walletSlice.reducer;