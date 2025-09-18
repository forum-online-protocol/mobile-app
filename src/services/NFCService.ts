import { DeviceEventEmitter, Platform, Alert } from 'react-native';
import { PassportData } from '../types';
import { MRZParser } from '../utils/MRZParser';

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

// Conditional imports for iOS
let scanPassport: any = null;
if (Platform.OS === 'ios') {
  try {
    const passportLib = require('@better-network/react-native-nfc-passport-reader');
    scanPassport = passportLib?.scanPassport;
  } catch (error) {
    console.log('iOS Passport Reader not available:', error);
    scanPassport = null;
  }
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
      } else if (Platform.OS === 'ios' && scanPassport) {
        // Use iOS-specific passport reader
        const isoDateOfBirth = this.formatDateForIOS(dateOfBirth);
        const isoDateOfExpiry = this.formatDateForIOS(dateOfExpiry);
        
        result = await scanPassport({
          birthDate: isoDateOfBirth,
          expiryDate: isoDateOfExpiry,
          passportNumber: documentNumber,
          useNewVerificationMethod: true,
        });
        
        if ('error' in result) {
          throw new Error(result.error);
        }
      } else {
        throw new NFCError('NFC passport reading not available on this platform');
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
          '📡 NFC Passport Data Scanned',
          `Document: ${passportData.documentNumber}\nCountry: ${passportData.issuingCountry}\nName: ${passportData.firstName} ${passportData.lastName}\nExpiry: ${passportData.dateOfExpiry}\n\nMRZ: ${result.mrz || 'N/A'}`,
          [
            { text: 'OK', onPress: () => console.log('Scanned Data:', passportData) }
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

  private parseNfcResult(result: any): PassportData {
    if (!result) {
      throw new NFCError('Passport data is null or undefined. Scan may have failed or been canceled.');
    }

    // Parse Android result format
    if (Platform.OS === 'android') {
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
      
      return {
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
    
    // Parse iOS result format
    const mrz = result.dataGroups?.DG1 || result.mrz || {};
    const faceImage = result.dataGroups?.DG2 || result.image || null;
    
    return {
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