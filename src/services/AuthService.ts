import { ethers } from 'ethers';
import ApiService from './ApiService';
import { WalletService } from './WalletService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { buildRegistrationIntent } from '../utils/registrationIntent';

interface AuthResult {
  success: boolean;
  user?: {
    address: string;
    nickname: string;
    isVerified: boolean;
  };
  wallet?: ethers.Wallet | ethers.HDNodeWallet;
  error?: string;
  registrationDeferred?: boolean;
}

class AuthService {
  private static instance: AuthService;
  private apiService: ApiService;
  private walletService: WalletService;

  private constructor() {
    this.apiService = ApiService.getInstance();
    this.walletService = WalletService.getInstance();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Authenticate with passport data
   */
  async authenticateWithPassport(
    passportData: any,
    nickname: string
  ): Promise<AuthResult> {
    try {
      // Generate wallet from passport
      const wallet = await this.walletService.generateWalletFromPassport(passportData);
      
      if (!wallet) {
        return {
          success: false,
          error: 'Failed to generate wallet from passport',
        };
      }

      // Initialize API service with wallet
      await this.apiService.initialize(wallet);

      const registrationIntent = buildRegistrationIntent(
        passportData,
        nickname,
        wallet.address
      );
      const resolvedNickname = registrationIntent.nickname;

      await this.apiService.setRegistrationIntent(registrationIntent);
      void this.apiService.ensureRegistration({
        reason: 'passport-sign-in',
        background: true,
      });

      // Save auth data
      if (Platform.OS !== 'web') {
        await AsyncStorage.setItem('userAddress', wallet.address);
        await AsyncStorage.setItem('nickname', resolvedNickname);
      }

      let userProfile = {
        address: wallet.address,
        nickname: resolvedNickname,
        isVerified: true,
      };

      try {
        const profileResponse = await this.apiService.getUserProfile(wallet.address);
        if (profileResponse.success && profileResponse.data) {
          userProfile = profileResponse.data;
        }
      } catch (profileError) {
        console.warn('Profile fetch skipped during optimistic passport login:', profileError);
      }

      const optimisticDisplayName = [
        String(passportData?.firstName || '').trim(),
        String(passportData?.lastName || '').trim(),
      ]
        .filter(Boolean)
        .join('_')
        .trim();
      await this.apiService.primeCurrentProfileCache(
        {
          profile: {
            ...userProfile,
            username: String((userProfile as any)?.username || resolvedNickname)
              .trim()
              .replace(/^@+/, '')
              .toLowerCase(),
            displayName:
              String((userProfile as any)?.displayName || optimisticDisplayName)
                .trim() || resolvedNickname,
            source: (userProfile as any)?.source || 'optimistic-cache',
          },
        },
        { address: wallet.address }
      );

      return {
        success: true,
        user: userProfile,
        wallet: wallet as any,
        registrationDeferred: true,
      };
    } catch (error: any) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed',
      };
    }
  }

  /**
   * Authenticate with demo mode
   */
  async authenticateDemo(nickname: string): Promise<AuthResult> {
    try {
      // Generate random wallet for demo
      const wallet = ethers.Wallet.createRandom();
      
      // Initialize API service with wallet
      await this.apiService.initialize(wallet);

      // Register demo user
      const registerResponse = await this.apiService.register(nickname, '');
      
      if (!registerResponse.success) {
        // For demo, return success anyway with mock data
        return {
          success: true,
          user: {
            address: wallet.address,
            nickname,
            isVerified: false,
          },
          wallet: wallet as any,
        };
      }

      return {
        success: true,
        user: registerResponse.data,
        wallet: wallet as any,
      };
    } catch (error: any) {
      console.error('Demo authentication error:', error);
      
      // For demo, always return success with mock data
      const wallet = ethers.Wallet.createRandom();
      return {
        success: true,
        user: {
          address: wallet.address,
          nickname,
          isVerified: false,
        },
        wallet: wallet as any,
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuthStatus(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return false; // Web always starts unauthenticated
      }

      const userAddress = await AsyncStorage.getItem('userAddress');
      return !!userAddress;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return false;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Clear API auth
      await this.apiService.clearAuth();
      
      // Clear stored data
      if (Platform.OS !== 'web') {
        await AsyncStorage.multiRemove([
          'userAddress',
          'nickname',
          'authToken',
          'wallet',
        ]);
      }
      
      // Clear wallet service
      this.walletService.clearWallet();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  /**
   * Get stored user data
   */
  async getStoredUserData(): Promise<{
    address?: string;
    nickname?: string;
  } | null> {
    try {
      if (Platform.OS === 'web') {
        return null;
      }

      const userAddress = await AsyncStorage.getItem('userAddress');
      const nickname = await AsyncStorage.getItem('nickname');

      if (!userAddress) {
        return null;
      }

      return {
        address: userAddress,
        nickname: nickname || 'Anonymous',
      };
    } catch (error) {
      console.error('Error getting stored user data:', error);
      return null;
    }
  }
}

export default AuthService;
export type { AuthResult };
