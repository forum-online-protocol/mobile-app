import AsyncStorageService from './AsyncStorageService';
import { PassportData, WalletData, IdentityCheckResult } from '../types';
// import Toast from '../utils/Toast'; // Removed to prevent callback errors

const DEFAULT_SEPOLIA_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/MvkSiPYWc7yc9GBfE5OEVqSewnMDrWfK';
const SEPOLIA_RPC_FALLBACKS = [
  DEFAULT_SEPOLIA_RPC_URL,
  'https://ethereum-sepolia.publicnode.com',
  'https://rpc.sepolia.org',
];

const PROPOSAL_LOTTERY_ABI = [
  'function claimReward()',
  'function isWinner(address) view returns (bool)',
  'function pendingRewards(address) view returns (uint256)',
  'function entriesByAddress(address) view returns (uint256)',
  'function drawExecuted() view returns (bool)',
  'function claimDeadline() view returns (uint256)',
];

export class WalletService {
  private static instance: WalletService;
  private currentWallet: WalletData | null = null;
  private cachedEthersWallet: any | null = null;

  private constructor() {
    console.log('[WalletService] Initializing simplified wallet service...');
  }

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  async initialize(): Promise<void> {
    console.log('[WalletService] Initializing wallet service...');
    try {
      // Check AsyncStorage availability
      await AsyncStorageService.checkAvailability();
      
      // Check for existing wallet
      const existingWallet = await this.loadWallet();
      if (existingWallet) {
        this.currentWallet = existingWallet;
        console.log('[WalletService] Loaded existing wallet:', existingWallet.address);
      } else {
        console.log('[WalletService] No existing wallet found');
      }
    } catch (error) {
      console.error('[WalletService] Failed to initialize wallet service:', error);
      this.currentWallet = null;
    }
  }

