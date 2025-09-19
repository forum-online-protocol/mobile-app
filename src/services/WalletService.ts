import { Wallet } from 'ethers';

export class WalletService {
  private static _instance: WalletService | null = null;
  // Use `any` for wallet to avoid tight coupling with ethers v6 types in this dev shim
  private wallet: any = null;

  private constructor() {}

  public static getInstance(): WalletService {
    if (!WalletService._instance) {
      WalletService._instance = new WalletService();
    }
    return WalletService._instance;
  }

  // Initialize any providers or persistent storage if needed
  async initialize(): Promise<void> {
    // No-op for now; can be extended to read persisted keys
    return;
  }

  getCurrentWallet(): { address: string } | null {
    if (!this.wallet) return null;
    return { address: this.wallet.address };
  }

  async generateWalletFromPassport(_passportData: any): Promise<{ address: string; privateKey: string }> {
    // For development, generate a random wallet using ethers
    this.wallet = Wallet.createRandom();
    return { address: this.wallet.address, privateKey: this.wallet.privateKey };
  }

  async getEthersWallet(): Promise<any | null> {
    return this.wallet;
  }

  async signTypedData(_domain: any, _types: any, value: any): Promise<string> {
    if (!this.wallet) throw new Error('No wallet available for signing');
    // Fallback: produce a signature by signing the JSON payload as a string
    const message = typeof value === 'string' ? value : JSON.stringify(value);
    return this.wallet.signMessage(message);
  }

  async getBalance(): Promise<string> {
    // Return dummy balance for development
    return '0';
  }

  async sendTransaction(_to: string, _amount: string): Promise<string> {
    // Return a dummy tx hash for development
    return '0x' + '0'.repeat(64);
  }

  async getPrivateKey(): Promise<string | null> {
    return this.wallet ? (this.wallet.privateKey || null) : null;
  }

  clearWallet(): void {
    this.wallet = null;
  }
}

export default WalletService.getInstance();
