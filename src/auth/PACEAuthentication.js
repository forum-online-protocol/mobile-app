import crypto from 'crypto';

class PACEAuthentication {
  constructor() {
    this.domain = null;
    this.ephemeralKeys = null;
  }

  async performKeyAgreement(can, paceInfo) {
    const password = this._derivePassword(can);
    
    const nonce = await this._getNonce(password);
    
    const mapping = await this._performMapping(nonce);
    
    const ephemeralKeys = await this._performKeyAgreement(mapping);
    
    const sessionKeys = await this._deriveSessionKeys(ephemeralKeys);
    
    await this._performMutualAuthentication(sessionKeys);
    
    return sessionKeys;
  }

  _derivePassword(can) {
    const hash = crypto.createHash('sha256');
    hash.update(can, 'ascii');
    return hash.digest().slice(0, 16);
  }

  async _getNonce(password) {
    const encryptedNonce = await this._sendCommand([0x10, 0x86, 0x00, 0x00]);
    
    const decipher = crypto.createDecipheriv(
      'aes-128-cbc',
      password,
      Buffer.alloc(16)
    );
    
    return Buffer.concat([
      decipher.update(encryptedNonce),
      decipher.final()
    ]);
  }

  async _performMapping(nonce) {
    const generator = this._getGenerator();
    
    const privateKey = crypto.randomBytes(32);
    
    const publicKey = this._multiplyPoint(generator, privateKey);
    
    await this._sendCommand([0x10, 0x86, 0x00, 0x00], publicKey);
    
    const cardPublicKey = await this._sendCommand([0x10, 0x86, 0x00, 0x00]);
    
    const sharedSecret = this._multiplyPoint(cardPublicKey, privateKey);
    
    const mappedGenerator = this._addPoints(generator, sharedSecret);
    
    return {
      generator: mappedGenerator,
      sharedSecret
    };
  }

  async _performKeyAgreement(mapping) {
    const privateKey = crypto.randomBytes(32);
    
    const publicKey = this._multiplyPoint(mapping.generator, privateKey);
    
    await this._sendCommand([0x10, 0x86, 0x00, 0x00], publicKey);
    
    const cardPublicKey = await this._sendCommand([0x10, 0x86, 0x00, 0x00]);
    
    const sharedSecret = this._multiplyPoint(cardPublicKey, privateKey);
    
    return {
      publicKey,
      cardPublicKey,
      sharedSecret
    };
  }

  async _deriveSessionKeys(ephemeralKeys) {
    const kdf = crypto.createHash('sha256');
    kdf.update(ephemeralKeys.sharedSecret);
    kdf.update(Buffer.from([0x00, 0x00, 0x00, 0x01]));
    const kEnc = kdf.digest().slice(0, 16);
    
    const kdf2 = crypto.createHash('sha256');
    kdf2.update(ephemeralKeys.sharedSecret);
    kdf2.update(Buffer.from([0x00, 0x00, 0x00, 0x02]));
    const kMac = kdf2.digest().slice(0, 16);
    
    return { kEnc, kMac };
  }

  async _performMutualAuthentication(sessionKeys) {
    const token = crypto.randomBytes(8);
    
    const mac = this._calculateMAC(token, sessionKeys.kMac);
    
    const authData = Buffer.concat([token, mac]);
    
    const response = await this._sendCommand([0x00, 0x86, 0x00, 0x00], authData);
    
    const cardToken = response.slice(0, 8);
    const cardMac = response.slice(8, 16);
    
    const expectedMac = this._calculateMAC(cardToken, sessionKeys.kMac);
    
    if (!cardMac.equals(expectedMac)) {
      throw new Error('Mutual authentication failed');
    }
    
    return true;
  }

  _calculateMAC(data, key) {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest().slice(0, 8);
  }

  _getGenerator() {
    return Buffer.from([
      0x04,
      0x6B, 0x17, 0xD1, 0xF2, 0xE1, 0x2C, 0x42, 0x47,
      0xF8, 0xBC, 0xE6, 0xE5, 0x63, 0xA4, 0x40, 0xF2,
      0x77, 0x03, 0x7D, 0x81, 0x2D, 0xEB, 0x33, 0xA0,
      0xF4, 0xA1, 0x39, 0x45, 0xD8, 0x98, 0xC2, 0x96,
      0x4F, 0xE3, 0x42, 0xE2, 0xFE, 0x1A, 0x7F, 0x9B,
      0x8E, 0xE7, 0xEB, 0x4A, 0x7C, 0x0F, 0x9E, 0x16,
      0x2B, 0xCE, 0x33, 0x57, 0x6B, 0x31, 0x5E, 0xCE,
      0xCB, 0xB6, 0x40, 0x68, 0x37, 0xBF, 0x51, 0xF5
    ]);
  }

  _multiplyPoint(point, scalar) {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(scalar);
    
    const publicKey = ecdh.computeSecret(point);
    
    return publicKey;
  }

  _addPoints(point1, point2) {
    const x1 = point1.slice(1, 33);
    const y1 = point1.slice(33, 65);
    const x2 = point2.slice(1, 33);
    const y2 = point2.slice(33, 65);
    
    const x3 = Buffer.alloc(32);
    const y3 = Buffer.alloc(32);
    
    for (let i = 0; i < 32; i++) {
      x3[i] = x1[i] ^ x2[i];
      y3[i] = y1[i] ^ y2[i];
    }
    
    return Buffer.concat([Buffer.from([0x04]), x3, y3]);
  }

  async _sendCommand(header, data) {
    return Buffer.alloc(0);
  }
}

export default PACEAuthentication;