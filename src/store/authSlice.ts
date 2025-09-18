import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PassportData, WalletData } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  passportData: PassportData | null;
  wallet: WalletData | null;
  biometricEnabled: boolean;
  sessionExpiry: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  passportData: null,
  wallet: null,
  biometricEnabled: false,
  sessionExpiry: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload;
    },
    setPassportData: (state, action: PayloadAction<PassportData>) => {
      state.passportData = action.payload;
      state.isAuthenticated = true;
    },
    setWallet: (state, action: PayloadAction<WalletData>) => {
      state.wallet = action.payload;
    },
    setBiometricEnabled: (state, action: PayloadAction<boolean>) => {
      state.biometricEnabled = action.payload;
    },
    setSessionExpiry: (state, action: PayloadAction<string>) => {
      state.sessionExpiry = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.passportData = null;
      state.wallet = null;
      state.sessionExpiry = null;
    },
  },
});

export const {
  setAuthenticated,
  setPassportData,
  setWallet,
  setBiometricEnabled,
  setSessionExpiry,
  logout,
} = authSlice.actions;

export default authSlice.reducer;