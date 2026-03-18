import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PassportData, WalletData } from '../types';

export type SessionType = 'guest' | 'signed' | 'verified';

interface AuthState {
  isAuthenticated: boolean;
  sessionType: SessionType;
  passportData: PassportData | null;
  wallet: WalletData | null;
  biometricEnabled: boolean;
  sessionExpiry: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  sessionType: 'guest',
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
      if (!action.payload) {
        state.sessionType = 'guest';
        return;
      }

      if (state.passportData) {
        state.sessionType = 'verified';
      } else if (state.wallet) {
        state.sessionType = 'signed';
      } else {
        state.sessionType = 'signed';
      }
    },
    setSessionType: (state, action: PayloadAction<SessionType>) => {
      state.sessionType = action.payload;
      state.isAuthenticated = action.payload !== 'guest';
    },
    setPassportData: (state, action: PayloadAction<PassportData>) => {
      state.passportData = action.payload;
      state.isAuthenticated = true;
      state.sessionType = 'verified';
    },
    setWallet: (state, action: PayloadAction<WalletData>) => {
      state.wallet = action.payload;
      state.isAuthenticated = true;
      if (!state.passportData) {
        state.sessionType = 'signed';
      }
    },
    setBiometricEnabled: (state, action: PayloadAction<boolean>) => {
      state.biometricEnabled = action.payload;
    },
    setSessionExpiry: (state, action: PayloadAction<string>) => {
      state.sessionExpiry = action.payload;
    },
    setGuestSession: (state) => {
      state.isAuthenticated = false;
      state.sessionType = 'guest';
      state.passportData = null;
      state.wallet = null;
      state.sessionExpiry = null;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.sessionType = 'guest';
      state.passportData = null;
      state.wallet = null;
      state.sessionExpiry = null;
    },
  },
});

export const {
  setAuthenticated,
  setSessionType,
  setPassportData,
  setWallet,
  setBiometricEnabled,
  setSessionExpiry,
  setGuestSession,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
