import { DeviceEventEmitter, Platform, Alert, NativeModules, NativeEventEmitter } from 'react-native';
import { PassportData } from '../types';
import { MRZParser } from '../utils/MRZParser';
import i18n from '../localization/i18n';

// Conditionally import AndroidPassportReader
let AndroidPassportReader: any = null;
if (Platform.OS === 'android') {
  try {
    AndroidPassportReader = require('./passport/AndroidPassportReader').default;
  } catch (error) {
    console.log('AndroidPassportReader not available:', error);
    AndroidPassportReader = null;
  }
}

// Get iOS native PassportReader module
const { PassportReader: IOSPassportReader } = NativeModules;
let iosEventEmitter: NativeEventEmitter | null = null;
if (Platform.OS === 'ios' && IOSPassportReader) {
  iosEventEmitter = new NativeEventEmitter(IOSPassportReader);
  console.log('[NFCService] iOS PassportReader native module found');
} else if (Platform.OS === 'ios') {
  console.warn('[NFCService] iOS PassportReader native module NOT found');
}

export class NFCService {
  private static instance: NFCService;
  private isInitialized: boolean = false;
  private isReading: boolean = false;

  private constructor() {}

  static getInstance(): NFCService {
    if (!NFCService.instance) {
      NFCService.instance = new NFCService();
    }
    return NFCService.instance;
  }

  async initialize(): Promise<boolean> {
    // Skip NFC initialization on web
    if (Platform.OS === 'web') {
      console.log('Web platform detected - NFC not available');
      return false;
    }
    
    this.isInitialized = true;
    return true;
  }

  async startPassportScan(mrzData?: string | { documentNumber: string; dateOfBirth: string; dateOfExpiry: string }): Promise<PassportData> {
    // Web platform doesn't support NFC
    if (Platform.OS === 'web') {
      throw new NFCError('NFC passport scanning is not available on web platform');
    }
    
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isReading) {
      throw new NFCError('Scan already in progress');
    }

    this.isReading = true;
    this.emit('scanStart');

    try {
      // Parse MRZ data if provided
      let documentNumber = '';
      let dateOfBirth = '';
      let dateOfExpiry = '';
      
      if (mrzData) {
        if (typeof mrzData === 'string') {
          // Parse MRZ string
          const mrzInfo = MRZParser.parse(mrzData);
          documentNumber = mrzInfo.documentNumber || '';
          dateOfBirth = mrzInfo.dateOfBirth || '';
          dateOfExpiry = mrzInfo.dateOfExpiry || '';
        } else {
          // Direct MRZ data object
          documentNumber = mrzData.documentNumber;
          dateOfBirth = mrzData.dateOfBirth;
          dateOfExpiry = mrzData.dateOfExpiry;
        }
      } else {
        // For testing/demo - use placeholder values
        // In production, these should come from user input or MRZ scan
        documentNumber = 'L898902C3';
        dateOfBirth = '740812';  // YYMMDD format
        dateOfExpiry = '301231';  // YYMMDD format
      }
      
      console.log('[NFCService] Starting passport scan with:', {
        documentNumber,
        dateOfBirth,
        dateOfExpiry,
        platform: Platform.OS
      });
      
      let result: any = null;
      
      if (Platform.OS === 'android') {
        // Use Android-specific passport reader
        if (!AndroidPassportReader) {
          throw new NFCError('NFC passport scanning is not available on this device');
        }
        
        try {
          console.log('[NFCService] Calling AndroidPassportReader.scan()...');
          result = await AndroidPassportReader.scan({
            documentNumber,
            dateOfBirth,
            dateOfExpiry,
          });
          console.log('[NFCService] Android scan result received:', result);
        } catch (error: any) {
          console.error('[NFCService] Raw Android scan error:', JSON.stringify(error));
          if (error.code === 'E_SCAN_CANCELED') {
            console.log('[NFCService] Android scan was canceled by user');
            throw new NFCError('Passport scan was canceled');
          } else {
            console.error('[NFCService] Android scan error:', error);
            if (AndroidPassportReader && AndroidPassportReader.cancel) {
              AndroidPassportReader.cancel();
            }
            throw error;
          }
        }
      } else if (Platform.OS === 'ios' && IOSPassportReader) {
        // Use iOS native PassportReader module
        console.log('[NFCService] Using iOS native PassportReader module');

        result = await new Promise((resolve, reject) => {
          let isResolved = false;

          // Set up event listeners for iOS native module
          const successListener = iosEventEmitter?.addListener(
            'passportReadSuccess',
            (data: any) => {
              if (!isResolved) {
                console.log('[NFCService] iOS passport read success:', data);
                isResolved = true;
                successListener?.remove();
                errorListener?.remove();
                resolve(data);
              }
            }
          );

          const errorListener = iosEventEmitter?.addListener(
            'passportReadError',
            (error: { code: string; message: string }) => {
              if (!isResolved) {
                console.error('[NFCService] iOS passport read error:', error);
                isResolved = true;
                successListener?.remove();
                errorListener?.remove();
                reject(new NFCError(`${error.code}: ${error.message}`));
              }
            }
          );

          // Start the passport scan
          IOSPassportReader.startPassportScan(documentNumber, dateOfBirth, dateOfExpiry)
            .then((scanResult: any) => {
              console.log('[NFCService] iOS scan started:', scanResult);
            })
            .catch((error: any) => {
              if (!isResolved) {
                console.error('[NFCService] iOS failed to start scan:', error);
                isResolved = true;
                successListener?.remove();
                errorListener?.remove();
                reject(error);
              }
            });
        });
      } else {
        throw new NFCError('NFC passport reading not available on this platform. Native module not found.');
      }
      
      if (!result) {
        throw new NFCError('No passport data received');
      }
      
      console.log('[NFCService] Parsing NFC result...');
      // Parse the result into our PassportData format
      const passportData = this.parseNfcResult(result);
      
      // Debug alert with scanned data
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Alert.alert(
          i18n.t('nfcService.passportDataScannedTitle'),
          i18n.t('nfcService.passportDataScannedMessage', {
            document: passportData.documentNumber,
            country: passportData.issuingCountry,
            firstName: passportData.firstName,
            lastName: passportData.lastName,
            expiry: passportData.dateOfExpiry,
            mrz: result.mrz || i18n.t('profile.notAvailable'),
          }),
          [
            { text: i18n.t('common.ok'), onPress: () => console.log('Scanned Data:', passportData) }
          ]
        );
      }
      
