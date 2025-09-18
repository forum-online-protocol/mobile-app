import crypto from 'crypto';

class DataGroupParser {
  static parse(dgNumber, data) {
    const parsers = {
      1: this.parseDG1,
      2: this.parseDG2,
      3: this.parseDG3,
      5: this.parseDG5,
      7: this.parseDG7,
      11: this.parseDG11,
      12: this.parseDG12,
      14: this.parseDG14,
      15: this.parseDG15
    };
    
    const parser = parsers[dgNumber];
    if (parser) {
      return parser.call(this, data);
    }
    
    return { raw: data.toString('hex') };
  }

  static parseDG1(data) {
    const content = this._extractContent(data);
    const mrzData = content.toString('ascii');
    
    return this._parseMRZFromDG1(mrzData);
  }

  static parseDG2(data) {
    const content = this._extractContent(data);
    
    const bioType = content[0];
    const bioSubtype = content[1];
    const createDate = content.slice(2, 6);
    const validity = content.slice(6, 8);
    const creator = content.slice(8, 10);
    
    const imageStart = this._findJPEGStart(content);
    const imageData = imageStart >= 0 ? content.slice(imageStart) : null;
    
    return {
      biometricType: bioType === 0x02 ? 'Face' : 'Unknown',
      biometricSubtype: bioSubtype,
      creationDate: createDate.toString('hex'),
      validityPeriod: validity.toString('hex'),
      creator: creator.toString('hex'),
      imageFormat: imageData ? 'JPEG' : 'Unknown',
      imageData: imageData ? imageData.toString('base64') : null,
      imageSize: imageData ? imageData.length : 0
    };
  }

  static parseDG3(data) {
    const content = this._extractContent(data);
    
    const numFingerprints = content[0];
    const fingerprints = [];
    
    let offset = 1;
    for (let i = 0; i < numFingerprints; i++) {
      const fpLength = content.readUInt16BE(offset);
      const fpData = content.slice(offset + 2, offset + 2 + fpLength);
      
      fingerprints.push({
        position: fpData[0],
        viewNumber: fpData[1],
        impressionType: fpData[2],
        quality: fpData[3],
        imageData: fpData.slice(4).toString('base64')
      });
      
      offset += 2 + fpLength;
    }
    
    return {
      count: numFingerprints,
      fingerprints
    };
  }

  static parseDG5(data) {
    const content = this._extractContent(data);
    
    const imageStart = this._findJPEGStart(content);
    const imageData = imageStart >= 0 ? content.slice(imageStart) : null;
    
    return {
      type: 'DisplayedPortrait',
      imageFormat: imageData ? 'JPEG' : 'Unknown',
      imageData: imageData ? imageData.toString('base64') : null,
      imageSize: imageData ? imageData.length : 0
    };
  }

  static parseDG7(data) {
    const content = this._extractContent(data);
    
    const imageStart = this._findJPEGStart(content);
    const imageData = imageStart >= 0 ? content.slice(imageStart) : null;
    
    return {
      type: 'Signature',
      imageFormat: imageData ? 'JPEG' : 'Unknown',
      imageData: imageData ? imageData.toString('base64') : null,
      imageSize: imageData ? imageData.length : 0
    };
  }

