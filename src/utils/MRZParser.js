class MRZParser {
  static parse(mrzString) {
    const lines = mrzString.trim().split('\n').map(line => line.trim());
    
    if (lines.length === 2 && lines[0].length === 44) {
      return this.parseTD3(lines);
    } else if (lines.length === 2 && lines[0].length === 36) {
      return this.parseTD1(lines);
    } else if (lines.length === 2 && lines[0].length === 36) {
      return this.parseTD2(lines);
    } else if (lines.length === 3 && lines[0].length === 30) {
      return this.parseMRVA(lines);
    } else if (lines.length === 2 && lines[0].length === 30) {
      return this.parseMRVB(lines);
    } else {
      throw new Error('Unknown MRZ format');
    }
  }

  static parseTD3(lines) {
    const line1 = lines[0];
    const line2 = lines[1];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      lastName: line1.substring(5, 44).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line1.substring(5, 44).split('<<')[1]?.replace(/</g, ' ').trim() || '',
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      documentNumberCheckDigit: line2.charAt(9),
      nationality: line2.substring(10, 13),
      dateOfBirth: this.parseDate(line2.substring(13, 19)),
      dateOfBirthCheckDigit: line2.charAt(19),
      sex: line2.charAt(20),
      dateOfExpiry: this.parseDate(line2.substring(21, 27)),
      dateOfExpiryCheckDigit: line2.charAt(27),
      optionalData: line2.substring(28, 42).replace(/</g, ''),
      optionalDataCheckDigit: line2.charAt(42),
      compositeCheckDigit: line2.charAt(43),
      mrzString: lines.join('\n'),
      format: 'TD3'
    };
  }

  static parseTD1(lines) {
    const line1 = lines[0];
    const line2 = lines[1];
    const line3 = lines[2];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      documentNumber: line1.substring(5, 14).replace(/</g, ''),
      documentNumberCheckDigit: line1.charAt(14),
      optionalData1: line1.substring(15, 30).replace(/</g, ''),
      dateOfBirth: this.parseDate(line2.substring(0, 6)),
      dateOfBirthCheckDigit: line2.charAt(6),
      sex: line2.charAt(7),
      dateOfExpiry: this.parseDate(line2.substring(8, 14)),
      dateOfExpiryCheckDigit: line2.charAt(14),
      nationality: line2.substring(15, 18),
      optionalData2: line2.substring(18, 29).replace(/</g, ''),
      compositeCheckDigit: line2.charAt(29),
      lastName: line3.substring(0, 30).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line3.substring(0, 30).split('<<')[1]?.replace(/</g, ' ').trim() || '',
      mrzString: lines.join('\n'),
      format: 'TD1'
    };
  }

  static parseTD2(lines) {
    const line1 = lines[0];
    const line2 = lines[1];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      lastName: line1.substring(5, 36).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line1.substring(5, 36).split('<<')[1]?.replace(/</g, ' ').trim() || '',
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      documentNumberCheckDigit: line2.charAt(9),
      nationality: line2.substring(10, 13),
      dateOfBirth: this.parseDate(line2.substring(13, 19)),
      dateOfBirthCheckDigit: line2.charAt(19),
      sex: line2.charAt(20),
      dateOfExpiry: this.parseDate(line2.substring(21, 27)),
      dateOfExpiryCheckDigit: line2.charAt(27),
      optionalData: line2.substring(28, 35).replace(/</g, ''),
      compositeCheckDigit: line2.charAt(35),
      mrzString: lines.join('\n'),
      format: 'TD2'
    };
  }

  static parseMRVA(lines) {
    const line1 = lines[0];
    const line2 = lines[1];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      lastName: line1.substring(5, 44).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line1.substring(5, 44).split('<<')[1]?.replace(/</g, ' ').trim() || '',
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      documentNumberCheckDigit: line2.charAt(9),
      nationality: line2.substring(10, 13),
      dateOfBirth: this.parseDate(line2.substring(13, 19)),
      dateOfBirthCheckDigit: line2.charAt(19),
      sex: line2.charAt(20),
      dateOfExpiry: this.parseDate(line2.substring(21, 27)),
      dateOfExpiryCheckDigit: line2.charAt(27),
      optionalData: line2.substring(28).replace(/</g, ''),
      mrzString: lines.join('\n'),
      format: 'MRVA'
    };
  }

  static parseMRVB(lines) {
    const line1 = lines[0];
    const line2 = lines[1];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      lastName: line1.substring(5, 36).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line1.substring(5, 36).split('<<')[1]?.replace(/</g, ' ').trim() || '',
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      documentNumberCheckDigit: line2.charAt(9),
      nationality: line2.substring(10, 13),
      dateOfBirth: this.parseDate(line2.substring(13, 19)),
      dateOfBirthCheckDigit: line2.charAt(19),
      sex: line2.charAt(20),
      dateOfExpiry: this.parseDate(line2.substring(21, 27)),
      dateOfExpiryCheckDigit: line2.charAt(27),
      optionalData: line2.substring(28).replace(/</g, ''),
      mrzString: lines.join('\n'),
      format: 'MRVB'
    };
  }

  static parseDate(dateString) {
    const year = parseInt(dateString.substring(0, 2));
    const month = parseInt(dateString.substring(2, 4));
    const day = parseInt(dateString.substring(4, 6));
    
    const currentYear = new Date().getFullYear();
    const currentCentury = Math.floor(currentYear / 100) * 100;
    const currentYearInCentury = currentYear % 100;
    
    let fullYear;
    if (year <= currentYearInCentury + 10) {
      fullYear = currentCentury + year;
    } else {
      fullYear = currentCentury - 100 + year;
    }
    
    return {
      year: fullYear,
      month,
      day,
      formatted: `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  }

  static calculateCheckDigit(data) {
    const weights = [7, 3, 1];
    let sum = 0;
    
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      let value;
      
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
    
    return sum % 10;
  }

  static validateMRZ(mrzData) {
    const errors = [];
    
    if (mrzData.documentNumberCheckDigit) {
      const calculated = this.calculateCheckDigit(mrzData.documentNumber);
      if (calculated !== parseInt(mrzData.documentNumberCheckDigit)) {
        errors.push('Invalid document number check digit');
      }
    }
    
    if (mrzData.dateOfBirthCheckDigit) {
      const dobString = `${mrzData.dateOfBirth.year % 100}${String(mrzData.dateOfBirth.month).padStart(2, '0')}${String(mrzData.dateOfBirth.day).padStart(2, '0')}`;
      const calculated = this.calculateCheckDigit(dobString);
      if (calculated !== parseInt(mrzData.dateOfBirthCheckDigit)) {
        errors.push('Invalid date of birth check digit');
      }
    }
    
    if (mrzData.dateOfExpiryCheckDigit) {
      const expString = `${mrzData.dateOfExpiry.year % 100}${String(mrzData.dateOfExpiry.month).padStart(2, '0')}${String(mrzData.dateOfExpiry.day).padStart(2, '0')}`;
      const calculated = this.calculateCheckDigit(expString);
      if (calculated !== parseInt(mrzData.dateOfExpiryCheckDigit)) {
        errors.push('Invalid date of expiry check digit');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default MRZParser;