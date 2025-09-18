import { EventEmitter } from 'events';
import NFCTag from '../models/NFCTag.js';

let NFC;
try {
  NFC = (await import('nfc-pcsc')).default;
} catch {
  NFC = null;
}

class PCScAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.nfc = null;
    this.readers = new Map();
    this.isConnected = false;
  }

  async connect() {
    if (!NFC) {
      throw new Error('nfc-pcsc module not available. Install it with: npm install nfc-pcsc');
    }
    
    this.nfc = new NFC();
    
    this.nfc.on('reader', reader => {
      this._handleReaderConnection(reader);
    });
    
    this.nfc.on('error', err => {
      this.emit('error', err);
    });
    
    this.isConnected = true;
    this.emit('reader-connected');
  }

  _handleReaderConnection(reader) {
    this.readers.set(reader.name, reader);
    
    reader.on('card', card => {
      const tag = this._createTagFromCard(card);
      this.emit('tag-discovered', tag);
    });
    
    reader.on('card.off', card => {
      const uid = this._getUidFromCard(card);
      this.emit('tag-removed', uid);
    });
    
    reader.on('error', err => {
      this.emit('error', new Error(`Reader ${reader.name}: ${err.message}`));
    });
    
    reader.on('end', () => {
      this.readers.delete(reader.name);
      if (this.readers.size === 0) {
        this.emit('reader-disconnected');
      }
    });
  }

  async disconnect() {
    for (const [name, reader] of this.readers) {
      try {
        reader.close();
      } catch (error) {
        console.error(`Error closing reader ${name}:`, error);
      }
    }
    
    this.readers.clear();
    this.nfc = null;
    this.isConnected = false;
    this.emit('reader-disconnected');
  }

  async startScanning() {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  async stopScanning() {
    
  }

  async read(tag) {
    const reader = this._getReaderForTag(tag);
    if (!reader) {
      throw new Error('No reader available for tag');
    }
    
    const blockSize = this._getBlockSize(tag);
    const blocks = [];
    
    try {
      for (let i = 0; i < tag.capacity / blockSize; i++) {
        const data = await reader.read(i, blockSize);
        blocks.push(data);
      }
      
      return { blocks };
    } catch (error) {
      throw new Error(`Failed to read tag: ${error.message}`);
    }
  }

  async write(tag, data) {
    const reader = this._getReaderForTag(tag);
    if (!reader) {
      throw new Error('No reader available for tag');
    }
    
    const blockSize = this._getBlockSize(tag);
    
    try {
      if (data.blocks) {
        for (let i = 0; i < data.blocks.length; i++) {
          await reader.write(i, data.blocks[i], blockSize);
        }
      } else if (data.records) {
        const ndefData = this._encodeNDEF(data.records);
        await reader.write(4, ndefData, blockSize);
      }
    } catch (error) {
      throw new Error(`Failed to write tag: ${error.message}`);
    }
  }

  async format(tag) {
    const reader = this._getReaderForTag(tag);
    if (!reader) {
      throw new Error('No reader available for tag');
    }
    
    const blockSize = this._getBlockSize(tag);
    const emptyBlock = Buffer.alloc(blockSize);
    
    try {
      for (let i = 4; i < tag.capacity / blockSize; i++) {
        await reader.write(i, emptyBlock, blockSize);
      }
    } catch (error) {
      throw new Error(`Failed to format tag: ${error.message}`);
    }
  }

  async lock(tag, options = {}) {
    const reader = this._getReaderForTag(tag);
    if (!reader) {
      throw new Error('No reader available for tag');
    }
    
    try {
      if (tag.isMifareClassic()) {
        await this._lockMifareClassic(reader, tag, options);
      } else if (tag.isNTAG()) {
        await this._lockNTAG(reader, tag, options);
      } else {
        throw new Error('Lock not supported for this tag type');
      }
    } catch (error) {
      throw new Error(`Failed to lock tag: ${error.message}`);
    }
  }

  async sendCommand(tag, command, data) {
    const reader = this._getReaderForTag(tag);
    if (!reader) {
      throw new Error('No reader available for tag');
    }
    
    try {
      const response = await reader.transmit(Buffer.from(command), 40, 2);
      return response;
    } catch (error) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  async getInfo() {
    const readerList = Array.from(this.readers.keys());
    
    return {
      adapter: 'PC/SC',
      version: '1.0',
      capabilities: [
        'READ', 'WRITE', 'FORMAT', 'LOCK',
        'RAW_COMMANDS', 'MIFARE', 'NTAG', 'DESFIRE'
      ],
      readers: readerList,
      isAvailable: !!NFC
    };
  }

  _createTagFromCard(card) {
    const tag = new NFCTag({
      uid: this._getUidFromCard(card),
      type: this._detectCardType(card),
      standard: card.standard || 'ISO14443',
      capacity: this._getCardCapacity(card)
    });
    
    if (card.atr) {
      tag.parseATR(card.atr);
    }
    
    return tag;
  }

  _getUidFromCard(card) {
    if (card.uid) {
      return typeof card.uid === 'string' 
        ? card.uid 
        : Buffer.from(card.uid).toString('hex');
    }
    return null;
  }

  _detectCardType(card) {
    const atr = card.atr;
    
    if (!atr) return 'UNKNOWN';
    
    const atrString = Buffer.from(atr).toString('hex').toUpperCase();
    
    if (atrString.includes('0001') || atrString.includes('0002')) {
      return 'MIFARE_CLASSIC_1K';
    } else if (atrString.includes('0003') || atrString.includes('0004')) {
      return 'MIFARE_CLASSIC_4K';
    } else if (atrString.includes('0044')) {
      return 'MIFARE_ULTRALIGHT';
    } else if (atrString.includes('F011')) {
      return 'NTAG213';
    } else if (atrString.includes('F012')) {
      return 'NTAG215';
    } else if (atrString.includes('F013')) {
      return 'NTAG216';
    } else if (atrString.includes('4403')) {
      return 'DESFIRE';
    }
    
    return 'GENERIC_ISO14443';
  }

  _getCardCapacity(card) {
    const type = this._detectCardType(card);
    
    const capacities = {
      'MIFARE_CLASSIC_1K': 1024,
      'MIFARE_CLASSIC_4K': 4096,
      'MIFARE_ULTRALIGHT': 64,
      'NTAG213': 180,
      'NTAG215': 504,
      'NTAG216': 888,
      'DESFIRE': 8192
    };
    
    return capacities[type] || 1024;
  }

  _getBlockSize(tag) {
    if (tag.isMifareClassic()) return 16;
    if (tag.isMifareUltralight() || tag.isNTAG()) return 4;
    if (tag.isDESFire()) return 32;
    return 16;
  }

  _getReaderForTag(tag) {
    if (this.readers.size === 0) return null;
    return this.readers.values().next().value;
  }

  async _lockMifareClassic(reader, tag, options) {
    const accessBits = options.accessBits || [0xFF, 0x07, 0x80, 0x69];
    const keyA = options.keyA || Buffer.alloc(6, 0xFF);
    const keyB = options.keyB || Buffer.alloc(6, 0xFF);
    
    const trailerBlock = Buffer.concat([keyA, Buffer.from(accessBits), keyB]);
    
    for (let sector = 0; sector < 16; sector++) {
      const blockNumber = sector * 4 + 3;
      await reader.write(blockNumber, trailerBlock, 16);
    }
  }

  async _lockNTAG(reader, tag, options) {
    const lockBytes = options.lockBytes || [0x00, 0x00, 0xFF, 0xFF];
    await reader.write(2, Buffer.from(lockBytes), 4);
  }

  _encodeNDEF(records) {
    let data = Buffer.alloc(0);
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const isFirst = i === 0;
      const isLast = i === records.length - 1;
      
      let flags = 0;
      if (isFirst) flags |= 0x80;
      if (isLast) flags |= 0x40;
      flags |= 0x10;
      
      const typeLength = record.type ? record.type.length : 0;
      const payloadLength = record.payload ? record.payload.length : 0;
      
      const header = Buffer.from([
        flags,
        typeLength,
        payloadLength
      ]);
      
      const type = record.type ? Buffer.from(record.type) : Buffer.alloc(0);
      const payload = record.payload || Buffer.alloc(0);
      
      data = Buffer.concat([data, header, type, payload]);
    }
    
    return data;
  }

  setDebug(enabled) {
    this.options.debug = enabled;
  }

  destroy() {
    this.disconnect();
    this.removeAllListeners();
  }
}

export default PCScAdapter;