  static parseDG11(data) {
    const content = this._extractContent(data);
    const text = content.toString('utf8');
    
    const fields = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key && value) {
        fields[key] = value;
      }
    }
    
    return {
      type: 'AdditionalPersonalDetails',
      fields,
      raw: text
    };
  }

  static parseDG12(data) {
    const content = this._extractContent(data);
    const text = content.toString('utf8');
    
    const fields = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key && value) {
        fields[key] = value;
      }
    }
    
    return {
      type: 'AdditionalDocumentDetails',
      fields,
      raw: text
    };
  }

  static parseDG14(data) {
    const content = this._extractContent(data);
    
    return {
      type: 'SecurityOptions',
      data: content.toString('hex')
    };
  }

  static parseDG15(data) {
    const content = this._extractContent(data);
    
    const keyInfo = this._parsePublicKey(content);
    
    return {
      type: 'ActiveAuthentication',
      publicKey: keyInfo
    };
  }

  static parseCOM(data) {
    const content = this._extractContent(data);
    
    const version = content.slice(0, 4).toString('ascii');
    const unicodeVersion = content.slice(4, 10).toString('ascii');
    
    const tagList = [];
    let offset = 10;
    
    while (offset < content.length) {
      const tag = content[offset];
      if (tag === 0x5C) {
        const length = content[offset + 1];
        const tags = content.slice(offset + 2, offset + 2 + length);
        
        for (let i = 0; i < tags.length; i++) {
          tagList.push(tags[i]);
        }
        break;
      }
      offset++;
    }
    
    return {
      LDSVersion: version,
      unicodeVersion,
      dataGroups: tagList.map(tag => `DG${tag - 0x60}`)
    };
  }

  static parseSOD(data) {
    const content = this._extractContent(data);
    
    return {
      type: 'DocumentSecurityObject',
      length: content.length,
      hash: crypto.createHash('sha256').update(content).digest('hex')
    };
  }

  static _extractContent(data) {
    if (!data || data.length < 4) {
      return Buffer.alloc(0);
    }
    
    if (data[0] === 0x60 || data[0] === 0x61 || data[0] === 0x6C || data[0] === 0x7F) {
      const length = this._parseLength(data, 1);
      const offset = this._getLengthSize(data, 1) + 1;
      
      if (data[offset] === 0x5F) {
        const innerLength = this._parseLength(data, offset + 2);
        const innerOffset = offset + 2 + this._getLengthSize(data, offset + 2);
        return data.slice(innerOffset, innerOffset + innerLength);
      }
      
      return data.slice(offset, offset + length);
    }
    
    return data;
  }

  static _parseLength(data, offset) {
    if (data[offset] < 0x80) {
      return data[offset];
    }
    
    const numBytes = data[offset] & 0x7F;
    let length = 0;
    
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | data[offset + 1 + i];
    }
    
    return length;
  }

  static _getLengthSize(data, offset) {
    if (data[offset] < 0x80) {
      return 1;
    }
    
    return 1 + (data[offset] & 0x7F);
  }

  static _findJPEGStart(data) {
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i] === 0xFF && data[i + 1] === 0xD8) {
        return i;
      }
    }
    return -1;
  }

  static _parseMRZFromDG1(mrzData) {
    const lines = mrzData.trim().split(/[\r\n]+/);
    
    if (lines.length === 2 && lines[0].length === 44) {
      return this._parseTD3MRZ(lines);
    } else if (lines.length === 3 && lines[0].length === 30) {
      return this._parseTD1MRZ(lines);
    } else if (lines.length === 2 && lines[0].length === 36) {
      return this._parseTD2MRZ(lines);
    }
    
    return { raw: mrzData };
  }

  static _parseTD3MRZ(lines) {
    const line1 = lines[0];
    const line2 = lines[1];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      lastName: line1.substring(5, 44).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line1.substring(5, 44).split('<<')[1]?.replace(/</g, ' ').trim() || '',
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      nationality: line2.substring(10, 13),
      dateOfBirth: this._parseDate(line2.substring(13, 19)),
      sex: line2.charAt(20),
      dateOfExpiry: this._parseDate(line2.substring(21, 27)),
      optionalData: line2.substring(28, 42).replace(/</g, '')
    };
  }

  static _parseTD1MRZ(lines) {
    const line1 = lines[0];
    const line2 = lines[1];
    const line3 = lines[2];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      documentNumber: line1.substring(5, 14).replace(/</g, ''),
      dateOfBirth: this._parseDate(line2.substring(0, 6)),
      sex: line2.charAt(7),
      dateOfExpiry: this._parseDate(line2.substring(8, 14)),
      nationality: line2.substring(15, 18),
      lastName: line3.substring(0, 30).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line3.substring(0, 30).split('<<')[1]?.replace(/</g, ' ').trim() || ''
    };
  }

  static _parseTD2MRZ(lines) {
    const line1 = lines[0];
    const line2 = lines[1];
    
    return {
      documentType: line1.substring(0, 2).replace(/</g, ''),
      issuingCountry: line1.substring(2, 5),
      lastName: line1.substring(5, 36).split('<<')[0].replace(/</g, ' ').trim(),
      firstName: line1.substring(5, 36).split('<<')[1]?.replace(/</g, ' ').trim() || '',
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      nationality: line2.substring(10, 13),
      dateOfBirth: this._parseDate(line2.substring(13, 19)),
      sex: line2.charAt(20),
      dateOfExpiry: this._parseDate(line2.substring(21, 27)),
      optionalData: line2.substring(28, 35).replace(/</g, '')
    };
  }

  static _parseDate(dateStr) {
    const year = parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));
    
    const currentYear = new Date().getFullYear();
    const century = year <= (currentYear % 100) + 10 ? 2000 : 1900;
    
    return {
      year: century + year,
      month,
      day,
      formatted: `${century + year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  }

  static _parsePublicKey(data) {
    try {
      const keyStart = data.indexOf(Buffer.from([0x30, 0x82]));
      if (keyStart >= 0) {
        const keyLength = data.readUInt16BE(keyStart + 2) + 4;
        const keyData = data.slice(keyStart, keyStart + keyLength);
        
        return {
          format: 'DER',
          data: keyData.toString('base64'),
          length: keyLength
        };
      }
    } catch (err) {
      // Key parsing failed
    }
    
    return {
      format: 'Unknown',
      data: data.toString('base64')
    };
  }
}

export default DataGroupParser;