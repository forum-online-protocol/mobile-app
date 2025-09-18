import { EventEmitter } from 'events';
import WebNFCAdapter from '../adapters/WebNFCAdapter.js';
import PCScAdapter from '../adapters/PCScAdapter.js';
import SerialAdapter from '../adapters/SerialAdapter.js';
import NFCParser from '../parsers/NFCParser.js';
import NFCTag from '../models/NFCTag.js';

class NFCReader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      adapter: options.adapter || 'auto',
      autoRead: options.autoRead !== false,
      pollingInterval: options.pollingInterval || 500,
      debug: options.debug || false,
      ...options
    };
    
    this.adapter = null;
    this.parser = new NFCParser();
    this.isReading = false;
    this.connectedTags = new Map();
    
    this._initializeAdapter();
  }

  _initializeAdapter() {
    const { adapter } = this.options;
    
    if (adapter === 'auto') {
      this.adapter = this._detectBestAdapter();
    } else if (adapter === 'web') {
      this.adapter = new WebNFCAdapter(this.options);
    } else if (adapter === 'pcsc') {
      this.adapter = new PCScAdapter(this.options);
    } else if (adapter === 'serial') {
      this.adapter = new SerialAdapter(this.options);
    } else if (typeof adapter === 'object') {
      this.adapter = adapter;
    }
    
    if (!this.adapter) {
      throw new Error('No suitable NFC adapter found');
    }
    
    this._setupAdapterListeners();
  }

  _detectBestAdapter() {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      return new WebNFCAdapter(this.options);
    }
    
    try {
      require.resolve('nfc-pcsc');
      return new PCScAdapter(this.options);
    } catch {
      try {
        require.resolve('serialport');
        return new SerialAdapter(this.options);
      } catch {
        return null;
      }
    }
  }

  _setupAdapterListeners() {
    this.adapter.on('tag-discovered', (rawData) => {
      this._handleTagDiscovery(rawData);
    });
    
    this.adapter.on('tag-removed', (uid) => {
      this._handleTagRemoval(uid);
    });
    
    this.adapter.on('error', (error) => {
      this.emit('error', error);
    });
    
    this.adapter.on('reader-connected', () => {
      this.emit('reader-connected');
    });
    
    this.adapter.on('reader-disconnected', () => {
      this.emit('reader-disconnected');
    });
  }

  async _handleTagDiscovery(rawData) {
    try {
      const tag = await this.parser.parse(rawData);
      
      if (!this.connectedTags.has(tag.uid)) {
        this.connectedTags.set(tag.uid, tag);
        this.emit('tag-discovered', tag);
        
        if (this.options.autoRead) {
          await this.readTag(tag);
        }
      }
    } catch (error) {
      this.emit('error', new Error(`Tag parsing failed: ${error.message}`));
    }
  }

  _handleTagRemoval(uid) {
    if (this.connectedTags.has(uid)) {
      const tag = this.connectedTags.get(uid);
      this.connectedTags.delete(uid);
      this.emit('tag-removed', tag);
    }
  }

  async start() {
    if (this.isReading) {
      return;
    }
    
    try {
      await this.adapter.connect();
      this.isReading = true;
      await this.adapter.startScanning();
      this.emit('started');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isReading) {
      return;
    }
    
    try {
      await this.adapter.stopScanning();
      await this.adapter.disconnect();
      this.isReading = false;
      this.connectedTags.clear();
      this.emit('stopped');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async readTag(tag) {
    try {
      const data = await this.adapter.read(tag);
      tag.data = data;
      this.emit('tag-read', tag);
      return tag;
    } catch (error) {
      this.emit('error', new Error(`Failed to read tag ${tag.uid}: ${error.message}`));
      throw error;
    }
  }

  async writeTag(tag, data) {
    try {
      await this.adapter.write(tag, data);
      tag.data = data;
      this.emit('tag-written', tag);
      return tag;
    } catch (error) {
      this.emit('error', new Error(`Failed to write to tag ${tag.uid}: ${error.message}`));
      throw error;
    }
  }

  async formatTag(tag) {
    try {
      await this.adapter.format(tag);
      tag.data = null;
      this.emit('tag-formatted', tag);
      return tag;
    } catch (error) {
      this.emit('error', new Error(`Failed to format tag ${tag.uid}: ${error.message}`));
      throw error;
    }
  }

  async lockTag(tag, options = {}) {
    try {
      await this.adapter.lock(tag, options);
      tag.isLocked = true;
      this.emit('tag-locked', tag);
      return tag;
    } catch (error) {
      this.emit('error', new Error(`Failed to lock tag ${tag.uid}: ${error.message}`));
      throw error;
    }
  }

  getConnectedTags() {
    return Array.from(this.connectedTags.values());
  }

  getTagByUid(uid) {
    return this.connectedTags.get(uid);
  }

  isTagConnected(uid) {
    return this.connectedTags.has(uid);
  }

  async sendCommand(tag, command, data) {
    try {
      const response = await this.adapter.sendCommand(tag, command, data);
      this.emit('command-sent', { tag, command, response });
      return response;
    } catch (error) {
      this.emit('error', new Error(`Command failed for tag ${tag.uid}: ${error.message}`));
      throw error;
    }
  }

  async getReaderInfo() {
    try {
      return await this.adapter.getInfo();
    } catch (error) {
      this.emit('error', new Error(`Failed to get reader info: ${error.message}`));
      throw error;
    }
  }

  setDebug(enabled) {
    this.options.debug = enabled;
    if (this.adapter) {
      this.adapter.setDebug(enabled);
    }
  }

  destroy() {
    this.stop();
    this.removeAllListeners();
    if (this.adapter) {
      this.adapter.destroy();
    }
  }
}

export default NFCReader;