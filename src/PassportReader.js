import { NFC } from 'nfc-pcsc';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import MRZParser from './utils/MRZParser.js';
import DataGroupParser from './utils/DataGroupParser.js';
import BACAuthentication from './auth/BACAuthentication.js';
import PACEAuthentication from './auth/PACEAuthentication.js';
import { APDU_COMMANDS, TAG_TYPES } from './constants/index.js';

class PassportReader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      debug: options.debug || false,
      authMethod: options.authMethod || 'auto',
      timeout: options.timeout || 10000,
      ...options
    };
    
    this.nfc = new NFC();
    this.currentReader = null;
    this.currentCard = null;
    this.sessionKeys = null;
    this.isAuthenticated = false;
    
    this._initializeNFC();
  }

  _initializeNFC() {
    this.nfc.on('reader', reader => {
      this.emit('reader:connected', reader.name);
      
      reader.on('card', async card => {
        this.currentCard = card;
        this.currentReader = reader;
        this.emit('card:detected', {
          atr: card.atr.toString('hex'),
          uid: card.uid
        });
        
        if (this.options.autoRead) {
          await this.readPassport();
        }
      });
      
      reader.on('card.off', card => {
        this.currentCard = null;
        this.isAuthenticated = false;
        this.sessionKeys = null;
        this.emit('card:removed');
      });
      
      reader.on('error', err => {
        this.emit('error', err);
      });
    });
    
    this.nfc.on('error', err => {
      this.emit('error', err);
    });
  }

  async readPassport(mrzData = null) {
    if (!this.currentCard || !this.currentReader) {
      throw new Error('No card detected');
    }
    
    try {
      await this.selectApplication();
      
      if (mrzData) {
        await this.authenticate(mrzData);
      }
      
      const passportData = await this.readDataGroups();
      
      this.emit('passport:read', passportData);
      return passportData;
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async selectApplication() {
    const SELECT_APP = Buffer.from([
      0x00, 0xA4, 0x04, 0x0C, 0x07,
      0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01
    ]);
    
    const response = await this.sendCommand(SELECT_APP);
    
    if (!this._checkResponse(response)) {
      throw new Error('Failed to select passport application');
    }
    
    return response;
  }

  async authenticate(mrzData) {
    const mrzInfo = typeof mrzData === 'string' 
      ? MRZParser.parse(mrzData)
      : mrzData;
    
    if (this.options.authMethod === 'pace' || 
        (this.options.authMethod === 'auto' && await this._supportsPACE())) {
      await this._authenticatePACE(mrzInfo);
    } else {
      await this._authenticateBAC(mrzInfo);
    }
    
    this.isAuthenticated = true;
    this.emit('authenticated');
  }

  async _authenticateBAC(mrzInfo) {
    const bac = new BACAuthentication();
    
    const kSeed = bac.generateKSeed(
      mrzInfo.documentNumber,
      mrzInfo.dateOfBirth,
      mrzInfo.dateOfExpiry
    );
    
    const keys = bac.deriveKeys(kSeed);
    
    const challenge = await this._getChallenge();
    
    const response = await this._mutualAuthenticate(challenge, keys);
    
    this.sessionKeys = bac.deriveSessionKeys(response);
    
    return this.sessionKeys;
  }

  async _authenticatePACE(mrzInfo) {
    const pace = new PACEAuthentication();
    
    const can = mrzInfo.documentNumber.substring(0, 6);
    
    const paceInfo = await this._getPACEInfo();
    
    const ephemeralKeys = await pace.performKeyAgreement(
      can,
      paceInfo
    );
    
    this.sessionKeys = ephemeralKeys;
    
    return this.sessionKeys;
  }

  async _getChallenge() {
    const GET_CHALLENGE = Buffer.from([
      0x00, 0x84, 0x00, 0x00, 0x08
    ]);
    
    const response = await this.sendCommand(GET_CHALLENGE);
    
    if (!this._checkResponse(response)) {
      throw new Error('Failed to get challenge');
    }
    
    return response.slice(0, 8);
  }

  async _mutualAuthenticate(challenge, keys) {
    const cmdData = this._buildAuthCommand(challenge, keys);
    
    const MUTUAL_AUTH = Buffer.concat([
      Buffer.from([0x00, 0x82, 0x00, 0x00, cmdData.length]),
      cmdData,
      Buffer.from([0x28])
    ]);
    
    const response = await this.sendCommand(MUTUAL_AUTH);
    
    if (!this._checkResponse(response)) {
      throw new Error('Mutual authentication failed');
    }
    
    return response;
  }

  async readDataGroups() {
    const dataGroups = {};
    
    const dgMap = {
      1: 'MRZ',
      2: 'Face',
      3: 'Fingerprints',
      4: 'Iris',
      5: 'Portrait',
      6: 'Reserved',
      7: 'Signature',
      8: 'DataNotInOtherDGs',
      9: 'StructureFeatures',
      10: 'SubstanceFeatures',
      11: 'AdditionalPersonalDetails',
      12: 'AdditionalDocumentDetails',
      13: 'OptionalDetails',
      14: 'SecurityOptions',
      15: 'ActiveAuthentication',
      16: 'PersonsToNotify'
    };
    
    const com = await this.readFile(0x011E);
    const sod = await this.readFile(0x011D);
    
    dataGroups.COM = DataGroupParser.parseCOM(com);
    dataGroups.SOD = DataGroupParser.parseSOD(sod);
    
    for (const [dgNum, dgName] of Object.entries(dgMap)) {
      try {
        const fileId = 0x0100 + parseInt(dgNum);
        const data = await this.readFile(fileId);
        
        if (data && data.length > 0) {
          dataGroups[`DG${dgNum}`] = {
            name: dgName,
            raw: data,
            parsed: DataGroupParser.parse(dgNum, data)
          };
        }
      } catch (error) {
        if (this.options.debug) {
          console.log(`Could not read DG${dgNum}: ${error.message}`);
        }
      }
    }
    
    return dataGroups;
  }

  async readFile(fileId) {
    const SELECT_FILE = Buffer.concat([
      Buffer.from([0x00, 0xA4, 0x02, 0x0C, 0x02]),
      Buffer.from([(fileId >> 8) & 0xFF, fileId & 0xFF])
    ]);
    
    const selectResponse = await this.sendCommand(SELECT_FILE);
    
    if (!this._checkResponse(selectResponse)) {
      throw new Error(`Failed to select file ${fileId.toString(16)}`);
    }
    
    let offset = 0;
    let fileData = Buffer.alloc(0);
    
    while (true) {
      const READ_BINARY = Buffer.from([
        0x00, 0xB0,
        (offset >> 8) & 0xFF,
        offset & 0xFF,
        0x00
      ]);
      
      const response = await this.sendCommand(READ_BINARY);
      
      if (!response || response.length <= 2) {
        break;
      }
      
      const data = response.slice(0, -2);
      fileData = Buffer.concat([fileData, data]);
      
      if (response.length < 258) {
        break;
      }
      
      offset += data.length;
    }
    
    return fileData;
  }

  async sendCommand(apdu) {
    if (!this.currentReader || !this.currentCard) {
      throw new Error('No card connected');
    }
    
    let commandAPDU = apdu;
    
    if (this.isAuthenticated && this.sessionKeys) {
      commandAPDU = this._secureMessaging(apdu);
    }
    
    if (this.options.debug) {
      console.log('>> APDU:', commandAPDU.toString('hex'));
    }
    
    const response = await this.currentReader.transmit(
      commandAPDU,
      40000,
      2
    );
    
    if (this.options.debug) {
      console.log('<< Response:', response.toString('hex'));
    }
    
    return response;
  }

  _secureMessaging(apdu) {
    if (!this.sessionKeys) {
      return apdu;
    }
    
    const { kEnc, kMac } = this.sessionKeys;
    
    const paddedData = this._padData(apdu);
    
    const encryptedData = this._encrypt3DES(paddedData, kEnc);
    
    const mac = this._calculateMAC(encryptedData, kMac);
    
    return Buffer.concat([encryptedData, mac]);
  }

  _padData(data) {
    const blockSize = 8;
    const padLength = blockSize - (data.length % blockSize);
    const padding = Buffer.alloc(padLength, 0x80);
    padding[0] = 0x80;
    
    return Buffer.concat([data, padding]);
  }

  _encrypt3DES(data, key) {
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, Buffer.alloc(8));
    return Buffer.concat([cipher.update(data), cipher.final()]);
  }

  _calculateMAC(data, key) {
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, Buffer.alloc(8));
    cipher.update(data);
    const mac = cipher.final();
    return mac.slice(0, 8);
  }

  _buildAuthCommand(challenge, keys) {
    const { kEnc, kMac } = keys;
    
    const rndIFD = crypto.randomBytes(8);
    const kIFD = crypto.randomBytes(16);
    
    const S = Buffer.concat([rndIFD, challenge, kIFD]);
    
    const encryptedS = this._encrypt3DES(S, kEnc);
    
    const mac = this._calculateMAC(encryptedS, kMac);
    
    return Buffer.concat([encryptedS, mac]);
  }

  _checkResponse(response) {
    if (!response || response.length < 2) {
      return false;
    }
    
    const sw1 = response[response.length - 2];
    const sw2 = response[response.length - 1];
    
    return sw1 === 0x90 && sw2 === 0x00;
  }

  async _supportsPACE() {
    try {
      const paceInfo = await this._getPACEInfo();
      return !!paceInfo;
    } catch {
      return false;
    }
  }

  async _getPACEInfo() {
    const GET_PACE_INFO = Buffer.from([
      0x00, 0xA4, 0x04, 0x0C, 0x08,
      0xA0, 0x00, 0x00, 0x02, 0x47, 0x20, 0x01, 0x01
    ]);
    
    const response = await this.sendCommand(GET_PACE_INFO);
    
    if (!this._checkResponse(response)) {
      throw new Error('PACE not supported');
    }
    
    return response.slice(0, -2);
  }

  async verifyPIN(pin) {
    const pinBytes = Buffer.from(pin, 'ascii');
    
    const VERIFY_PIN = Buffer.concat([
      Buffer.from([0x00, 0x20, 0x00, 0x00, pinBytes.length]),
      pinBytes
    ]);
    
    const response = await this.sendCommand(VERIFY_PIN);
    
    if (!this._checkResponse(response)) {
      const sw2 = response[response.length - 1];
      const remaining = sw2 & 0x0F;
      
      throw new Error(`PIN verification failed. ${remaining} attempts remaining`);
    }
    
    return true;
  }

  async performActiveAuthentication(challenge = null) {
    if (!challenge) {
      challenge = crypto.randomBytes(8);
    }
    
    const INTERNAL_AUTH = Buffer.concat([
      Buffer.from([0x00, 0x88, 0x00, 0x00, challenge.length]),
      challenge,
      Buffer.from([0x00])
    ]);
    
    const response = await this.sendCommand(INTERNAL_AUTH);
    
    if (!this._checkResponse(response)) {
      throw new Error('Active authentication failed');
    }
    
    return response.slice(0, -2);
  }

  disconnect() {
    this.currentCard = null;
    this.currentReader = null;
    this.isAuthenticated = false;
    this.sessionKeys = null;
  }

  destroy() {
    this.disconnect();
    this.removeAllListeners();
  }
}

export default PassportReader;