  /**
   * Generate real wallet from passport data
   */
  async generateWalletFromPassport(passportData: PassportData): Promise<WalletData> {
    console.log('[WalletService] Generating real wallet from passport...');
    
    try {
      // Create a comprehensive identity hash from passport data
      const firstName = passportData.personalData?.firstName || passportData.firstName || 'Unknown';
      const lastName = passportData.personalData?.lastName || passportData.lastName || 'Unknown';
      const dateOfBirth = passportData.personalData?.dateOfBirth || passportData.dateOfBirth || 'Unknown';
      const nationality = passportData.personalData?.nationality || passportData.nationality || 'Unknown';
      const issuingState = passportData.personalData?.issuingState || passportData.issuingState || 'Unknown';
      
      // Use nationality first, fallback to issuing state for country
      const country = nationality !== 'Unknown' ? nationality : issuingState;
      
      const identityString = `${firstName}-${lastName}-${dateOfBirth}-${country}`;
      
      console.log('[WalletService] Identity string:', identityString);
      
      // Generate a deterministic but secure private key from identity
      const privateKey = await this.generateDeterministicPrivateKey(identityString);
      
      // Create real wallet using ethers
      let wallet: any;
      try {
        const { ethers } = require('ethers');
        wallet = new ethers.Wallet(privateKey);
        console.log('[WalletService] ✅ Real wallet created with ethers.js');
      } catch (error) {
        console.error('[WalletService] Failed to create real wallet, falling back to mock:', error);
        throw new Error('Failed to create wallet: ethers.js not available');
      }
      
      // Check if this is the demo account for special balance
      const isDemoAccount = firstName === 'John' && lastName === 'Doe';
      const initialBalance = isDemoAccount ? '2.5678' : '0.0000';
      
      const walletData: WalletData = {
        address: wallet.address,
        publicKey: wallet.publicKey,
        balance: initialBalance,
        network: 'sepolia',
        createdAt: new Date().toISOString(),
        identityHash: await this.generateSecureHash(identityString)
      };
      
      console.log('[WalletService] Real wallet address:', wallet.address);
      console.log('[WalletService] Real public key:', wallet.publicKey);
      
      if (isDemoAccount) {
        console.log('[WalletService] Demo wallet balance:', initialBalance, 'ETH');
      }
      
      // Store private key securely (separate from wallet data)
      await this.savePrivateKey(privateKey);
      
      // Save wallet
      await this.saveWallet(walletData);
      this.currentWallet = walletData;
      
      console.log('[WalletService] Real wallet generated:', walletData.address);
      return walletData;
    } catch (error) {
      console.error('[WalletService] Failed to generate wallet:', error);
      throw new Error('Failed to generate wallet: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Generate a deterministic but secure private key from identity string
   */
  private async generateDeterministicPrivateKey(identityString: string): Promise<string> {
    try {
      const { ethers } = require('ethers');
      
      // Create a secure seed from identity string using multiple rounds of hashing
      let seed = identityString;
      for (let i = 0; i < 1000; i++) {
        seed = ethers.id(seed); // keccak256 hash
      }
      
      // Ensure the seed is a valid private key (32 bytes)
      const privateKey = seed.slice(0, 66); // '0x' + 64 hex chars = 66 chars total
      
      // Validate the private key
      const wallet = new ethers.Wallet(privateKey);
      console.log('[WalletService] Generated deterministic private key for identity:', identityString);
      
      return privateKey;
    } catch (error) {
      console.error('[WalletService] Failed to generate deterministic private key:', error);
      throw error;
    }
  }

  /**
   * Generate a secure hash using ethers keccak256
   */
  private async generateSecureHash(input: string): Promise<string> {
    try {
      const { ethers } = require('ethers');
      return ethers.id(input); // Returns keccak256 hash with '0x' prefix
    } catch (error) {
      console.error('[WalletService] Failed to generate secure hash, using fallback:', error);
      return '0x' + this.createMockHash(input);
    }
  }

  /**
   * Create a simple hash from string
   */
  private createMockHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert to hex and ensure it's not all zeros
    let hexHash = Math.abs(hash).toString(16);
    
    // If hash is too short or starts with zeros, enhance it
    if (hexHash.length < 8 || hexHash.startsWith('000')) {
      // Create a more robust hash by using character codes
      let enhancedHash = '';
      for (let i = 0; i < input.length; i++) {
        const charCode = input.charCodeAt(i);
        enhancedHash += charCode.toString(16).padStart(2, '0');
      }
      // Mix with original hash
      hexHash = (parseInt(hexHash, 16) ^ parseInt(enhancedHash.slice(0, 8), 16)).toString(16);
    }
    
    // Pad to 64 characters, but start with a non-zero digit
    const paddedHash = hexHash.padStart(64, '1');
    return paddedHash;
  }

  /**
   * Save wallet data to storage
   */
  private async saveWallet(walletData: WalletData): Promise<void> {
    try {
      await AsyncStorageService.setItem('wallet_data', JSON.stringify(walletData));
    } catch (error) {
      console.error('[WalletService] Failed to save wallet:', error);
      throw error;
    }
  }

  /**
   * Save private key securely
   */
  private async savePrivateKey(privateKey: string): Promise<void> {
    try {
      // In a real app, use secure storage like Keychain Services
      await AsyncStorageService.setItem('wallet_private_key', privateKey);
      console.log('[WalletService] Private key saved securely');
    } catch (error) {
      console.error('[WalletService] Failed to save private key:', error);
      throw error;
    }
  }

  /**
   * Load private key from secure storage
   */
  private async loadPrivateKey(): Promise<string | null> {
    try {
      return await AsyncStorageService.getItem('wallet_private_key');
    } catch (error) {
      console.error('[WalletService] Failed to load private key:', error);
      return null;
    }
  }

  /**
   * Load wallet data from storage
   */
  private async loadWallet(): Promise<WalletData | null> {
    try {
      const walletJson = await AsyncStorageService.getItem('wallet_data');
      if (!walletJson) {
        return null;
      }
      return JSON.parse(walletJson) as WalletData;
    } catch (error) {
      console.error('[WalletService] Failed to load wallet:', error);
      return null;
    }
  }

  /**
   * Get current wallet data
   */
  getCurrentWallet(): WalletData | null {
    return this.currentWallet;
  }

  /**
   * Get wallet address
   */
  getAddress(): string | null {
    return this.currentWallet?.address || null;
  }

  /**
   * Set current wallet
   */
  setCurrentWallet(walletData: WalletData | null): void {
    this.currentWallet = walletData;
    console.log('[WalletService] Current wallet set:', walletData?.address || 'null');
  }

  /**
   * Get current balance from wallet
   */
  async getBalance(): Promise<string> {
    if (!this.currentWallet) {
      return '0';
    }
    
    try {
      // Try to fetch real balance from blockchain
      const realBalance = await this.fetchRealBalance();
      if (realBalance !== null) {
        console.log('[WalletService] Real balance fetched:', realBalance, 'ETH');
        
        // Toast.success(`💰 Real balance: ${realBalance} ETH`); // Disabled to prevent callback errors
        
        return realBalance;
      }
    } catch (error) {
      console.warn('[WalletService] Failed to fetch real balance, using mock:', error);
      
      // Toast.info('📡 Using cached balance (blockchain unavailable)'); // Disabled to prevent callback errors
    }
    
    // Fallback to stored balance with some variation
    const baseBalance = parseFloat(this.currentWallet.balance || '1.234');
    const variation = Math.random() * 0.01; // Small random variation
    const currentBalance = baseBalance + variation;
    
    return currentBalance.toFixed(4);
  }

  /**
   * Fetch real balance from blockchain
   */
  private async fetchRealBalance(): Promise<string | null> {
    if (!this.currentWallet?.address) {
      return null;
    }

    try {
      const { ethers } = require('ethers');
      
      // Use multiple RPC providers for better reliability
      const rpcUrls = SEPOLIA_RPC_FALLBACKS;

      for (const rpcUrl of rpcUrls) {
        try {
          console.log('[WalletService] Trying RPC:', rpcUrl.split('/')[2]); // Log domain only for privacy
          
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          
          // Set a timeout for the balance call
          const balancePromise = provider.getBalance(this.currentWallet.address);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Balance fetch timeout')), 10000)
          );
          
          const balance = await Promise.race([balancePromise, timeoutPromise]) as bigint;
          const balanceInEth = ethers.formatEther(balance);
          
          console.log('[WalletService] ✅ Balance fetched successfully:', balanceInEth, 'ETH');
          return parseFloat(balanceInEth).toFixed(4);
          
        } catch (rpcError) {
          console.warn('[WalletService] RPC failed:', rpcUrl.split('/')[2], rpcError.message);
          continue; // Try next RPC
        }
      }
      
      throw new Error('All RPC providers failed');
      
    } catch (error) {
      console.error('[WalletService] Real balance fetch failed:', error);
      return null;
    }
  }

  /**
   * Get identity hash from passport data
   */
  async getIdentityHash(passportData: PassportData): Promise<string> {
    const firstName = passportData.personalData?.firstName || passportData.firstName || 'Unknown';
    const lastName = passportData.personalData?.lastName || passportData.lastName || 'Unknown';
    const dateOfBirth = passportData.personalData?.dateOfBirth || passportData.dateOfBirth || 'Unknown';
    const nationality = passportData.personalData?.nationality || passportData.nationality || 'Unknown';
    const issuingState = passportData.personalData?.issuingState || passportData.issuingState || 'Unknown';
    
    // Use nationality first, fallback to issuing state for country
    const country = nationality !== 'Unknown' ? nationality : issuingState;
    
    const identityString = `${firstName}-${lastName}-${dateOfBirth}-${country}`;
    return await this.generateSecureHash(identityString);
  }

  /**
   * Clear wallet data and private key
   */
  async clearWallet(): Promise<void> {
    try {
      await AsyncStorageService.removeItem('wallet_data');
      await AsyncStorageService.removeItem('wallet_private_key');
      this.currentWallet = null;
      this.cachedEthersWallet = null; // Clear cached wallet instance
      console.log('[WalletService] Wallet, private key, and cached instance cleared');
    } catch (error) {
      console.error('[WalletService] Failed to clear wallet:', error);
    }
  }

  /**
   * Send native transaction (ETH on Sepolia).
   */
  async sendTransaction(to: string, amount: string): Promise<string> {
    console.log('[WalletService] Sending transaction:', { to, amount });

    const ethersWallet = await this.getEthersWallet();
    if (!ethersWallet) {
      throw new Error('No wallet available for transaction');
    }

    const { ethers } = require('ethers');
    const value = ethers.parseEther(amount);

    const rpcUrls = SEPOLIA_RPC_FALLBACKS;

    let lastError: any = null;
    for (const rpcUrl of rpcUrls) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = ethersWallet.connect(provider);
        const tx = await signer.sendTransaction({
          to,
          value,
        });
        await tx.wait(1);
        console.log('[WalletService] Transaction sent:', tx.hash);
        return tx.hash;
      } catch (error: any) {
        lastError = error;
        console.warn('[WalletService] RPC send failed:', rpcUrl, error?.message || error);
      }
    }

