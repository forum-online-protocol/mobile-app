import { Platform } from 'react-native';

// Vision camera and ML Kit text recognition for MRZ scanning
let Camera: any = null;
let useCameraDevice: any = null;
let useCameraPermission: any = null;
let recognizeImage: any = null;

if (Platform.OS !== 'web') {
  try {
    const visionCamera = require('react-native-vision-camera');
    Camera = visionCamera.Camera;
    useCameraDevice = visionCamera.useCameraDevice;
    useCameraPermission = visionCamera.useCameraPermission;
    
    // ML Kit text recognition would be imported here
    // For now, we'll use a simplified version
    recognizeImage = async (imagePath: string) => {
      // This would use ML Kit to recognize text in the image
      // Returns blocks of text found in the image
      return { blocks: [] };
    };
  } catch (error) {
    console.log('Vision Camera not available:', error);
  }
}

export interface MRZData {
  documentNumber: string;
  dateOfBirth: string;
  dateOfExpiry: string;
  mrz?: string;
}

export class MRZScanner {
  private static instance: MRZScanner;
  
  private constructor() {}
  
  static getInstance(): MRZScanner {
    if (!MRZScanner.instance) {
      MRZScanner.instance = new MRZScanner();
    }
    return MRZScanner.instance;
  }
  
  async scanMRZFromCamera(camera: any): Promise<MRZData | null> {
    if (!camera || Platform.OS === 'web') {
      return null;
    }
    
    try {
      const photo = await camera.takePhoto({
        enableShutterSound: false,
        qualityPrioritization: 'quality',
      });
      
      const { blocks } = await recognizeImage(`file://${photo.path}`);
      
      for (const block of blocks) {
        // Look for MRZ pattern (starts with P< or I< for passports/ID cards)
        if ((block.text.startsWith('P<') || block.text.startsWith('I<')) && 
            block.text.includes('\n')) {
          return this.parseMRZText(block.text);
        }
      }
      
      return null;
    } catch (error) {
      console.error('MRZ scanning error:', error);
      return null;
    }
  }
  
  parseMRZText(mrzText: string): MRZData {
    const mrz = mrzText.replace(/\s/g, '');
    const indexOfLineBreak = mrz.indexOf('\n');
    
    return {
      documentNumber: mrz.slice(indexOfLineBreak, indexOfLineBreak + 10).replace(/</g, ''),
      dateOfBirth: mrz.slice(indexOfLineBreak + 14, indexOfLineBreak + 20),
      dateOfExpiry: mrz.slice(indexOfLineBreak + 22, indexOfLineBreak + 28),
      mrz: mrz.replace(/\n/g, '')
    };
  }
  
  // Manual MRZ entry validation
  validateMRZData(data: MRZData): boolean {
    // Document number should be 9 characters
    if (!data.documentNumber || data.documentNumber.length !== 9) {
      return false;
    }
    
    // Dates should be in YYMMDD format
    if (!this.isValidDate(data.dateOfBirth) || !this.isValidDate(data.dateOfExpiry)) {
      return false;
    }
    
    return true;
  }
  
  private isValidDate(date: string): boolean {
    if (!date || date.length !== 6) {
      return false;
    }
    
    const year = parseInt(date.substring(0, 2));
    const month = parseInt(date.substring(2, 4));
    const day = parseInt(date.substring(4, 6));
    
    return !isNaN(year) && !isNaN(month) && !isNaN(day) &&
           month >= 1 && month <= 12 &&
           day >= 1 && day <= 31;
  }
}

export { Camera, useCameraDevice, useCameraPermission };