// BAC Authentication for React Native
// Adapted from src/auth/BACAuthentication.js to work with crypto-js

const CryptoJS = require('crypto-js');

export class BACAuthenticationRN {
  private KENC_CONST = [0x00, 0x00, 0x00, 0x01];
  private KMAC_CONST = [0x00, 0x00, 0x00, 0x02];
  private ssc: number[] = [];

  // Generate K_seed from MRZ data
  generateKSeed(documentNumber: string, dateOfBirth: string, dateOfExpiry: string): number[] {
    const docNum = this.padString(documentNumber, 9);
    const dob = this.formatDate(dateOfBirth);
    const exp = this.formatDate(dateOfExpiry);
    
    const docNumWithCheck = docNum + this.calculateCheckDigit(docNum);
    const dobWithCheck = dob + this.calculateCheckDigit(dob);
    const expWithCheck = exp + this.calculateCheckDigit(exp);
    
    const mrzInfo = docNumWithCheck + dobWithCheck + expWithCheck;
    console.log('[BAC] MRZ Info string:', mrzInfo);
    
    // SHA-1 hash of MRZ info
    const hash = CryptoJS.SHA1(mrzInfo);
    const hashBytes = this.wordArrayToBytes(hash);
    
    // Take first 16 bytes as K_seed
    const kSeed = hashBytes.slice(0, 16);
    console.log('[BAC] K_seed:', this.bytesToHex(kSeed));
    
    return kSeed;
  }

  // Derive K_enc and K_mac from K_seed
  deriveKeys(kSeed: number[]): { kEnc: number[], kMac: number[] } {
    const kEnc = this.derive3DESKey(kSeed, this.KENC_CONST);
    const kMac = this.derive3DESKey(kSeed, this.KMAC_CONST);
    
    console.log('[BAC] K_enc:', this.bytesToHex(kEnc));
    console.log('[BAC] K_mac:', this.bytesToHex(kMac));
    
    return { kEnc, kMac };
  }

  // Derive a 3DES key
  private derive3DESKey(kSeed: number[], c: number[]): number[] {
    // Concatenate K_seed and c
    const d = [...kSeed, ...c];
    
    // SHA-1 hash
    const dWordArray = this.bytesToWordArray(d);
    const hash = CryptoJS.SHA1(dWordArray);
    const hashBytes = this.wordArrayToBytes(hash);
    
    // Take first 16 bytes
    const ka = hashBytes.slice(0, 8);
    const kb = hashBytes.slice(8, 16);
    
    // Form 3DES key (ka || kb || ka)
    const key = [...ka, ...kb, ...ka];
    
    // Adjust parity bits for DES
    this.adjustParity(key);
    
    return key;
  }