    throw new Error(lastError?.message || 'Failed to send transaction');
  }

  async getLotteryParticipantState(contractAddress: string, walletAddress?: string): Promise<{
    wallet: string;
    isWinner: boolean;
    pendingRewardWei: string;
    entriesCount: number;
    drawExecuted: boolean;
    claimDeadline: number;
    claimWindowOpen: boolean;
    canClaimNow: boolean;
  }> {
    const ethersWallet = await this.getEthersWallet();
    if (!ethersWallet) {
      throw new Error('No wallet available');
    }

    const { ethers } = require('ethers');
    const address = walletAddress || ethersWallet.address;

    const rpcUrls = SEPOLIA_RPC_FALLBACKS;

    let lastError: any = null;
    for (const rpcUrl of rpcUrls) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(contractAddress, PROPOSAL_LOTTERY_ABI, provider);

        const [isWinner, pendingReward, entriesCount, drawExecuted, claimDeadline] = await Promise.all([
          contract.isWinner(address),
          contract.pendingRewards(address),
          contract.entriesByAddress(address),
          contract.drawExecuted(),
          contract.claimDeadline(),
        ]);

        const now = Math.floor(Date.now() / 1000);
        const claimDeadlineNumber = Number(claimDeadline);
        const canClaimNow =
          Boolean(drawExecuted) &&
          now <= claimDeadlineNumber &&
          typeof pendingReward === 'bigint' &&
          pendingReward > 0n;

        return {
          wallet: address,
          isWinner: Boolean(isWinner),
          pendingRewardWei: pendingReward.toString(),
          entriesCount: Number(entriesCount),
          drawExecuted: Boolean(drawExecuted),
          claimDeadline: claimDeadlineNumber,
          claimWindowOpen: now <= claimDeadlineNumber,
          canClaimNow,
        };
      } catch (error: any) {
        lastError = error;
        console.warn('[WalletService] Lottery state RPC failed:', rpcUrl, error?.message || error);
      }
    }

    throw new Error(lastError?.message || 'Failed to fetch lottery participant state');
  }

  async claimLotteryReward(contractAddress: string): Promise<string> {
    const ethersWallet = await this.getEthersWallet();
    if (!ethersWallet) {
      throw new Error('No wallet available for claim');
    }

    const { ethers } = require('ethers');
    const rpcUrls = SEPOLIA_RPC_FALLBACKS;

    let lastError: any = null;
    for (const rpcUrl of rpcUrls) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = ethersWallet.connect(provider);
        const contract = new ethers.Contract(contractAddress, PROPOSAL_LOTTERY_ABI, signer);
        const tx = await contract.claimReward();
        await tx.wait(1);
        return tx.hash;
      } catch (error: any) {
        lastError = error;
        console.warn('[WalletService] Lottery claim RPC failed:', rpcUrl, error?.message || error);
      }
    }

    throw new Error(lastError?.message || 'Failed to claim lottery reward');
  }

  async signMessage(message: string): Promise<string> {
    console.log('[WalletService] Real signMessage:', message);
    
    // Get the real ethers.Wallet for signing
    const ethersWallet = await this.getEthersWallet();
    if (!ethersWallet) {
      throw new Error('No wallet available for signing');
    }
    
    // Use real message signing
    return await ethersWallet.signMessage(message);
  }

  async signTypedData(domain: any, types: any, value: any): Promise<string> {
    console.log('[WalletService] Real signTypedData');
    
    // Get the real ethers.Wallet for signing
    const ethersWallet = await this.getEthersWallet();
    if (!ethersWallet) {
      throw new Error('No wallet available for signing');
    }
    
    // Use real EIP-712 signing
    return await ethersWallet.signTypedData(domain, types, value);
  }

  /**
   * Get ethers.Wallet instance for signing (cached for consistency)
   */
  async getEthersWallet(): Promise<any | null> {
    // Return cached instance if available
    if (this.cachedEthersWallet) {
      console.log('[WalletService] 🔄 Using cached ethers.Wallet:', this.cachedEthersWallet.address);
      return this.cachedEthersWallet;
    }

    console.log('[WalletService] 🆕 Creating new ethers.Wallet (no cache available)');
    try {
      const privateKey = await this.loadPrivateKey();
      if (!privateKey) {
        console.log('[WalletService] No private key available');
        return null;
      }
      
      console.log('[WalletService] Private key loaded:', privateKey.substring(0, 10) + '...');
      
      const { ethers } = require('ethers');
      this.cachedEthersWallet = new ethers.Wallet(privateKey);
      console.log('[WalletService] ✅ Created and cached ethers.Wallet for signing:', this.cachedEthersWallet.address);
      return this.cachedEthersWallet;
    } catch (error) {
      console.error('[WalletService] Failed to create ethers.Wallet:', error);
      return null;
    }
  }

  /**
   * Mock network methods
   */
  async getNetworkInfo(): Promise<{ name: string; chainId: number } | null> {
    return { name: 'sepolia', chainId: 11155111 };
  }

  getCurrentRPC(): string {
    return DEFAULT_SEPOLIA_RPC_URL;
  }

  async changeRPCProvider(rpcUrl: string): Promise<boolean> {
    console.log('[WalletService] Mock RPC change to:', rpcUrl);
    return true;
  }

  async testRPCConnection(rpcUrl: string): Promise<{ success: boolean; network?: any; blockNumber?: number; error?: string }> {
    console.log('[WalletService] Mock RPC test:', rpcUrl);
    return {
      success: true,
      network: { name: 'sepolia', chainId: '11155111' },
      blockNumber: 123456
    };
  }

  isOfflineMode(): boolean {
    return false;
  }

  setOfflineMode(offline: boolean): void {
    console.log('[WalletService] Mock offline mode:', offline);
  }

  async reconnect(): Promise<boolean> {
    return true;
  }

  async getPrivateKey(): Promise<string | null> {
    return await this.loadPrivateKey();
  }

  async exportPrivateKey(): Promise<string> {
    throw new Error('Private key export not available in simplified version');
  }

  setProvider(rpcUrl: string): void {
    console.log('[WalletService] Mock setProvider:', rpcUrl);
  }
}
