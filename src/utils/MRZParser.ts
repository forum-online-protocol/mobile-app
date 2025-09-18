export class MRZParser {
  static parse(mrzString: string): any {
    // Simple MRZ parser for different formats
    const lines = mrzString.trim().split('\n').map(line => line.trim());
    
    if (lines.length === 2 && lines[0].length === 44) {
      // TD3 - Passport
      return this.parseTD3(lines);
    } else if (lines.length === 3 && lines[0].length === 30) {
      // TD1 - ID Card
      return this.parseTD1(lines);
    } else if (lines.length === 2 && lines[0].length === 36) {
      // TD2 - ID Card/Visa
      return this.parseTD2(lines);
    } else if (mrzString.includes(',')) {
      // Simple format: documentNumber,dateOfBirth,dateOfExpiry
      const parts = mrzString.split(',').map(s => s.trim());
      if (parts.length === 3) {
        return {
          documentNumber: parts[0],
          dateOfBirth: parts[1],
          dateOfExpiry: parts[2]
        };
      }
    }
    
    throw new Error('Invalid MRZ format');
  }

  private static parseTD3(lines: string[]): any {
    const line1 = lines[0];
    const line2 = lines[1];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      lastName: line1.substring(5, 44).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line1.substring(5, 44).split('<<')[1]?.replace(/</g, ' ').trim() || '',
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      nationality: line2.substring(10, 13),
      dateOfBirth: line2.substring(13, 19),
      sex: line2.charAt(20),
      dateOfExpiry: line2.substring(21, 27),
      personalNumber: line2.substring(28, 42).replace(/</g, '')
    };
  }

  private static parseTD1(lines: string[]): any {
    const line1 = lines[0];
    const line2 = lines[1];
    const line3 = lines[2];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      documentNumber: line1.substring(5, 14).replace(/</g, ''),
      dateOfBirth: line2.substring(0, 6),
      sex: line2.charAt(7),
      dateOfExpiry: line2.substring(8, 14),
      nationality: line2.substring(15, 18),
      lastName: line3.substring(0, 30).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line3.substring(0, 30).split('<<')[1]?.replace(/</g, ' ').trim() || ''
    };
  }

  private static parseTD2(lines: string[]): any {
    const line1 = lines[0];
    const line2 = lines[1];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      lastName: line1.substring(5, 36).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line1.substring(5, 36).split('<<')[1]?.replace(/</g, ' ').trim() || '',
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      nationality: line2.substring(10, 13),
      dateOfBirth: line2.substring(13, 19),
      sex: line2.charAt(20),
      dateOfExpiry: line2.substring(21, 27),
      personalNumber: line2.substring(28, 35).replace(/</g, '')
    };
  }
}