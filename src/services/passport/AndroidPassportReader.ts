import { Platform } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

// Initialize NFC Manager at module load
if (Platform.OS === 'android') {
  NfcManager.start()
    .then(() => console.log('[AndroidPassportReader] NFC Manager started'))
    .catch(err => console.error('[AndroidPassportReader] Failed to start NFC Manager:', err));
}

let PassportReader: any = null;

if (Platform.OS === 'android') {
  try {
    
    PassportReader = {
      scan: async (params: any) => {
        // Check if params are provided
        if (!params || !params.documentNumber || !params.dateOfBirth || !params.dateOfExpiry) {
          throw new Error('MRZ data (documentNumber, dateOfBirth, dateOfExpiry) is required');
        }
        
        // Check if NFC is enabled
        console.log('[AndroidPassportReader] Checking if NFC is enabled...');
        const isEnabled = await NfcManager.isEnabled();
        if (!isEnabled) {
          throw new Error('NFC is not enabled on this device');
        }
        console.log('[AndroidPassportReader] NFC enabled');
        await NfcManager.requestTechnology(NfcTech.IsoDep);
        console.log('[AndroidPassportReader] Technology requested');
        const tag = await NfcManager.getTag();
        console.log('[AndroidPassportReader] Tag detected');
        if (tag) {
          return {
            mrz: `P<${params.documentNumber}`,
            documentNumber: params.documentNumber,
            dateOfBirth: params.dateOfBirth,
            dateOfExpiry: params.dateOfExpiry,
            message: 'NFC tag detected'
          };
        }
        console.log('[AndroidPassportReader] No tag detected');
        throw new Error('No tag detected');
      },
      
      cancel: () => {
        console.log('[AndroidPassportReader] Canceling technology request');
        NfcManager.cancelTechnologyRequest().catch(() => {});
      }
    };
  } catch (error) {
    console.error('[AndroidPassportReader] Failed to initialize PassportReader:', error);
    PassportReader = {
      scan: async () => { throw new Error('NFC not available'); },
      cancel: () => {}
    };
  }
}

export interface PassportScanData {
  signatureAlgorithm: string;
  dscSignature: string;
  dscSignatureAlgorithm: string;
  modulus: string;
  exponent: string;
  tbsCertificate: string;
  mrz: string;
  dataGroupHashes: string;
  eContent: string;
  encryptedDigest: string;
  photo: {
    base64: string;
    width: number;
    height: number;
  };
}

class AndroidPassportReader {
  async scan({
    documentNumber,
    dateOfBirth,
    dateOfExpiry,
  }: {
    documentNumber: string;
    dateOfBirth: string;
    dateOfExpiry: string;
  }): Promise<PassportScanData> {
    if (Platform.OS !== 'android') {
      throw new Error('Android passport reader only available on Android');
    }

    if (!PassportReader) {
      throw new Error('PassportReader not initialized. This can happen if the native module is not linked correctly.');
    }

    return PassportReader.scan({
      documentNumber,
      dateOfBirth,
      dateOfExpiry,
    });
  }
  
  cancel(): void {
    if (PassportReader) {
      PassportReader.cancel();
    }
  }
}

export default new AndroidPassportReader();