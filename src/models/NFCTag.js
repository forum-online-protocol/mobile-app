class NFCTag {
  constructor(data = {}) {
    this.uid = data.uid || null;
    this.type = data.type || 'UNKNOWN';
    this.standard = data.standard || null;
    this.technology = data.technology || null;
    this.capacity = data.capacity || null;
    this.isWritable = data.isWritable !== false;
    this.isLocked = data.isLocked || false;
    this.data = data.data || null;
    this.blocks = data.blocks || [];
    this.sectors = data.sectors || [];
    this.metadata = data.metadata || {};
    this.discoveredAt = data.discoveredAt || new Date();
    this.lastReadAt = null;
    this.lastWriteAt = null;
  }

  static fromRawData(rawData) {
    const tag = new NFCTag();
    
    if (rawData.uid) {
      tag.uid = typeof rawData.uid === 'string' 
        ? rawData.uid 
        : Array.from(rawData.uid).map(b => b.toString(16).padStart(2, '0')).join(':');
    }
    
    if (rawData.atr) {
      tag.parseATR(rawData.atr);
    }
    
    if (rawData.type) {
      tag.type = rawData.type;
    }
    
    if (rawData.standard) {
      tag.standard = rawData.standard;
    }
    
    return tag;
  }

  parseATR(atr) {
    const atrBytes = typeof atr === 'string' 
      ? atr.split(' ').map(b => parseInt(b, 16))
      : Array.from(atr);
    
    if (atrBytes.length >= 2) {
      const T0 = atrBytes[0];
      const T1 = atrBytes[1];
      
      this.metadata.atr = {
        T0,
        T1,
        protocols: this._extractProtocols(T0),
        historicalBytes: atrBytes.slice(2)
      };
    }
  }

  _extractProtocols(T0) {
    const protocols = [];
    if (T0 & 0x10) protocols.push('T=0');
    if (T0 & 0x20) protocols.push('T=1');
    if (T0 & 0x40) protocols.push('T=15');
    return protocols;
  }

  getBlock(blockNumber) {
    return this.blocks[blockNumber];
  }

  setBlock(blockNumber, data) {
    this.blocks[blockNumber] = data;
  }

  getSector(sectorNumber) {
    return this.sectors[sectorNumber];
  }

  setSector(sectorNumber, data) {
    this.sectors[sectorNumber] = data;
  }

  hasNDEF() {
    return this.data && this.data.records && this.data.records.length > 0;
  }

  getNDEFRecords() {
    if (!this.hasNDEF()) return [];
    return this.data.records;
  }

  setNDEFRecords(records) {
    if (!this.data) {
      this.data = {};
    }
    this.data.records = records;
  }

  getMemorySize() {
    if (this.capacity) return this.capacity;
    
    const typeSizes = {
      'MIFARE_CLASSIC_1K': 1024,
      'MIFARE_CLASSIC_4K': 4096,
      'MIFARE_ULTRALIGHT': 64,
      'MIFARE_ULTRALIGHT_C': 192,
      'NTAG213': 180,
      'NTAG215': 504,
      'NTAG216': 888,
      'DESFIRE': 8192
    };
    
    return typeSizes[this.type] || 0;
  }

  isNTAG() {
    return this.type && this.type.startsWith('NTAG');
  }

  isMifareClassic() {
    return this.type && this.type.includes('MIFARE_CLASSIC');
  }

  isMifareUltralight() {
    return this.type && this.type.includes('MIFARE_ULTRALIGHT');
  }

  isDESFire() {
    return this.type && this.type.includes('DESFIRE');
  }

  getInfo() {
    return {
      uid: this.uid,
      type: this.type,
      standard: this.standard,
      technology: this.technology,
      capacity: this.getMemorySize(),
      isWritable: this.isWritable,
      isLocked: this.isLocked,
      hasNDEF: this.hasNDEF(),
      discoveredAt: this.discoveredAt,
      lastReadAt: this.lastReadAt,
      lastWriteAt: this.lastWriteAt
    };
  }

  toJSON() {
    return {
      uid: this.uid,
      type: this.type,
      standard: this.standard,
      technology: this.technology,
      capacity: this.capacity,
      isWritable: this.isWritable,
      isLocked: this.isLocked,
      data: this.data,
      blocks: this.blocks,
      sectors: this.sectors,
      metadata: this.metadata,
      discoveredAt: this.discoveredAt,
      lastReadAt: this.lastReadAt,
      lastWriteAt: this.lastWriteAt
    };
  }

  toString() {
    return `NFCTag[${this.uid || 'unknown'}] Type: ${this.type}, Capacity: ${this.getMemorySize()} bytes`;
  }
}

export default NFCTag;