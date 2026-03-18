import { PassportData, WalletData } from "../types";
import AsyncStorageService from "./AsyncStorageService";

/**
 * Demo Service - Provides realistic demo data for Apple App Store reviewers
 * and users who want to test the app without a physical NFC passport.
 *
 * Demo mode features:
 * - Full access to all screens and features
 * - No API requests sent (offline mode)
 * - Option to generate new key or use existing private key
 */
export class DemoService {
  private static instance: DemoService;
  private _isDemoMode: boolean = false;

  private constructor() {
    console.log("[DemoService] Initializing demo service...");
  }

  static getInstance(): DemoService {
    if (!DemoService.instance) {
      DemoService.instance = new DemoService();
    }
    return DemoService.instance;
  }

  /**
   * Check if demo mode is currently active (sync check)
   */
  get isDemoModeActive(): boolean {
    return this._isDemoMode;
  }

  /**
   * Generate realistic demo passport data
   * This simulates what would be read from an NFC passport chip
   */
  generateDemoPassportData(): PassportData {
    const now = new Date();
    const birthDate = new Date("1990-01-15");
    const expiryDate = new Date(now.getFullYear() + 5, 6, 20); // Expires in 5 years

    const passportData: PassportData = {
      // Document info
      documentType: "P", // Passport
      issuingCountry: "USA",
      documentNumber: "DEMO123456",
      nationality: "USA",
      dateOfBirth: this.formatDate(birthDate),
      sex: "M",
      gender: "Male",
      dateOfExpiry: this.formatDate(expiryDate),
      personalNumber: "",

      // Personal info
      firstName: "Demo",
      lastName: "User",

      // MRZ (Machine Readable Zone)
      mrz:
        "P<USAUSER<<DEMO<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nDEMO1234560USA9001158M" +
        this.formatDateMRZ(expiryDate) +
        "<<<<<<<<<<<<<<00",

      // Check digits (simulated)
      checkDigits: {
        documentNumber: "0",
        dateOfBirth: "8",
        dateOfExpiry: "4",
      },

      // Data groups (simulated - these would come from NFC chip)
      dataGroups: {
        COM: { version: "1.0", tags: ["DG1", "DG2"] },
        DG1: {
          mrz:
            "P<USAUSER<<DEMO<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nDEMO1234560USA9001158M" +
            this.formatDateMRZ(expiryDate) +
            "<<<<<<<<<<<<<<00",
        },
        DG2: {
          // Face image would be here in real passport
          faceImageAvailable: true,
        },
        DG14: {
          // Active Authentication public key (simulated)
          publicKeyAlgorithm: "RSA",
        },
        SOD: {
          // Security Object (simulated)
          signatureValid: true,
          hashAlgorithm: "SHA-256",
        },
        signatureAlgorithm: "SHA256withRSA",
        dscSignature: "0x" + "a".repeat(64), // Simulated signature
        publicKey: "0x04" + "b".repeat(128), // Simulated public key
        eContent: "0x" + "c".repeat(64),
        encryptedDigest: "0x" + "d".repeat(64),
      },
    };

    console.log("[DemoService] Generated demo passport data:", {
      name: `${passportData.firstName} ${passportData.lastName}`,
      nationality: passportData.nationality,
      documentNumber: passportData.documentNumber,
    });

    return passportData;
  }

  /**
   * Generate a random private key compatible with React Native
   * Uses multiple entropy sources since crypto.getRandomValues is not available
   */
  private generateRandomPrivateKey(): string {
    // Generate random bytes using multiple entropy sources
    const timestamp = Date.now().toString(16);
    const random1 = Math.random().toString(16).slice(2);
    const random2 = Math.random().toString(16).slice(2);
    const random3 = Math.random().toString(16).slice(2);
    const random4 = Math.random().toString(16).slice(2);
    const performanceNow = (
      typeof performance !== "undefined" ? performance.now() : Date.now()
    ).toString(16);

    // Combine all entropy sources
    const entropy = `${timestamp}${random1}${random2}${random3}${random4}${performanceNow}`;

    // Use ethers to hash it into a valid private key
    const { ethers } = require("ethers");
    const hash = ethers.keccak256(ethers.toUtf8Bytes(entropy));

    console.log("[DemoService] Generated random private key from entropy");
    return hash;
  }

  /**
   * Activate demo mode with a newly generated wallet
   */
  async activateDemoModeWithNewKey(): Promise<{
    passportData: PassportData;
    wallet: WalletData;
  }> {
    console.log("[DemoService] Activating demo mode with new key...");

    try {
      const { ethers } = require("ethers");

      // Generate a random private key (React Native compatible)
      const privateKey = this.generateRandomPrivateKey();

      // Create wallet from the private key
      const randomWallet = new ethers.Wallet(privateKey);
      console.log("[DemoService] Generated new wallet:", randomWallet.address);

      // Create wallet data
      const wallet = await this.createWalletFromEthersWallet(randomWallet);

      // Generate demo passport data
      const passportData = this.generateDemoPassportData();
      (passportData as any).isDemoAccount = true;

      // Store everything
      await this.storeAndActivate(passportData, wallet, privateKey);

      return { passportData, wallet };
    } catch (error) {
      console.error(
        "[DemoService] Failed to activate demo mode with new key:",
        error,
      );
      throw error;
    }
  }

