// Temporary mock for BiometricService
export class BiometricService {
  private static instance: BiometricService;
  private isAvailable: boolean = false;
  private biometryType: string | null = null;

  private constructor() {
    // Mock initialization
  }

  static getInstance(): BiometricService {
    if (!BiometricService.instance) {
      BiometricService.instance = new BiometricService();
    }
    return BiometricService.instance;
  }

  async checkAvailability(): Promise<boolean> {
    console.log('Biometric availability (mock):', false);
    return false;
  }

  async createKeys(): Promise<boolean> {
    console.log('Creating biometric keys (mock)');
    return true;
  }

  async deleteKeys(): Promise<boolean> {
    console.log('Deleting biometric keys (mock)');
    return true;
  }

  async authenticate(reason: string): Promise<boolean> {
    console.log('Biometric authentication (mock):', reason);
    // Mock successful authentication
    return true;
  }

  async enrollBiometric(): Promise<boolean> {
    console.log('Enrolling biometric (mock)');
    return true;
  }

  getBiometryType(): string {
    return 'None';
  }

  getIsAvailable(): boolean {
    return false;
  }

  async saveBiometricCredentials(data: any): Promise<boolean> {
    console.log('Saving biometric credentials (mock)');
    return true;
  }

  async loadBiometricCredentials(): Promise<any> {
    console.log('Loading biometric credentials (mock)');
    return null;
  }
}