  // Build mutual authentication command
  buildMutualAuthCommand(
    challenge: number[], 
    kEnc: number[], 
    kMac: number[]
  ): { command: number[], eifd: number[], kifd: number[], rndIFD: number[] } {
    // Generate random values
    const rndIFD = this.randomBytes(8);
    const kifd = this.randomBytes(16);
    
    console.log('[BAC] RND.IFD:', this.bytesToHex(rndIFD));
    console.log('[BAC] K.IFD:', this.bytesToHex(kifd));
    console.log('[BAC] RND.ICC (challenge):', this.bytesToHex(challenge));
    
    // Build S = RND.IFD || RND.ICC || K.IFD
    const s = [...rndIFD, ...challenge, ...kifd];
    console.log('[BAC] S (plaintext):', this.bytesToHex(s));
    console.log('[BAC] S length:', s.length, 'bytes');
    
    // S must be exactly 32 bytes for BAC (8+8+16)
    if (s.length !== 32) {
      console.log('[BAC] ERROR: S should be 32 bytes, got:', s.length);
    }
    
    // Encrypt S with K_enc - NO PADDING for BAC
    // S is already the right size (32 bytes = 4 blocks of 8)
    // Don't use the regular encrypt3DES which adds padding
    const eifd = this.encrypt3DESNoPadding(s, kEnc);
    console.log('[BAC] E.IFD:', this.bytesToHex(eifd));
    console.log('[BAC] E.IFD length:', eifd.length, 'bytes');
    
    // Calculate MAC over E.IFD
    const mifd = this.calculateMAC(eifd, kMac);
    console.log('[BAC] M.IFD:', this.bytesToHex(mifd));
    
    // Build command data: E.IFD || M.IFD
    const cmdData = [...eifd, ...mifd];
    
    // Build full MUTUAL AUTHENTICATE command
    // For extended length: CLA=0x00, INS=0x82, P1=0x00, P2=0x00, Lc, Data, Le
    // The response should be 40 bytes (32 bytes encrypted + 8 bytes MAC)
    let command: number[];
    
    if (cmdData.length <= 255) {
      // Standard APDU
      command = [
        0x00, 0x82, 0x00, 0x00, 
        cmdData.length,
        ...cmdData,
        0x00 // Le=0x00 means max response (256 bytes)
      ];
    } else {
      // Extended APDU (shouldn't happen for BAC)
      command = [
        0x00, 0x82, 0x00, 0x00,
        0x00, // Extended length marker
        (cmdData.length >> 8) & 0xFF,
        cmdData.length & 0xFF,
        ...cmdData,
        0x00, 0x00 // Extended Le
      ];
    }
    
    console.log('[BAC] Full command:', this.bytesToHex(command));
    console.log('[BAC] Command length:', command.length);
    
    return { command, eifd, kifd, rndIFD };
  }
  
  // Add proper padding for encryption (PKCS7/ISO 9797-1 Method 2)
  private padForEncryption(data: number[]): number[] {
    const blockSize = 8;
    const padded = [...data];
    padded.push(0x80); // Add 0x80 byte
    
    // Pad with zeros to block size
    while (padded.length % blockSize !== 0) {
      padded.push(0x00);
    }
    
    return padded;
  }

  // Parse mutual authentication response
  parseMutualAuthResponse(
    response: number[], 
    kEnc: number[], 
    kMac: number[],
    kifd: number[],
    rndIFD: number[]
  ): { ksEnc: number[], ksMac: number[], ssc: number[] } | null {
    console.log('[BAC] Parsing response:', this.bytesToHex(response));
    console.log('[BAC] Response length:', response.length);
    
    // Check for error status
    if (response.length === 2) {
      const sw1 = response[0];
      const sw2 = response[1];
      if (sw1 === 0x63 && sw2 === 0x00) {
        console.log('[BAC] Error 6300: No information given - wrong key?');
      } else if (sw1 === 0x69 && sw2 === 0x82) {
        console.log('[BAC] Error 6982: Security status not satisfied');
      } else if (sw1 === 0x6A && sw2 === 0x86) {
        console.log('[BAC] Error 6A86: Incorrect parameters');
      } else {
        console.log(`[BAC] Error ${this.bytesToHex([sw1, sw2])}`);
      }
      return null;
    }
    
    if (response.length < 42) {
      console.log(`[BAC] Response too short: ${response.length} bytes, expected 42`);
      return null;
    }
    
    // Extract E.ICC and M.ICC
    const eicc = response.slice(0, 32);
    const micc = response.slice(32, 40);
    const sw = response.slice(40, 42);
    
    // Verify status words
    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      console.log('[BAC] Mutual auth failed, SW:', this.bytesToHex(sw));
      return null;
    }
    
    // Verify MAC
    const expectedMac = this.calculateMAC(eicc, kMac);
    if (!this.compareBytes(micc, expectedMac)) {
      console.log('[BAC] MAC verification failed');
      return null;
    }
    
    // Decrypt E.ICC
    const r = this.decrypt3DES(eicc, kEnc);
    
    // Extract RND.ICC and K.ICC
    const rndICC = r.slice(0, 8);
    const rndIFDEchoed = r.slice(8, 16); // This should be our RND.IFD echoed back
    const kicc = r.slice(16, 32);
    
