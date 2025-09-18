import { EventEmitter } from 'events';
import NFCTag from '../models/NFCTag.js';

let SerialPort;
try {
  SerialPort = (await import('serialport')).SerialPort;
} catch {
  SerialPort = null;
}

class SerialAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      port: options.port || '/dev/ttyUSB0',
      baudRate: options.baudRate || 115200,
      ...options
    };
    this.port = null;
    this.buffer = Buffer.alloc(0);
    this.isConnected = false;
    this.scanInterval = null;
  }

  async connect() {
    if (!SerialPort) {
      throw new Error('serialport module not available. Install it with: npm install serialport');
    }
    
    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: this.options.port,
        baudRate: this.options.baudRate
      });
      
      this.port.on('open', () => {
        this.isConnected = true;
        this.emit('reader-connected');
        this._setupDataHandler();
        resolve();
      });
      
      this.port.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });
      
      this.port.on('close', () => {
        this.isConnected = false;
        this.emit('reader-disconnected');
      });
    });
  }

  async disconnect() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    if (this.port && this.port.isOpen) {
      return new Promise((resolve) => {
        this.port.close(() => {
          this.port = null;
          this.isConnected = false;
          resolve();
        });
      });
    }
  }

  async startScanning() {
    if (!this.isConnected) {
      throw new Error('Not connected to serial port');
    }
    
    this.scanInterval = setInterval(() => {
      this._sendCommand('SCAN');
    }, this.options.pollingInterval || 500);
  }

  async stopScanning() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  async read(tag) {
    const response = await this._sendCommand('READ', tag.uid);
    return this._parseReadResponse(response);
  }

  async write(tag, data) {
    const payload = this._encodeWriteData(data);
    await this._sendCommand('WRITE', tag.uid, payload);
  }

  async format(tag) {
    await this._sendCommand('FORMAT', tag.uid);
  }

  async lock(tag, options = {}) {
    await this._sendCommand('LOCK', tag.uid);
  }

  async sendCommand(tag, command, data) {
    const response = await this._sendCommand('RAW', tag.uid, command, data);
    return response;
  }

  async getInfo() {
    const version = await this._sendCommand('VERSION');
    
    return {
      adapter: 'Serial',
      version: version || '1.0',
      port: this.options.port,
      baudRate: this.options.baudRate,
      capabilities: ['READ', 'WRITE', 'FORMAT', 'SCAN'],
      isAvailable: !!SerialPort
    };
  }

  _setupDataHandler() {
    this.port.on('data', (data) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this._processBuffer();
    });
  }

  _processBuffer() {
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt16BE(0);
      
      if (this.buffer.length < length + 2) {
        break;
      }
      
      const packet = this.buffer.slice(2, length + 2);
      this.buffer = this.buffer.slice(length + 2);
      
      this._handlePacket(packet);
    }
  }

  _handlePacket(packet) {
    const command = packet[0];
    const status = packet[1];
    const data = packet.slice(2);
    
    if (command === 0x01) {
      if (status === 0x00) {
        const tag = this._parseTagData(data);
        this.emit('tag-discovered', tag);
      }
    } else if (command === 0x02) {
      const uid = data.toString('hex');
      this.emit('tag-removed', uid);
    }
  }

  _parseTagData(data) {
    const uidLength = data[0];
    const uid = data.slice(1, 1 + uidLength).toString('hex');
    const type = data[1 + uidLength];
    
    const tag = new NFCTag({
      uid,
      type: this._getTagType(type),
      standard: 'ISO14443A',
      capacity: this._getTagCapacity(type)
    });
    
    return tag;
  }

  _getTagType(typeCode) {
    const types = {
      0x08: 'MIFARE_CLASSIC_1K',
      0x18: 'MIFARE_CLASSIC_4K',
      0x00: 'MIFARE_ULTRALIGHT',
      0x44: 'NTAG213',
      0x45: 'NTAG215',
      0x46: 'NTAG216'
    };
    
    return types[typeCode] || 'UNKNOWN';
  }

  _getTagCapacity(typeCode) {
    const capacities = {
      0x08: 1024,
      0x18: 4096,
      0x00: 64,
      0x44: 180,
      0x45: 504,
      0x46: 888
    };
    
    return capacities[typeCode] || 0;
  }

  async _sendCommand(cmd, ...args) {
    return new Promise((resolve, reject) => {
      const commandMap = {
        'SCAN': 0x01,
        'READ': 0x02,
        'WRITE': 0x03,
        'FORMAT': 0x04,
        'LOCK': 0x05,
        'RAW': 0x06,
        'VERSION': 0x07
      };
      
      const cmdCode = commandMap[cmd] || 0x00;
      const payload = this._buildPayload(cmdCode, args);
      
      this.port.write(payload, (err) => {
        if (err) {
          reject(err);
        } else {
          setTimeout(() => {
            resolve(this._getResponse());
          }, 100);
        }
      });
    });
  }

  _buildPayload(command, args) {
    let data = Buffer.from([command]);
    
    for (const arg of args) {
      if (typeof arg === 'string') {
        const buf = Buffer.from(arg, 'hex');
        data = Buffer.concat([data, Buffer.from([buf.length]), buf]);
      } else if (Buffer.isBuffer(arg)) {
        data = Buffer.concat([data, Buffer.from([arg.length]), arg]);
      } else if (typeof arg === 'number') {
        data = Buffer.concat([data, Buffer.from([arg])]);
      }
    }
    
    const length = data.length;
    const header = Buffer.allocUnsafe(2);
    header.writeUInt16BE(length, 0);
    
    return Buffer.concat([header, data]);
  }

  _getResponse() {
    return this.lastResponse || Buffer.alloc(0);
  }

  _parseReadResponse(response) {
    const blocks = [];
    let offset = 0;
    
    while (offset < response.length) {
      const blockSize = response[offset];
      const blockData = response.slice(offset + 1, offset + 1 + blockSize);
      blocks.push(blockData);
      offset += blockSize + 1;
    }
    
    return { blocks };
  }

  _encodeWriteData(data) {
    if (data.blocks) {
      let encoded = Buffer.alloc(0);
      
      for (const block of data.blocks) {
        encoded = Buffer.concat([
          encoded,
          Buffer.from([block.length]),
          block
        ]);
      }
      
      return encoded;
    }
    
    return Buffer.alloc(0);
  }

  setDebug(enabled) {
    this.options.debug = enabled;
  }

  destroy() {
    this.disconnect();
    this.removeAllListeners();
  }
}

export default SerialAdapter;