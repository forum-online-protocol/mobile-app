import crypto from 'crypto';

class BACAuthentication {
  constructor() {
    this.KENC_CONST = Buffer.from('00000001', 'hex');
    this.KMAC_CONST = Buffer.from('00000002', 'hex');
  }

  generateKSeed(documentNumber, dateOfBirth, dateOfExpiry) {
    const docNum = this._padString(documentNumber, 9);
    const dob = this._formatDate(dateOfBirth);
    const exp = this._formatDate(dateOfExpiry);
    
    const docNumWithCheck = docNum + this._calculateCheckDigit(docNum);
    const dobWithCheck = dob + this._calculateCheckDigit(dob);
    const expWithCheck = exp + this._calculateCheckDigit(exp);
    
    const mrzInfo = docNumWithCheck + dobWithCheck + expWithCheck;
    
    const hash = crypto.createHash('sha1');
    hash.update(mrzInfo, 'ascii');
    const kSeed = hash.digest().slice(0, 16);
    
    return kSeed;
  }

  deriveKeys(kSeed) {
    const kEnc = this._derive3DESKey(kSeed, this.KENC_CONST);
    const kMac = this._derive3DESKey(kSeed, this.KMAC_CONST);
    
    return { kEnc, kMac };
  }

  deriveSessionKeys(mutualAuthResponse) {
    const data = mutualAuthResponse.slice(0, -2);
    
    const decrypted = this._decrypt3DES(data, this.tempKEnc);
    
    const kICC = decrypted.slice(16, 32);
    const kIFD = this.tempKIFD;
    
    const kSeed = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      kSeed[i] = kICC[i] ^ kIFD[i];
    }
    
    const ksEnc = this._derive3DESKey(kSeed, this.KENC_CONST);
    const ksMac = this._derive3DESKey(kSeed, this.KMAC_CONST);
    
    const ssc = Buffer.concat([
      decrypted.slice(4, 8),
      decrypted.slice(12, 16)
    ]);
    
    return { ksEnc, ksMac, ssc };
  }

  _derive3DESKey(kSeed, c) {
    const d = Buffer.concat([kSeed, c]);
    
    const hash = crypto.createHash('sha1');
    hash.update(d);
    const h = hash.digest();
    
    const ka = h.slice(0, 8);
    const kb = h.slice(8, 16);
    
    const key = Buffer.concat([ka, kb, ka]);
    
    this._adjustParity(key);
    
    return key;
  }

  _adjustParity(key) {
    for (let i = 0; i < key.length; i++) {
      let byte = key[i];
      let parity = 0;
      
      for (let j = 0; j < 8; j++) {
        parity += (byte >> j) & 1;
      }
      
      if (parity % 2 === 0) {
        key[i] ^= 1;
      }
    }
  }

  _padString(str, length) {
    if (str.length >= length) {
      return str.substring(0, length);
    }
    return str + '<'.repeat(length - str.length);
  }

  _formatDate(date) {
    if (typeof date === 'string') {
      return date.replace(/-/g, '').substring(2, 8);
    } else if (date && date.formatted) {
      return date.formatted.replace(/-/g, '').substring(2, 8);
    } else {
      const year = String(date.year).slice(-2);
      const month = String(date.month).padStart(2, '0');
      const day = String(date.day).padStart(2, '0');
      return year + month + day;
    }
  }

  _calculateCheckDigit(data) {
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
    
    return String(sum % 10);
  }

  _encrypt3DES(data, key) {
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, Buffer.alloc(8));
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(data), cipher.final()]);
  }

  _decrypt3DES(data, key) {
    const decipher = crypto.createDecipheriv('des-ede3-cbc', key, Buffer.alloc(8));
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  calculateMAC(data, key, ssc) {
    const macInput = Buffer.concat([ssc, data]);
    
    const padded = this._padForMAC(macInput);
    
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, Buffer.alloc(8));
    cipher.setAutoPadding(false);
    const encrypted = cipher.update(padded);
    cipher.final();
    
    return encrypted.slice(-8);
  }

  _padForMAC(data) {
    const blockSize = 8;
    const padLength = blockSize - (data.length % blockSize);
    
    if (padLength === blockSize && data.length > 0) {
      return data;
    }
    
    const padding = Buffer.alloc(padLength);
    padding[0] = 0x80;
    
    return Buffer.concat([data, padding]);
  }

  encryptData(data, key, ssc) {
    const padded = this._padForEncryption(data);
    
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, ssc);
    cipher.setAutoPadding(false);
    
    return Buffer.concat([cipher.update(padded), cipher.final()]);
  }

  decryptData(data, key, ssc) {
    const decipher = crypto.createDecipheriv('des-ede3-cbc', key, ssc);
    decipher.setAutoPadding(false);
    
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    
    return this._removePadding(decrypted);
  }

  _padForEncryption(data) {
    const blockSize = 8;
    const padLength = blockSize - ((data.length + 1) % blockSize);
    
    const padding = Buffer.alloc(padLength + 1);
    padding[0] = 0x80;
    
    return Buffer.concat([data, padding]);
  }

  _removePadding(data) {
    let i = data.length - 1;
    
    while (i >= 0 && data[i] === 0x00) {
      i--;
    }
    
    if (i >= 0 && data[i] === 0x80) {
      return data.slice(0, i);
    }
    
    return data;
  }
}

export default BACAuthentication;