    console.log('[BAC] RND.ICC:', this.bytesToHex(rndICC));
    console.log('[BAC] RND.IFD (echoed):', this.bytesToHex(rndIFDEchoed));
    console.log('[BAC] K.ICC:', this.bytesToHex(kicc));
    
    // Verify RND.IFD was echoed correctly (optional)
    if (!this.compareBytes(rndIFDEchoed, rndIFD)) {
      console.log('[BAC] Warning: RND.IFD not echoed correctly!');
      console.log('[BAC] Expected:', this.bytesToHex(rndIFD));
      console.log('[BAC] Got:', this.bytesToHex(rndIFDEchoed));
    }
    
    // Calculate session key seed
    const kSeed = this.xor(kicc, kifd);
    console.log('[BAC] Session key seed:', this.bytesToHex(kSeed));
    
    // Derive session keys
    const ksEnc = this.derive3DESKey(kSeed, this.KENC_CONST);
    const ksMac = this.derive3DESKey(kSeed, this.KMAC_CONST);
    
    // Calculate SSC (Send Sequence Counter)
    // SSC = RND.ICC (last 4 bytes) || RND.IFD (last 4 bytes)
    const ssc = [...rndICC.slice(4, 8), ...rndIFD.slice(4, 8)];
    
    console.log('[BAC] Full RND.ICC:', this.bytesToHex(rndICC));
    console.log('[BAC] Full RND.IFD:', this.bytesToHex(rndIFD));
    console.log('[BAC] RND.ICC last 4 for SSC:', this.bytesToHex(rndICC.slice(4, 8)));
    console.log('[BAC] RND.IFD last 4 for SSC:', this.bytesToHex(rndIFD.slice(4, 8)));
    console.log('[BAC] Initial SSC:', this.bytesToHex(ssc));
    
    console.log('[BAC] KS_enc:', this.bytesToHex(ksEnc));
    console.log('[BAC] KS_mac:', this.bytesToHex(ksMac));
    console.log('[BAC] SSC:', this.bytesToHex(ssc));
    
    // Store SSC for secure messaging
    this.ssc = ssc;
    
