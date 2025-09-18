import { EventEmitter } from 'events';
import NFCTag from '../models/NFCTag.js';

class WebNFCAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.reader = null;
    this.controller = null;
    this.isScanning = false;
  }

  async connect() {
    if (!('NDEFReader' in window)) {
      throw new Error('Web NFC API is not available in this browser');
    }
    
    const permissionStatus = await navigator.permissions.query({ name: 'nfc' });
    if (permissionStatus.state === 'denied') {
      throw new Error('NFC permission denied');
    }
    
    this.reader = new NDEFReader();
    this.emit('reader-connected');
  }

  async disconnect() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.reader = null;
    this.emit('reader-disconnected');
  }

  async startScanning() {
    if (!this.reader) {
      throw new Error('Reader not connected');
    }
    
    if (this.isScanning) {
      return;
    }
    
    this.controller = new AbortController();
    
    this.reader.addEventListener('reading', ({ message, serialNumber }) => {
      const tag = this._createTagFromNDEF(message, serialNumber);
      this.emit('tag-discovered', tag);
    });
    
    this.reader.addEventListener('readingerror', () => {
      this.emit('error', new Error('NFC reading error'));
    });
    
    try {
      await this.reader.scan({ signal: this.controller.signal });
      this.isScanning = true;
    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
    }
  }

  async stopScanning() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.isScanning = false;
  }

  async read(tag) {
    if (!this.reader) {
      throw new Error('Reader not connected');
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Read timeout'));
      }, 5000);
      
      const handleReading = ({ message, serialNumber }) => {
        if (serialNumber === tag.uid) {
          clearTimeout(timeout);
          this.reader.removeEventListener('reading', handleReading);
          resolve(this._parseNDEFMessage(message));
        }
      };
      
      this.reader.addEventListener('reading', handleReading);
    });
  }

  async write(tag, data) {
    if (!this.reader) {
      throw new Error('Reader not connected');
    }
    
    const records = this._createNDEFRecords(data);
    
    try {
      await this.reader.write({ records });
    } catch (error) {
      throw new Error(`Failed to write: ${error.message}`);
    }
  }

  async format(tag) {
    return this.write(tag, { records: [] });
  }

  async lock(tag, options = {}) {
    throw new Error('Lock operation not supported in Web NFC');
  }

  async sendCommand(tag, command, data) {
    throw new Error('Raw commands not supported in Web NFC');
  }

  async getInfo() {
    return {
      adapter: 'WebNFC',
      version: '1.0',
      capabilities: ['NDEF_READ', 'NDEF_WRITE'],
      isAvailable: 'NDEFReader' in window
    };
  }

  _createTagFromNDEF(message, serialNumber) {
    const tag = new NFCTag({
      uid: serialNumber,
      type: 'NDEF',
      standard: 'NFC Forum',
      technology: 'NDEF',
      isWritable: true
    });
    
    tag.data = this._parseNDEFMessage(message);
    return tag;
  }

  _parseNDEFMessage(message) {
    const records = [];
    
    for (const record of message.records) {
      const parsedRecord = {
        recordType: record.recordType,
        mediaType: record.mediaType,
        id: record.id,
        encoding: record.encoding,
        lang: record.lang
      };
      
      if (record.recordType === 'text') {
        const decoder = new TextDecoder(record.encoding || 'utf-8');
        parsedRecord.text = decoder.decode(record.data);
      } else if (record.recordType === 'url') {
        const decoder = new TextDecoder();
        parsedRecord.url = decoder.decode(record.data);
      } else if (record.recordType === 'mime') {
        parsedRecord.data = record.data;
      } else {
        parsedRecord.data = record.data;
      }
      
      records.push(parsedRecord);
    }
    
    return { records };
  }

  _createNDEFRecords(data) {
    if (!data.records) {
      return [];
    }
    
    return data.records.map(record => {
      const ndefRecord = {
        recordType: record.recordType || 'text',
        mediaType: record.mediaType,
        id: record.id
      };
      
      if (record.text) {
        const encoder = new TextEncoder();
        ndefRecord.data = encoder.encode(record.text);
        ndefRecord.encoding = 'utf-8';
      } else if (record.url) {
        const encoder = new TextEncoder();
        ndefRecord.data = encoder.encode(record.url);
      } else if (record.data) {
        ndefRecord.data = record.data;
      }
      
      return ndefRecord;
    });
  }

  setDebug(enabled) {
    this.options.debug = enabled;
  }

  destroy() {
    this.disconnect();
    this.removeAllListeners();
  }
}

export default WebNFCAdapter;