      this.emit('scanSuccess', passportData);
      return passportData;
    } catch (error) {
      console.error('[NFCService] Passport scan error:', error);
      this.emit('scanError', error);
      throw error;
    } finally {
      this.isReading = false;
      await this.cleanup();
    }
  }

  private formatDateForIOS(date: string): string {
    // Convert YYMMDD to YYYY-MM-DD format for iOS
    if (date.length === 6) {
      const yy = parseInt(date.substring(0, 2));
      const mm = date.substring(2, 4);
      const dd = date.substring(4, 6);
      
      // Assume 20xx for years 00-30, 19xx for years 31-99
      const yyyy = yy <= 30 ? 2000 + yy : 1900 + yy;
      
      return `${yyyy}-${mm}-${dd}`;
    }
    return date;
  }

  /**
   * Normalize passport data to ensure consistent format across platforms
   * This is critical for generating the same wallet key from the same passport
   */
  private normalizePassportData(data: PassportData): PassportData {
    // Normalize names: uppercase, trim whitespace, remove extra spaces
    const normalizeName = (name: string): string => {
      return name
        .toUpperCase()
        .trim()
        .replace(/\s+/g, ' '); // Replace multiple spaces with single space
    };

    // Normalize date to YYMMDD format
    const normalizeDate = (date: string): string => {
      if (!date) return '';

      // Remove any non-alphanumeric characters
      const cleanDate = date.replace(/[^0-9A-Za-z]/g, '');

      // If already in YYMMDD format (6 digits)
      if (/^\d{6}$/.test(cleanDate)) {
        return cleanDate;
      }

      // If in YYYYMMDD format (8 digits), convert to YYMMDD
      if (/^\d{8}$/.test(cleanDate)) {
        return cleanDate.substring(2); // Remove first 2 chars (century)
      }

      // Try to parse various date formats
      // Format: YYYY-MM-DD or YYYY/MM/DD
      const isoMatch = date.match(/(\d{4})[-\/](\d{2})[-\/](\d{2})/);
      if (isoMatch) {
        const yy = isoMatch[1].substring(2);
        return `${yy}${isoMatch[2]}${isoMatch[3]}`;
      }

      // Format: DD-MM-YYYY or DD/MM/YYYY
      const euMatch = date.match(/(\d{2})[-\/](\d{2})[-\/](\d{4})/);
      if (euMatch) {
        const yy = euMatch[3].substring(2);
        return `${yy}${euMatch[2]}${euMatch[1]}`;
      }

      // Format: DD MMM YYYY (e.g., "01 JAN 1990")
      const monthNames: { [key: string]: string } = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
      };
      const textMatch = date.match(/(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})/i);
      if (textMatch) {
        const dd = textMatch[1].padStart(2, '0');
        const mm = monthNames[textMatch[2].toUpperCase()] || '01';
        const yy = textMatch[3].substring(2);
        return `${yy}${mm}${dd}`;
      }

      // Return original if we can't parse (should not happen with real passport data)
      console.warn('[NFCService] Could not normalize date:', date);
      return cleanDate.substring(0, 6) || date;
    };

    // Normalize nationality to 3-letter ISO code (uppercase)
    const normalizeNationality = (nationality: string): string => {
      if (!nationality) return '';
      // Take first 3 chars, uppercase, remove any < characters
      return nationality
        .replace(/</g, '')
        .toUpperCase()
        .trim()
        .substring(0, 3);
    };

    console.log('[NFCService] Normalizing passport data...');
    console.log('[NFCService] Before normalization:', {
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      nationality: data.nationality
    });

    const normalized: PassportData = {
      ...data,
      firstName: normalizeName(data.firstName || ''),
      lastName: normalizeName(data.lastName || ''),
      dateOfBirth: normalizeDate(data.dateOfBirth || ''),
      dateOfExpiry: normalizeDate(data.dateOfExpiry || ''),
      nationality: normalizeNationality(data.nationality || ''),
      issuingCountry: normalizeNationality(data.issuingCountry || ''),
    };

    console.log('[NFCService] After normalization:', {
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      dateOfBirth: normalized.dateOfBirth,
      nationality: normalized.nationality
    });

    return normalized;
  }

  private parseNfcResult(result: any): PassportData {
    if (!result) {
      throw new NFCError('Passport data is null or undefined. Scan may have failed or been canceled.');
    }

    let parsedData: PassportData;

    // Parse iOS result format from NFCPassportReader native module
    if (Platform.OS === 'ios' && result.personalData) {
      const personal = result.personalData;
      parsedData = {
        documentType: personal.documentType || 'P',
        issuingCountry: personal.issuingState || personal.nationality || 'USA',
        documentNumber: personal.documentNumber || '',
        nationality: personal.nationality || 'USA',
        dateOfBirth: personal.dateOfBirth || '',
        sex: personal.gender || 'M',
        dateOfExpiry: personal.dateOfExpiry || '',
        personalNumber: '<<<<<<<<<<<<<<',
        firstName: personal.firstName || 'Unknown',
        lastName: personal.lastName || 'User',
        dataGroups: {
          DG1: {
            documentNumber: personal.documentNumber,
            firstName: personal.firstName,
            lastName: personal.lastName,
            dateOfBirth: personal.dateOfBirth,
            dateOfExpiry: personal.dateOfExpiry,
            nationality: personal.nationality,
            gender: personal.gender,
          },
          DG2: result.faceImage ? {
            image: result.faceImage,
            mimeType: result.faceImageMimeType || 'image/jpeg'
          } : null,
        }
      };
    }
    // Parse Android result format
    else if (Platform.OS === 'android') {
      // Extract MRZ fields from the MRZ string
      const mrz = result.mrz?.replace(/\n/g, '') || '';
      let firstName = 'Unknown';
      let lastName = 'User';
      let documentNumber = '';
      let issuingCountry = '';
      let nationality = '';
      let dateOfBirth = '';
      let dateOfExpiry = '';
      let sex = 'M';

      // Parse MRZ if available (standard ICAO 9303 format)
      if (mrz.length >= 88) {
        // Line 1: Document type, country, names
        const line1 = mrz.substring(0, 44);
        const documentType = line1.substring(0, 2).replace(/</g, '');
        issuingCountry = line1.substring(2, 5).replace(/</g, '');

        // Extract names (separated by <<)
        const namesSection = line1.substring(5).split('<<');
        if (namesSection.length >= 2) {
          lastName = namesSection[0].replace(/</g, ' ').trim();
          firstName = namesSection[1].replace(/</g, ' ').trim();
        }

        // Line 2: Document number, nationality, dates, sex
        const line2 = mrz.substring(44);
        documentNumber = line2.substring(0, 9).replace(/</g, '');
        nationality = line2.substring(10, 13).replace(/</g, '');
        dateOfBirth = line2.substring(13, 19);
        sex = line2.charAt(20);
        dateOfExpiry = line2.substring(21, 27);
      }

      parsedData = {
        documentType: (result as any).documentType || 'P',
        issuingCountry: issuingCountry || 'USA',
        documentNumber: documentNumber || result.documentNumber || '123456789',
        nationality: nationality || issuingCountry || 'USA',
        dateOfBirth: dateOfBirth || '900101',
        sex: sex || 'M',
        dateOfExpiry: dateOfExpiry || '301231',
        personalNumber: '<<<<<<<<<<<<<<',
        firstName,
        lastName,
        dataGroups: {
          DG1: { mrz },
          DG2: result.photo ? { image: result.photo.base64 } : null,
          signatureAlgorithm: result.signatureAlgorithm,
          dscSignature: result.dscSignature,
          publicKey: {
            modulus: result.modulus,
            exponent: result.exponent,
          },
          eContent: result.eContent,
          encryptedDigest: result.encryptedDigest,
        }
      };
    }
    else {
      // Parse fallback result format
      const mrz = result.dataGroups?.DG1 || result.mrz || {};
      const faceImage = result.dataGroups?.DG2 || result.image || null;

      parsedData = {
        documentType: mrz.documentType || result.documentType || 'P',
        issuingCountry: mrz.issuingCountry || result.issuingCountry || 'USA',
        documentNumber: mrz.documentNumber || result.documentNumber || '123456789',
        nationality: mrz.nationality || result.nationality || 'USA',
        dateOfBirth: mrz.dateOfBirth || result.dateOfBirth || '900101',
        sex: mrz.sex || result.gender || 'M',
        dateOfExpiry: mrz.dateOfExpiry || result.dateOfExpiry || '301231',
        personalNumber: mrz.personalNumber || result.personalNumber || '<<<<<<<<<<<<<<',
        firstName: mrz.firstName || result.firstName || 'Unknown',
        lastName: mrz.lastName || result.lastName || 'User',
        dataGroups: {
          DG1: mrz,
          DG2: faceImage,
          ...result.dataGroups
        }
      };
    }

    // CRITICAL: Normalize passport data to ensure consistent format across platforms
    // This ensures the same passport generates the same wallet key on iOS and Android
    return this.normalizePassportData(parsedData);
  }

  async cleanup() {
    if (Platform.OS === 'android' && AndroidPassportReader) {
      try {
        AndroidPassportReader.cancel();
      } catch (error) {
        console.log('Cleanup completed');
      }
    }
  }

  async checkNFCEnabled(): Promise<boolean> {
    return Platform.OS === 'android' || Platform.OS === 'ios';
  }

  async promptNFCSettings() {
    if (Platform.OS === 'web') {
      console.log('NFC settings not available on web');
      return;
    }
    
    // Use Linking to open NFC settings directly (skip broken NfcManager)
    try {
      const { Linking } = require('react-native');
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.NFC_SETTINGS');
      } else if (Platform.OS === 'ios') {
        // iOS doesn't allow direct NFC settings access
        await Linking.openURL('app-settings:');
      }
    } catch (error) {
      console.error('Could not open NFC settings:', error);
    }
  }

  // Event emitter methods using DeviceEventEmitter
  emit(event: string, data?: any) {
    DeviceEventEmitter.emit(`NFC_${event}`, data);
  }

  addListener(event: string, callback: (data?: any) => void) {
    return DeviceEventEmitter.addListener(`NFC_${event}`, callback);
  }

  removeListener(event: string, callback: (data?: any) => void) {
    // @ts-ignore - removeListener exists but types might be outdated
    DeviceEventEmitter.removeListener(`NFC_${event}`, callback);
  }

  removeAllListeners() {
    // Remove all NFC event listeners
    DeviceEventEmitter.removeAllListeners();
  }

  on(event: string, callback: (data?: any) => void) {
    return this.addListener(event.replace(':', ':'), callback);
  }

  async isNFCEnabled(): Promise<boolean> {
    return this.checkNFCEnabled();
  }

  async requestNFCEnable() {
    return this.promptNFCSettings();
  }
}

export class NFCError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NFCError';
  }
}
