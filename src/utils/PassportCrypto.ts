// Simple passport crypto utilities for React Native
// This is a simplified implementation for testing purposes

export class PassportCrypto {
  // Calculate check digit for MRZ fields
  static calculateCheckDigit(data: string): string {
    const weights = [7, 3, 1];
    let sum = 0;
    
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      let value: number;
      
      if (char >= '0' && char <= '9') {
        value = parseInt(char);
      } else if (char >= 'A' && char <= 'Z') {
        value = char.charCodeAt(0) - 65 + 10;
      } else if (char === '<') {
        value = 0;
      } else {
        value = 0;
      }
      
      sum += value * weights[i % 3];
    }
    
    return String(sum % 10);
  }

  // Pad string with '<' characters for MRZ
  static padString(str: string, length: number): string {
    if (str.length >= length) {
      return str.substring(0, length);
    }
    return str + '<'.repeat(length - str.length);
  }

  // Format date for MRZ (YYMMDD format)
  static formatDate(date: string): string {
    // Already in YYMMDD format
    if (date.length === 6) {
      return date;
    }
    // Convert from other formats if needed
    return date.replace(/-/g, '').substring(2, 8);
  }

  // Build MRZ info string for BAC
  static buildMRZInfo(documentNumber: string, dateOfBirth: string, dateOfExpiry: string): string {
    const docNum = this.padString(documentNumber, 9);
    const dob = this.formatDate(dateOfBirth);
    const exp = this.formatDate(dateOfExpiry);
    
    const docNumWithCheck = docNum + this.calculateCheckDigit(docNum);
    const dobWithCheck = dob + this.calculateCheckDigit(dob);
    const expWithCheck = exp + this.calculateCheckDigit(exp);
    
    return docNumWithCheck + dobWithCheck + expWithCheck;
  }

  // Convert hex string to byte array
  static hexToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  // Convert byte array to hex string
  static bytesToHex(bytes: number[] | Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Simple XOR operation for testing
  static xor(a: number[], b: number[]): number[] {
    const result: number[] = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      result.push(a[i] ^ b[i]);
    }
    return result;
  }

  // Generate random bytes (for testing)
  static randomBytes(length: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      bytes.push(Math.floor(Math.random() * 256));
    }
    return bytes;
  }

  // Build GET CHALLENGE APDU
  static buildGetChallengeAPDU(): number[] {
    return [0x00, 0x84, 0x00, 0x00, 0x08];
  }

  // Build SELECT APPLICATION APDU for passport
  static buildSelectPassportAPDU(): number[] {
    return [0x00, 0xA4, 0x04, 0x0C, 0x07, 0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01];
  }

  // Build SELECT FILE APDU
  static buildSelectFileAPDU(fileId: number): number[] {
    return [
      0x00, 0xA4, 0x02, 0x0C, 0x02,
      (fileId >> 8) & 0xFF,
      fileId & 0xFF
    ];
  }

  // Build READ BINARY APDU
  static buildReadBinaryAPDU(offset: number, length: number): number[] {
    return [
      0x00, 0xB0,
      (offset >> 8) & 0xFF,
      offset & 0xFF,
      length
    ];
  }

  // Parse status words from response
  static parseStatusWords(response: number[]): { sw1: number; sw2: number; success: boolean } {
    if (response.length < 2) {
      return { sw1: 0, sw2: 0, success: false };
    }
    
    const sw1 = response[response.length - 2];
    const sw2 = response[response.length - 1];
    const success = sw1 === 0x90 && sw2 === 0x00;
    
    return { sw1, sw2, success };
  }

  // File IDs for passport data groups
  static readonly FILE_IDS = {
    COM: 0x011E,  // Common data
    SOD: 0x011D,  // Security data
    DG1: 0x0101,  // MRZ data
    DG2: 0x0102,  // Face image
    DG3: 0x0103,  // Fingerprints
    DG4: 0x0104,  // Iris
    DG5: 0x0105,  // Portrait
    DG6: 0x0106,  // Reserved
    DG7: 0x0107,  // Signature
    DG8: 0x0108,  // Data features
    DG9: 0x0109,  // Structure features
    DG10: 0x010A, // Substance features
    DG11: 0x010B, // Additional personal details
    DG12: 0x010C, // Additional document details
    DG13: 0x010D, // Optional details
    DG14: 0x010E, // Security options
    DG15: 0x010F, // Active authentication public key
    DG16: 0x0110, // Persons to notify
  };
}

export default PassportCrypto;