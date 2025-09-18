import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { PassportReader } = NativeModules;

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
    if (Platform.OS === 'android' && PassportReader) {
      this.eventEmitter = new NativeEventEmitter(PassportReader);
    }
  }

  async readPassport(
    documentNumber: string,
    dateOfBirth: string,
    dateOfExpiry: string
  ): Promise<PassportData> {
    if (Platform.OS !== 'android') {
      throw new Error('Passport reading is only available on Android');
    }

    if (!PassportReader) {
      throw new Error('PassportReader native module not found');
    }

    return new Promise((resolve, reject) => {
      // Set up event listeners
      const successListener = this.eventEmitter?.addListener(
        'passportReadSuccess',
        (data: PassportData) => {
          // Clean up listeners
          successListener?.remove();
          errorListener?.remove();
          resolve(data);
        }
      );

      const errorListener = this.eventEmitter?.addListener(
        'passportReadError',
        (error: { code: string; message: string }) => {
          // Clean up listeners
          successListener?.remove();
          errorListener?.remove();
          reject(new Error(`${error.code}: ${error.message}`));
        }
      );

      // Start the passport scan
      PassportReader.startPassportScan(documentNumber, dateOfBirth, dateOfExpiry)
        .catch((error: any) => {
          // Clean up listeners
          successListener?.remove();
          errorListener?.remove();
          reject(error);
        });
    });
  }

  // Direct method for testing if available
  async testDirectRead(
    tagData: string,
    documentNumber: string,
    dateOfBirth: string,
    dateOfExpiry: string
  ): Promise<PassportData> {
    if (Platform.OS !== 'android') {
      throw new Error('Passport reading is only available on Android');
    }

    if (!PassportReader) {
      throw new Error('PassportReader native module not found');
    }

    // This might not work due to Tag reconstruction issues
    // But keeping it for testing purposes
    return PassportReader.readPassport(tagData, documentNumber, dateOfBirth, dateOfExpiry);
  }
}

export default new PassportReaderService();