  /**
   * Activate demo mode with user-provided private key
   */
  async activateDemoModeWithPrivateKey(
    privateKey: string,
  ): Promise<{ passportData: PassportData; wallet: WalletData }> {
    console.log(
      "[DemoService] Activating demo mode with provided private key...",
    );

    try {
      const { ethers } = require("ethers");

      // Normalize private key (add 0x prefix if missing)
      let normalizedKey = privateKey.trim();
      if (!normalizedKey.startsWith("0x")) {
        normalizedKey = "0x" + normalizedKey;
      }

      // Validate and create wallet from private key
      const ethersWallet = new ethers.Wallet(normalizedKey);
      console.log(
        "[DemoService] Wallet from private key:",
        ethersWallet.address,
      );

      // Create wallet data
      const wallet = await this.createWalletFromEthersWallet(ethersWallet);

      // Generate demo passport data
      const passportData = this.generateDemoPassportData();
      (passportData as any).isDemoAccount = true;

      // Store everything
      await this.storeAndActivate(passportData, wallet, normalizedKey);

      return { passportData, wallet };
    } catch (error) {
      console.error(
        "[DemoService] Failed to activate demo mode with private key:",
        error,
      );
      throw error;
    }
  }

  /**
   * Create WalletData from ethers.Wallet instance
   */
  private async createWalletFromEthersWallet(
    ethersWallet: any,
  ): Promise<WalletData> {
    const wallet: WalletData = {
      address: ethersWallet.address,
      publicKey: ethersWallet.publicKey,
      balance: "0.0000", // Will show real balance if connected
      network: "sepolia",
      createdAt: new Date().toISOString(),
      identityHash: "0x" + "demo".repeat(16), // Demo identity hash
    };
    return wallet;
  }

  /**
   * Store data and activate demo mode
   */
  private async storeAndActivate(
    passportData: PassportData,
    wallet: WalletData,
    privateKey: string,
  ): Promise<void> {
    // Store passport data
    await AsyncStorageService.setItem(
      "passport_data",
      JSON.stringify(passportData),
    );
    console.log("[DemoService] Demo passport data stored");

    // Store wallet data
    await AsyncStorageService.setItem("wallet_data", JSON.stringify(wallet));
    console.log("[DemoService] Wallet data stored");

    // Store private key
    await AsyncStorageService.setItem("wallet_private_key", privateKey);
    console.log("[DemoService] Private key stored");

    // Mark demo mode as active
    await AsyncStorageService.setItem("demo_mode", "true");
    this._isDemoMode = true;

    console.log("[DemoService] Demo mode activated successfully!");
    console.log(
      "[DemoService] Demo User:",
      `${passportData.firstName} ${passportData.lastName}`,
    );
    console.log("[DemoService] Wallet Address:", wallet.address);
  }

  /**
   * Legacy method - activate demo mode (defaults to new key generation)
   */
  async activateDemoMode(): Promise<{
    passportData: PassportData;
    wallet: WalletData;
  }> {
    return this.activateDemoModeWithNewKey();
  }

  /**
   * Check if currently in demo mode (async - checks storage)
   */
  async isDemoMode(): Promise<boolean> {
    try {
      const demoMode = await AsyncStorageService.getItem("demo_mode");
      this._isDemoMode = demoMode === "true";
      return this._isDemoMode;
    } catch (error) {
      console.error("[DemoService] Error checking demo mode:", error);
      return false;
    }
  }

  /**
   * Initialize demo mode state from storage (call on app start)
   */
  async initialize(): Promise<void> {
    try {
      const demoMode = await AsyncStorageService.getItem("demo_mode");
      this._isDemoMode = demoMode === "true";
      console.log("[DemoService] Initialized, demo mode:", this._isDemoMode);
    } catch (error) {
      console.error("[DemoService] Error initializing demo mode:", error);
      this._isDemoMode = false;
    }
  }

  /**
   * Deactivate demo mode - clears all demo data
   */
  async deactivateDemoMode(): Promise<void> {
    console.log("[DemoService] Deactivating demo mode...");

    try {
      await AsyncStorageService.removeItem("passport_data");
      await AsyncStorageService.removeItem("wallet_data");
      await AsyncStorageService.removeItem("wallet_private_key");
      await AsyncStorageService.removeItem("demo_mode");

      this._isDemoMode = false;

      console.log("[DemoService] Demo mode deactivated");
    } catch (error) {
      console.error("[DemoService] Failed to deactivate demo mode:", error);
      throw error;
    }
  }

  /**
   * Format date for passport data (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  /**
   * Format date for MRZ (YYMMDD)
   */
  private formatDateMRZ(date: Date): string {
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}${month}${day}`;
  }

  /**
   * Get demo mode info for display
   */
  getDemoInfo(): { title: string; description: string; features: string[] } {
    return {
      title: "Demo Mode",
      description:
        "Experience Forum without a physical passport. All features are fully functional.",
      features: [
        "View and interact with initiatives",
        "Cast anonymous votes",
        "Access wallet features",
        "Create initiatives",
        "Explore the democracy platform",
      ],
    };
  }
}

export default DemoService;