    return { ksEnc, ksMac, ssc };
  }
  
  // Build secure messaging command V2 - alternative format
  buildSecureCommandV2(
    plainCommand: number[],
    ksEnc: number[],
    ksMac: number[]
  ): number[] {
    try {
      // Increment SSC
      this.incrementSSC();
      console.log('[SM-V2] SSC:', this.bytesToHex(this.ssc));
      
      const cla = plainCommand[0];
      const ins = plainCommand[1];
      const p1 = plainCommand[2];
      const p2 = plainCommand[3];
      
      // Parse command data
      let cmdData: number[] = [];
      let le = 0;
      
      if (plainCommand.length > 4) {
        if (plainCommand.length === 5) {
          // Just Le
          le = plainCommand[4];
        } else {
          const lc = plainCommand[4];
          if (lc > 0) {
            cmdData = plainCommand.slice(5, 5 + lc);
          }
          if (plainCommand.length > 5 + lc) {
            le = plainCommand[5 + lc];
          }
        }
      }
      
      console.log('[SM-V2] Command data:', this.bytesToHex(cmdData));
      
      // Build DO'87 if we have command data
      let do87: number[] = [];
      if (cmdData.length > 0) {
        // Pad the data
        const padded = this.padForEncryption(cmdData);
        console.log('[SM-V2] Padded:', this.bytesToHex(padded));
        
        // Encrypt with zero IV
        const encrypted = this.encrypt3DES(padded, ksEnc, false);
        console.log('[SM-V2] Encrypted:', this.bytesToHex(encrypted));
        
        // Build DO'87
        do87 = [0x87, encrypted.length + 1, 0x01, ...encrypted];
        console.log('[SM-V2] DO87:', this.bytesToHex(do87));
      }
      
      // Build DO'97 for expected response length
      let do97: number[] = [];
      // Only include DO97 if original command had Le
      if (le > 0) {
        do97 = [0x97, 0x01, le];
        console.log('[SM-V2] DO97:', this.bytesToHex(do97));
      }
      
      // Calculate MAC over Padding(SSC || Header || DO'87 || DO'97)
      const header = [0x0C, ins, p1, p2]; // Use 0x0C for MAC calculation
      const macData = [...this.ssc, ...header];
      if (do87.length > 0) macData.push(...do87);
      if (do97.length > 0) macData.push(...do97);
      
      console.log('[SM-V2] MAC input:', this.bytesToHex(macData));
      const mac = this.calculateMAC(macData, ksMac);
      console.log('[SM-V2] MAC:', this.bytesToHex(mac));
      
      // Build DO'8E
      const do8e = [0x8E, 0x08, ...mac];
      
      // Build final command with CLA=00
      const smData = [...do87, ...do97, ...do8e];
      const command = [
        0x00, // Standard CLA
        ins,
        p1,
        p2,
        smData.length,
        ...smData,
        0x00 // Le
      ];
      
      console.log('[SM-V2] Final command:', this.bytesToHex(command));
      return command;
    } catch (error) {
      console.log('[SM-V2] Error:', error);
      return [];
    }
  }

  // Build secure messaging command
  buildSecureCommand(
    plainCommand: number[],
    ksEnc: number[],
    ksMac: number[]
  ): number[] {
    try {
      // Increment SSC for command
      this.incrementSSC();
      console.log('[SM] Command SSC:', this.bytesToHex(this.ssc));
      
      const cla = plainCommand[0];
      const ins = plainCommand[1];
      const p1 = plainCommand[2];
      const p2 = plainCommand[3];
      const lc = plainCommand.length > 4 ? plainCommand[4] : 0;
      const data = plainCommand.length > 5 ? plainCommand.slice(5, 5 + lc) : [];
      const le = plainCommand.length > 5 + lc ? plainCommand[5 + lc] : 0;
      
      console.log('[SM] Plain command:', this.bytesToHex(plainCommand));
      console.log('[SM] Command data:', this.bytesToHex(data));
      console.log('[SM] Le:', le);
      
      // Build header for MAC calculation
      // MAC must use CLA with SM bits set (0x0C) even if command uses 0x00
      const maskedCLA = 0x0C;
      const header = [maskedCLA, ins, p1, p2];
      console.log('[SM] Header for MAC:', this.bytesToHex(header));
      
      // Prepare DO87 (encrypted data) if there's data
      let do87: number[] = [];
      if (data.length > 0) {
        // Pad data
        const paddedData = this.padForEncryption(data);
        console.log('[SM] Data to encrypt:', this.bytesToHex(data));
        console.log('[SM] Padded data:', this.bytesToHex(paddedData));
        
        // Encrypt - DO NOT use SSC as IV for command encryption
        const encryptedData = this.encrypt3DES(paddedData, ksEnc, false);
        
        // Build DO87: 0x87 || L || 0x01 || encrypted data
        do87 = [0x87, encryptedData.length + 1, 0x01, ...encryptedData];
        console.log('[SM] DO87:', this.bytesToHex(do87));
      }
      
      // Prepare DO97 (Le)
      // For passports with strict BAC, DO97 handling is critical
      let do97: number[] = [];
      
      // SELECT FILE commands (INS=A4) typically don't have Le in the plain command
      // But may need DO97 in secure messaging depending on the chip
      if (ins === 0xA4 && p1 === 0x02 && p2 === 0x0C) {
        // SELECT by file ID - most chips don't expect DO97
        // Only add if original command had Le
        if (le > 0) {
          do97 = [0x97, 0x01, le];
          console.log('[SM] DO97 for SELECT:', this.bytesToHex(do97));
        }
      } else if (ins === 0xB0) {
        // READ BINARY always expects response
        do97 = [0x97, 0x01, le || 0x00];
        console.log('[SM] DO97 for READ:', this.bytesToHex(do97));
      } else if (le > 0) {
        // Other commands with Le
        do97 = [0x97, 0x01, le];
        console.log('[SM] DO97:', this.bytesToHex(do97));
      }
      
      // Calculate MAC
      // M = SSC || Masked Header || DO87 || DO97
      const macInput = [...this.ssc, ...header, ...do87, ...do97];
      console.log('[SM] MAC input:', this.bytesToHex(macInput));
      
      const mac = this.calculateMAC(macInput, ksMac);
      const do8e = [0x8E, 0x08, ...mac];
      console.log('[SM] DO8E (MAC):', this.bytesToHex(do8e));
      
      // Build secure command
      const secureData = [...do87, ...do97, ...do8e];
      const secureLc = secureData.length;
      
      // Build the final secure command
      // Your passport requires CLA=00 (rejects 0C with 6E00)
      // But still needs proper secure messaging structure
      
      const secureCommand = [
        0x00,  // Standard CLA (not 0x0C which gives 6E00)
        ins,
        p1,
        p2,
        secureLc,
        ...secureData,
        0x00 // Le
      ];
      
      console.log('[SM] Secure command:', this.bytesToHex(secureCommand));
      return secureCommand;
    } catch (error) {
      console.log('[SM] Error building secure command:', error);
      return [];
    }
  }
  
  // Parse secure messaging response
  parseSecureResponse(
    response: number[],
    ksEnc: number[],
    ksMac: number[]
  ): number[] | null {
    try {
      console.log('[SM] Secure response:', this.bytesToHex(response));
      
      // Check if response is just a status word (error)
      if (response.length === 2) {
        const sw1 = response[0];
        const sw2 = response[1];
        console.log(`[SM] Received error status: ${this.bytesToHex([sw1, sw2])}`);
        
        // Common error codes
        if (sw1 === 0x69 && sw2 === 0x88) {
          console.log('[SM] Error 6988: Incorrect SM data objects - command format rejected');
        } else if (sw1 === 0x69 && sw2 === 0x87) {
          console.log('[SM] Error 6987: Expected SM data objects missing');
        } else if (sw1 === 0x69 && sw2 === 0x82) {
          console.log('[SM] Error 6982: Security status not satisfied');
        }
        return null;
      }
      
      if (response.length < 10) {
        console.log('[SM] Response too short for secure messaging');
        return null;
      }
      
      // Increment SSC for response
      this.incrementSSC();
      console.log('[SM] SSC for response:', this.bytesToHex(this.ssc));
      
      let offset = 0;
      let do87: number[] = [];
      let do99: number[] = [];
      let do8e: number[] = [];
      
      // Parse DOs
      while (offset < response.length - 2) {
        const tag = response[offset];
        const len = response[offset + 1];
        const value = response.slice(offset + 2, offset + 2 + len);
        
        if (tag === 0x87) {
          do87 = [tag, len, ...value];
          console.log('[SM] Found DO87:', this.bytesToHex(do87));
        } else if (tag === 0x99) {
          do99 = [tag, len, ...value];
          console.log('[SM] Found DO99:', this.bytesToHex(do99));
        } else if (tag === 0x8E) {
          do8e = [tag, len, ...value];
          console.log('[SM] Found DO8E:', this.bytesToHex(do8e));
        }
        
        offset += 2 + len;
      }
      
      // Verify MAC
      const macInput = [...this.ssc, ...do87, ...do99];
      console.log('[SM] MAC verification input:', this.bytesToHex(macInput));
      
      const expectedMac = this.calculateMAC(macInput, ksMac);
      const receivedMac = do8e.slice(2, 10);
      
      if (!this.compareBytes(expectedMac, receivedMac)) {
        console.log('[SM] MAC verification failed!');
        console.log('[SM] Expected:', this.bytesToHex(expectedMac));
        console.log('[SM] Received:', this.bytesToHex(receivedMac));
        return null;
      }
      
      console.log('[SM] MAC verified OK');
      
      // Decrypt DO87 if present
      if (do87.length > 0) {
        const encryptedData = do87.slice(3); // Skip tag, length, and padding indicator
        const decrypted = this.decrypt3DES(encryptedData, ksEnc);
        console.log('[SM] Decrypted data:', this.bytesToHex(decrypted));
        
        // Remove padding
        const unpadded = this.removePadding(decrypted);
        console.log('[SM] Unpadded data:', this.bytesToHex(unpadded));
        
        // Add status words
        const sw = do99.slice(2, 4);
        return [...unpadded, ...sw];
      } else {
        // No encrypted data, just return status
        return do99.slice(2, 4);
      }
    } catch (error) {
      console.log('[SM] Error parsing secure response:', error);
      return null;
    }
  }
  
  // Increment SSC (public for testing)
  incrementSSC(): void {
    // SSC is 8 bytes, increment as big-endian number
    for (let i = 7; i >= 0; i--) {
      this.ssc[i]++;
      if (this.ssc[i] !== 0) break; // No overflow, done
      // If overflow, continue to next byte
    }
  }
  
  // Remove padding
  private removePadding(data: number[]): number[] {
    // Find 0x80 padding marker from the end
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i] === 0x80) {
        return data.slice(0, i);
      } else if (data[i] !== 0x00) {
        // Non-zero before finding 0x80, no padding
        return data;
      }
    }
    return data;
  }

  // 3DES encryption without padding (for mutual auth)
  private encrypt3DESNoPadding(data: number[], key: number[]): number[] {
    try {
      // Data must be multiple of 8
      if (data.length % 8 !== 0) {
        console.log('[ENC] ERROR: Data must be multiple of 8 for no-padding encryption');
        return [];
      }
      
      const dataHex = this.bytesToHex(data);
      const keyHex = this.bytesToHex(key.slice(0, 24)); // Use first 24 bytes for 3DES
      
      console.log('[ENC-NP] Encrypting (no padding):', dataHex);
      console.log('[ENC-NP] Data length:', data.length);
      console.log('[ENC-NP] With key:', keyHex);
      
      const dataWA = CryptoJS.enc.Hex.parse(dataHex);
      const keyWA = CryptoJS.enc.Hex.parse(keyHex);
      const iv = CryptoJS.enc.Hex.parse('0000000000000000');
      
      const encrypted = CryptoJS.TripleDES.encrypt(dataWA, keyWA, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.NoPadding,
        iv: iv
      });
      
      const result = this.hexToBytes(encrypted.ciphertext.toString(CryptoJS.enc.Hex));
      console.log('[ENC-NP] Result:', this.bytesToHex(result));
      console.log('[ENC-NP] Result length:', result.length);
      
      return result;
    } catch (error) {
      console.log('[ENC-NP] Error:', error);
      return [];
    }
  }

  // 3DES encryption with CBC mode and zero IV
  private encrypt3DES(data: number[], key: number[], useSSCAsIV: boolean = false): number[] {
    try {
      // Ensure data length is multiple of 8
      if (data.length % 8 !== 0) {
        console.log('[ENC] Warning: Data length not multiple of 8:', data.length);
      }
      
      // Convert to hex strings
      const dataHex = this.bytesToHex(data);
      const keyHex = this.bytesToHex(key.slice(0, 24)); // Use first 24 bytes for 3DES
      
      console.log('[ENC] Encrypting data:', dataHex);
      console.log('[ENC] With key:', keyHex);
      
      // Parse to CryptoJS format
      const dataWA = CryptoJS.enc.Hex.parse(dataHex);
      const keyWA = CryptoJS.enc.Hex.parse(keyHex);
      
      // Use SSC as IV for secure messaging encryption, zero IV otherwise
      let iv;
      if (useSSCAsIV && this.ssc) {
        const sscHex = this.bytesToHex(this.ssc);
        iv = CryptoJS.enc.Hex.parse(sscHex);
        console.log('[ENC] Using SSC as IV:', sscHex);
      } else {
        iv = CryptoJS.enc.Hex.parse('0000000000000000');
        console.log('[ENC] Using zero IV');
      }
      
      // Encrypt with 3DES-CBC
      const encrypted = CryptoJS.TripleDES.encrypt(dataWA, keyWA, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.NoPadding, // No padding - we handle it manually
        iv: iv
      });
      
      // Convert back to byte array
      const encryptedHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
      console.log('[ENC] Encrypted result:', encryptedHex);
      
      return this.hexToBytes(encryptedHex);
    } catch (error) {
      console.log('[ENC] 3DES encryption error:', error);
      // Return empty array on error
      return [];
    }
  }

  // 3DES decryption with CBC mode and zero IV
  private decrypt3DES(data: number[], key: number[], useSSCAsIV: boolean = false): number[] {
    try {
      // Convert to hex strings
      const dataHex = this.bytesToHex(data);
      const keyHex = this.bytesToHex(key.slice(0, 24)); // Use first 24 bytes for 3DES
      
      // Create cipherParams
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Hex.parse(dataHex)
      });
      
      const keyWA = CryptoJS.enc.Hex.parse(keyHex);
      const iv = CryptoJS.enc.Hex.parse('0000000000000000'); // Zero IV
      
      // Decrypt with 3DES-CBC
      const decrypted = CryptoJS.TripleDES.decrypt(cipherParams, keyWA, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.NoPadding,
        iv: iv
      });
      
      // Convert back to byte array
      const decryptedHex = decrypted.toString(CryptoJS.enc.Hex);
      return this.hexToBytes(decryptedHex);
    } catch (error) {
      console.log('[BAC] 3DES decryption error:', error);
      // Return dummy data on error
      return Array(32).fill(0);
    }
  }

  // Calculate MAC using ISO 9797-1 MAC algorithm 3 with 3DES (public for testing)
  calculateMAC(data: number[], key: number[]): number[] {
    try {
      console.log('[MAC] Input data:', this.bytesToHex(data));
      console.log('[MAC] Key:', this.bytesToHex(key));
      
      // Pad data according to ISO 9797-1 padding method 2
      const padded = this.padForMAC(data);
      console.log('[MAC] Padded data:', this.bytesToHex(padded));
      
      // ISO 9797-1 Algorithm 3 (Retail MAC) for passport:
      // Key should be 16 bytes for passport (not 24)
      // If key is 24 bytes, use first 16
      let macKey = key;
      if (key.length === 24) {
        console.log('[MAC] Using first 16 bytes of 24-byte key');
        macKey = key.slice(0, 16);
      }
      
      const ka = macKey.slice(0, 8);
      const kb = macKey.slice(8, 16);
      console.log('[MAC] Ka:', this.bytesToHex(ka));
      console.log('[MAC] Kb:', this.bytesToHex(kb));
      
      // Split data into 8-byte blocks
      const blocks: number[][] = [];
      for (let i = 0; i < padded.length; i += 8) {
        blocks.push(padded.slice(i, i + 8));
      }
      console.log('[MAC] Number of blocks:', blocks.length);
      
      // CBC-MAC: Process all blocks
      let h = Array(8).fill(0); // IV = zeros
      
      // Process all blocks with single DES using Ka
      for (let i = 0; i < blocks.length; i++) {
        // XOR with previous output
        const xored = this.xor(blocks[i], h);
        // Encrypt with Ka
        h = this.encryptDES(xored, ka);
      }
      
      // Final step: Decrypt with Kb then encrypt with Ka
      const decrypted = this.decryptDES(h, kb);
      const mac = this.encryptDES(decrypted, ka);
      
      console.log('[MAC] Final MAC:', this.bytesToHex(mac));
      return mac;
    } catch (error) {
      console.log('[MAC] Calculation error:', error);
      return Array(8).fill(0);
    }
  }
  
  // Single DES encryption for MAC calculation
  private encryptDES(data: number[], key: number[]): number[] {
    try {
      const dataHex = this.bytesToHex(data);
      const keyHex = this.bytesToHex(key);
      
      const dataWA = CryptoJS.enc.Hex.parse(dataHex);
      const keyWA = CryptoJS.enc.Hex.parse(keyHex);
      
      const encrypted = CryptoJS.DES.encrypt(dataWA, keyWA, {
        mode: CryptoJS.mode.ECB, // ECB for single block
        padding: CryptoJS.pad.NoPadding
      });
      
      return this.hexToBytes(encrypted.ciphertext.toString(CryptoJS.enc.Hex));
    } catch (error) {
      console.log('[DES] Encryption error:', error);
      return Array(8).fill(0);
    }
  }
  
  // Single DES decryption for MAC calculation
  private decryptDES(data: number[], key: number[]): number[] {
    try {
      const dataHex = this.bytesToHex(data);
      const keyHex = this.bytesToHex(key);
      
      const dataWA = CryptoJS.enc.Hex.parse(dataHex);
      const keyWA = CryptoJS.enc.Hex.parse(keyHex);
      
      const decrypted = CryptoJS.DES.decrypt(
        { ciphertext: dataWA } as any,
        keyWA,
        {
          mode: CryptoJS.mode.ECB,
          padding: CryptoJS.pad.NoPadding
        }
      );
      
      return this.hexToBytes(decrypted.toString(CryptoJS.enc.Hex));
    } catch (error) {
      console.log('[DES] Decryption error:', error);
      return Array(8).fill(0);
    }
  }
  
  // 3DES encryption for single 8-byte block
  private encrypt3DESBlock(data: number[], key: number[]): number[] {
    try {
      if (data.length !== 8) {
        console.log('[BAC] Warning: Block size not 8:', data.length);
      }
      
      const dataHex = this.bytesToHex(data);
      const keyHex = this.bytesToHex(key.slice(0, 24));
      
      const dataWA = CryptoJS.enc.Hex.parse(dataHex);
      const keyWA = CryptoJS.enc.Hex.parse(keyHex);
      
      const encrypted = CryptoJS.TripleDES.encrypt(dataWA, keyWA, {
        mode: CryptoJS.mode.ECB, // ECB for single block
        padding: CryptoJS.pad.NoPadding
      });
      
      return this.hexToBytes(encrypted.ciphertext.toString(CryptoJS.enc.Hex));
    } catch (error) {
      console.log('[BAC] 3DES block encryption error:', error);
      return Array(8).fill(0);
    }
  }
  
  // ISO 9797-1 padding method 2
  private padForMAC(data: number[]): number[] {
    const blockSize = 8;
    const padded = [...data];
    padded.push(0x80); // Add 0x80 byte
    
    // Pad with zeros to block size
    while (padded.length % blockSize !== 0) {
      padded.push(0x00);
    }
    
    return padded;
  }

  // Helper functions
  private padString(str: string, length: number): string {
    if (str.length >= length) {
      return str.substring(0, length);
    }
    return str + '<'.repeat(length - str.length);
  }

  private formatDate(date: string): string {
    // Already in YYMMDD format
    if (date.length === 6) {
      return date;
    }
    return date.replace(/-/g, '').substring(2, 8);
  }

  private calculateCheckDigit(data: string): string {
    const weights = [7, 3, 1];
    let sum = 0;
    
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      let value: number;
      
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

  private adjustParity(key: number[]): void {
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

  private xor(a: number[], b: number[]): number[] {
    const result: number[] = [];
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i++) {
      const byteA = i < a.length ? a[i] : 0;
      const byteB = i < b.length ? b[i] : 0;
      result.push(byteA ^ byteB);
    }
    return result;
  }

  private randomBytes(length: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      bytes.push(Math.floor(Math.random() * 256));
    }
    return bytes;
  }

  private compareBytes(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private bytesToHex(bytes: number[]): string {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private hexToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  private wordArrayToBytes(wordArray: any): number[] {
    // Convert WordArray to hex string
    const hex = wordArray.toString(CryptoJS.enc.Hex);
    // Convert hex string to byte array
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  private bytesToWordArray(bytes: number[]): any {
    // Convert byte array to hex string first
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    // Parse hex string to WordArray
    return CryptoJS.enc.Hex.parse(hex);
  }
}

export default BACAuthenticationRN;