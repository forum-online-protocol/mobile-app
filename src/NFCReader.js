import { NFC } from 'nfc-pcsc';
import { EventEmitter } from 'events';
import ndef from 'ndef';

class NFCReader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      debug: options.debug || false,
      autoProcess: options.autoProcess !== false,
      ...options
    };
    
    this.nfc = new NFC();
    this.readers = new Map();
    
    this._initialize();
  }

  _initialize() {
    this.nfc.on('reader', reader => {
      this.readers.set(reader.name, reader);
      this.emit('reader:connected', reader.name);
      
      reader.on('card', async card => {
        const tagInfo = {
          uid: card.uid,
          atr: card.atr?.toString('hex'),
          type: this._detectCardType(card),
          reader: reader.name
        };
        
        this.emit('tag:discovered', tagInfo);
        
        if (this.options.autoProcess) {
          try {
            const data = await this.readTag(reader, card);
            this.emit('tag:read', { ...tagInfo, data });
          } catch (error) {
            this.emit('error', error);
          }
        }
      });
      
      reader.on('card.off', card => {
        this.emit('tag:removed', {
          uid: card.uid,
          reader: reader.name
        });
      });
      
      reader.on('error', err => {
        this.emit('error', err);
      });
      
      reader.on('end', () => {
        this.readers.delete(reader.name);
        this.emit('reader:disconnected', reader.name);
      });
    });
    
    this.nfc.on('error', err => {
      this.emit('error', err);
    });
  }

  async readTag(reader, card) {
    const type = this._detectCardType(card);
    
    switch (type) {
      case 'MIFARE_CLASSIC':
        return await this._readMifareClassic(reader, card);
      case 'MIFARE_ULTRALIGHT':
        return await this._readMifareUltralight(reader, card);
      case 'NTAG':
        return await this._readNTAG(reader, card);
      case 'DESFIRE':
        return await this._readDESFire(reader, card);
      default:
        return await this._readGeneric(reader, card);
    }
  }

  async _readMifareClassic(reader, card) {
    const data = {
      type: 'MIFARE_CLASSIC',
      sectors: []
    };
    
    const key = Buffer.from('FFFFFFFFFFFF', 'hex');
    const blockSize = 16;
    const numSectors = card.atr[14] === 0x01 ? 16 : 40;
    
    for (let sector = 0; sector < numSectors; sector++) {
      try {
        await reader.authenticate(sector * 4, 0x60, key);
        
        const sectorData = {
          number: sector,
          blocks: []
        };
        
        const blocksInSector = sector < 32 ? 4 : 16;
        
        for (let block = 0; block < blocksInSector; block++) {
          const blockNumber = sector < 32 
            ? sector * 4 + block 
            : 128 + (sector - 32) * 16 + block;
          
          try {
            const blockData = await reader.read(blockNumber, blockSize);
            sectorData.blocks.push({
              number: blockNumber,
              data: blockData.toString('hex'),
              ascii: this._toAscii(blockData)
            });
          } catch (err) {
            sectorData.blocks.push({
              number: blockNumber,
              error: err.message
            });
          }
        }
        
        data.sectors.push(sectorData);
      } catch (err) {
        data.sectors.push({
          number: sector,
          error: 'Authentication failed'
        });
      }
    }
    
    return data;
  }

  async _readMifareUltralight(reader, card) {
    const data = {
      type: 'MIFARE_ULTRALIGHT',
      pages: []
    };
    
    const pageSize = 4;
    const numPages = 16;
    
    for (let page = 0; page < numPages; page++) {
      try {
        const pageData = await reader.read(page, pageSize);
        data.pages.push({
          number: page,
          data: pageData.toString('hex'),
          ascii: this._toAscii(pageData)
        });
      } catch (err) {
        data.pages.push({
          number: page,
          error: err.message
        });
      }
    }
    
    try {
      const ndefData = await this._readNDEF(reader, 4, 12);
      if (ndefData) {
        data.ndef = ndefData;
      }
    } catch (err) {
      // NDEF not present or readable
    }
    
    return data;
  }

  async _readNTAG(reader, card) {
    const data = {
      type: 'NTAG',
      pages: [],
      info: {}
    };
    
    const pageSize = 4;
    const tagType = this._getNTAGType(card);
    const numPages = this._getNTAGPageCount(tagType);
    
    data.info.tagType = tagType;
    data.info.totalMemory = numPages * pageSize;
    
    for (let page = 0; page < Math.min(numPages, 60); page++) {
      try {
        const pageData = await reader.read(page, pageSize);
        data.pages.push({
          number: page,
          data: pageData.toString('hex'),
          ascii: this._toAscii(pageData)
        });
      } catch (err) {
        break;
      }
    }
    
    try {
      const ndefData = await this._readNDEF(reader, 4, numPages - 5);
      if (ndefData) {
        data.ndef = ndefData;
      }
    } catch (err) {
      // NDEF not present or readable
    }
    
    try {
      const cc = await reader.read(3, 4);
      data.info.capabilityContainer = {
        magic: cc[0],
        version: cc[1],
        memorySize: cc[2] * 8,
        access: cc[3]
      };
    } catch (err) {
      // CC not readable
    }
    
    return data;
  }

  async _readDESFire(reader, card) {
    const data = {
      type: 'DESFIRE',
      info: {},
      applications: []
    };
    
    try {
      const SELECT_APP = Buffer.from([0x5A, 0x00, 0x00, 0x00]);
      await reader.transmit(SELECT_APP, 40);
      
      const GET_VERSION = Buffer.from([0x60]);
      const version = await reader.transmit(GET_VERSION, 40);
      
      data.info = {
        hardwareVendor: version[0],
        hardwareType: version[1],
        hardwareSubtype: version[2],
        hardwareMajor: version[3],
        hardwareMinor: version[4],
        hardwareStorage: version[5],
        hardwareProtocol: version[6],
        softwareVendor: version[7],
        softwareType: version[8],
        softwareSubtype: version[9],
        softwareMajor: version[10],
        softwareMinor: version[11],
        softwareStorage: version[12],
        softwareProtocol: version[13]
      };
      
      const GET_APP_IDS = Buffer.from([0x6A]);
      const apps = await reader.transmit(GET_APP_IDS, 40);
      
      for (let i = 0; i < apps.length; i += 3) {
        const appId = apps.slice(i, i + 3);
        data.applications.push({
          id: appId.toString('hex')
        });
      }
    } catch (err) {
      data.error = 'Failed to read DESFire data';
    }
    
    return data;
  }

  async _readGeneric(reader, card) {
    const data = {
      type: 'GENERIC',
      blocks: []
    };
    
    for (let block = 0; block < 16; block++) {
      try {
        const blockData = await reader.read(block, 16);
        data.blocks.push({
          number: block,
          data: blockData.toString('hex'),
          ascii: this._toAscii(blockData)
        });
      } catch (err) {
        break;
      }
    }
    
    return data;
  }

  async _readNDEF(reader, startPage, endPage) {
    let ndefData = Buffer.alloc(0);
    
    for (let page = startPage; page <= endPage; page++) {
      try {
        const pageData = await reader.read(page, 4);
        ndefData = Buffer.concat([ndefData, pageData]);
      } catch (err) {
        break;
      }
    }
    
    try {
      const messages = ndef.decodeMessage(ndefData);
      return messages.map(record => ({
        tnf: record.tnf,
        type: record.type?.toString(),
        id: record.id?.toString(),
        payload: record.payload?.toString(),
        value: this._parseNDEFRecord(record)
      }));
    } catch (err) {
      return null;
    }
  }

  _parseNDEFRecord(record) {
    try {
      if (record.type?.toString() === 'U') {
        const uri = ndef.Utils.resolveUriString(record.payload);
        return { type: 'uri', uri };
      } else if (record.type?.toString() === 'T') {
        const text = ndef.Utils.resolveTextRecord(record.payload);
        return { type: 'text', text };
      } else {
        return { type: 'unknown', data: record.payload?.toString('hex') };
      }
    } catch (err) {
      return null;
    }
  }

  async writeNDEF(readerName, records) {
    const reader = this.readers.get(readerName);
    if (!reader) {
      throw new Error('Reader not found');
    }
    
    const message = records.map(record => {
      if (record.type === 'uri') {
        return ndef.Utils.createUriRecord(record.uri);
      } else if (record.type === 'text') {
        return ndef.Utils.createTextRecord(record.text, record.language || 'en');
      } else {
        return record;
      }
    });
    
    const data = ndef.encodeMessage(message);
    
    let offset = 4;
    const pageSize = 4;
    
    for (let i = 0; i < data.length; i += pageSize) {
      const page = Math.floor(i / pageSize) + offset;
      const pageData = data.slice(i, i + pageSize);
      
      if (pageData.length < pageSize) {
        const padded = Buffer.alloc(pageSize);
        pageData.copy(padded);
        await reader.write(page, padded);
      } else {
        await reader.write(page, pageData);
      }
    }
    
    return true;
  }

  _detectCardType(card) {
    const atr = card.atr;
    if (!atr) return 'UNKNOWN';
    
    const atrHex = atr.toString('hex').toUpperCase();
    
    if (atrHex.includes('000306')) return 'MIFARE_CLASSIC';
    if (atrHex.includes('000318')) return 'MIFARE_CLASSIC_4K';
    if (atrHex.includes('000344')) return 'MIFARE_ULTRALIGHT';
    if (atrHex.includes('F011') || atrHex.includes('F012') || atrHex.includes('F013')) return 'NTAG';
    if (atrHex.includes('4403')) return 'DESFIRE';
    
    return 'GENERIC';
  }

  _getNTAGType(card) {
    const atr = card.atr?.toString('hex').toUpperCase();
    if (!atr) return 'NTAG_UNKNOWN';
    
    if (atr.includes('F011')) return 'NTAG213';
    if (atr.includes('F012')) return 'NTAG215';
    if (atr.includes('F013')) return 'NTAG216';
    
    return 'NTAG_UNKNOWN';
  }

  _getNTAGPageCount(type) {
    const pageCounts = {
      'NTAG213': 45,
      'NTAG215': 135,
      'NTAG216': 231,
      'NTAG_UNKNOWN': 60
    };
    
    return pageCounts[type] || 60;
  }

  _toAscii(buffer) {
    return buffer.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
  }

  getReaders() {
    return Array.from(this.readers.keys());
  }

  destroy() {
    this.readers.clear();
    this.removeAllListeners();
  }
}

export default NFCReader;