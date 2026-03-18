import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

let PassportReader = NativeModules.PassportReader;

if (!PassportReader) {
  PassportReader = NativeModules.PassportReaderModule;
  console.log('[PassportReaderService] Trying PassportReaderModule:', PassportReader);
}

if (!PassportReader) {
  const passportModules = Object.keys(NativeModules).filter(key => 
    key.toLowerCase().includes('passport') || key.toLowerCase().includes('reader')
  );
  console.log('[PassportReaderService] Found passport-related modules:', passportModules);
  if (passportModules.length > 0) {
    PassportReader = NativeModules[passportModules[0]];
    console.log('[PassportReaderService] Using module:', passportModules[0], PassportReader);
  }
}

console.log('[PassportReaderService] Available modules:', Object.keys(NativeModules));
console.log('[PassportReaderService] PassportReader module:', PassportReader);

interface PersonalData {
  documentNumber: string;
  firstName: string;
  lastName: string;
  nationality: string;
  issuingState: string;
  dateOfBirth: string;
  dateOfExpiry: string;
  gender: string;
  documentType: string;
}

interface PassportData {
  personalData?: PersonalData;
  faceImage?: string;
  faceImageMimeType?: string;
  dg1Error?: string;
  dg2Error?: string;
}

class PassportReaderService {
  private eventEmitter: NativeEventEmitter | null = null;

  constructor() {
    console.log('[PassportReaderService] Constructor called');
    console.log('[PassportReaderService] PassportReader available:', !!PassportReader);
    
    if (PassportReader) {
      this.eventEmitter = new NativeEventEmitter(PassportReader);
      console.log('[PassportReaderService] EventEmitter created successfully');
    } else {
      console.warn('[PassportReaderService] PassportReader module not found, EventEmitter not created');
    }
  }

  async readPassport(
    documentNumber: string,
    dateOfBirth: string,
    dateOfExpiry: string
  ): Promise<PassportData> {
    console.log('[PassportReaderService] readPassport called');
    console.log('[PassportReaderService] PassportReader module:', PassportReader);
    console.log('[PassportReaderService] EventEmitter:', this.eventEmitter);
    
    if (!PassportReader) {
      console.error('[PassportReaderService] PassportReader native module not found');
      console.error('[PassportReaderService] Available modules:', Object.keys(NativeModules));
      throw new Error('PassportReader native module not found');
    }

    console.log('[PassportReaderService] Starting passport scan for platform:', Platform.OS);
    console.log('[PassportReaderService] MRZ data:', { documentNumber, dateOfBirth, dateOfExpiry });

    if (Platform.OS === 'ios') {
      try {
        const PlatformConstants = require('react-native').NativeModules.PlatformConstants;
        const isSimulator = PlatformConstants?.simulator === true || 
                           PlatformConstants?.isTesting === true ||
                           (typeof PlatformConstants?.interfaceIdiom !== 'undefined' && 
                            PlatformConstants?.interfaceIdiom === 'pad' && 
                            PlatformConstants?.systemName === 'iOS');
        
        if (isSimulator) {
          console.warn('[PassportReaderService] Running on iOS Simulator - NFC not available');
          throw new Error('NFC reading is not available in iOS Simulator. Please test on a real device.');
        }
        
        console.log('[PassportReaderService] Running on real iOS device - NFC should be available');
      } catch (detectionError) {
        console.log('[PassportReaderService] Could not detect simulator, proceeding with NFC check');
      }
    }

    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;
      let isResolved = false;

      timeoutId = setTimeout(() => {
        if (!isResolved) {
          console.error('[PassportReaderService] NFC reading timeout after 60 seconds');
          isResolved = true;
          successListener?.remove();
          errorListener?.remove();
          reject(new Error('NFC reading timeout. Please ensure the passport is close to the device and try again.'));
        }
      }, 60000);

      const successListener = this.eventEmitter?.addListener(
        'passportReadSuccess',
        (data: PassportData) => {
          if (!isResolved) {
            console.log('[PassportReaderService] Passport read success:', data);
            isResolved = true;
            clearTimeout(timeoutId);
            successListener?.remove();
            errorListener?.remove();
            resolve(data);
          }
        }
      );

      const errorListener = this.eventEmitter?.addListener(
        'passportReadError',
        (error: { code: string; message: string }) => {
          if (!isResolved) {
            console.error('[PassportReaderService] Passport read error:', error);
            isResolved = true;
            clearTimeout(timeoutId);
            successListener?.remove();
            errorListener?.remove();
            reject(new Error(`${error.code}: ${error.message}`));
          }
        }
      );

      PassportReader.startPassportScan(documentNumber, dateOfBirth, dateOfExpiry)
        .then((result: any) => {
          console.log('[PassportReaderService] Passport scan started successfully:', result);
        })
        .catch((error: any) => {
          if (!isResolved) {
            console.error('[PassportReaderService] Failed to start passport scan:', error);
            isResolved = true;
            clearTimeout(timeoutId);
            successListener?.remove();
            errorListener?.remove();
            reject(error);
          }
        });
    });
  }

  async testDirectRead(
    tagData: string,
    documentNumber: string,
    dateOfBirth: string,
    dateOfExpiry: string
  ): Promise<PassportData> {
    if (!PassportReader) {
      throw new Error('PassportReader native module not found');
    }

    console.log('[PassportReaderService] Testing direct read for platform:', Platform.OS);
    
    // This might not work due to Tag reconstruction issues
    // But keeping it for testing purposes
    try {
      return await PassportReader.readPassport(tagData, documentNumber, dateOfBirth, dateOfExpiry);
    } catch (error) {
      console.error('[PassportReaderService] Direct read failed:', error);
      throw error;
    }
  }
}

export default new PassportReaderService();