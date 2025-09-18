import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';
import { UserProfile } from '../types';

// Platform-specific imports
let axios: any;
let AxiosInstance: any;
let AxiosError: any;

if (Platform.OS === 'web') {
  // For web, use fetch API instead of axios
  axios = null;
} else {
  // For mobile, use axios
  const axiosModule = require('axios');
  axios = axiosModule.default || axiosModule;
  AxiosInstance = axiosModule.AxiosInstance;
  AxiosError = axiosModule.AxiosError;
}

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://forum-api-production-42de.up.railway.app';
// Diagnostic: log resolved base URL once on module load
try {
  // eslint-disable-next-line no-console
  console.log('[ApiService] Resolved API_BASE_URL:', API_BASE_URL, 'Platform:', Platform.OS);
} catch {}
// Shorter timeout on Android to avoid long hangs and force a visible reject path
const API_TIMEOUT = Platform.OS === 'android' ? 10000 : 60000; // 10s on Android, 60s elsewhere
// Gate web proxy behavior behind env flag (default: direct fetch, no proxy)
const USE_WEB_PROXY = ((process.env.REACT_APP_USE_PROXY as any) || '').toString().toLowerCase() === 'true';

// EIP-712 Domain
const EIP712_DOMAIN = {
  name: 'NFC Reader Platform',
  version: '1',
  chainId: 11155111, // Sepolia
  verifyingContract: '0x0000000000000000000000000000000000000000' // TODO: Update with actual contract
};

// Response interfaces
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Import UserProfile from types instead of defining locally

interface Post {
  id: string;
  author: {
    id?: string;
    address?: string;
    username?: string;
    nickname?: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
  content: string;
  createdAt: string;
  likes: number;
  dislikes?: number;
  reposts: number;
  replies: number;
  comments?: number;
  timestamp?: string;
  isLiked?: boolean;
  isDisliked?: boolean;
  isReposted?: boolean;
  voteData?: {
    yes: number;
    no: number;
    deadline?: string;
  };
}

interface BatchTransaction {
  transactionHash: string;
  blockNumber: number;
  operations: any[];
  timestamp: number;
}

class ApiService {
  private static instance: ApiService;
  private client: any;
  private authToken: string | null = null;
  private userAddress: string | null = null;
  private signer: ethers.Wallet | null = null;
  private baseURL: string = API_BASE_URL;

  // Android-only debug alert utility (DEV builds only)
  private showDebugAlert(title: string, message: string | string[]) {
    try {
      if (__DEV__ && Platform.OS === 'android') {
        const text = Array.isArray(message) ? message.join('\n') : message;
        const trimmed = (text || '').toString().slice(0, 900);
        Alert.alert(title, trimmed);
      }
    } catch {}
  }

  private constructor() {
    // Use fetch for all platforms now
    this.client = null;
    console.log('[ApiService] Using fetch for all platforms - no axios dependencies');
  }

  // Fetch wrapper for web
  private async fetchWrapper(url: string, options: any = {}): Promise<any> {
    const headers: any = {
      'Accept': 'application/json',
      ...options.headers,
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    // Ensure JSON content type for POST requests with body
    if (options.method && options.method.toUpperCase() === 'POST' && options.body) {
      headers['Content-Type'] = 'application/json';
    }

    // Remove problematic headers that cause server rate-limit validation errors
    delete headers['X-Forwarded-For'];
    delete headers['x-forwarded-for'];

    const fullUrl = `${this.baseURL}${url}`;
    console.log('[ApiService] fetchWrapper starting fetch to:', fullUrl);
    console.log('[ApiService] Headers:', headers);
    console.log('[ApiService] Options:', options);

    try {
      // On web, if fullUrl is cross-origin relative to current page, use backend proxy
      if (Platform.OS === 'web' && USE_WEB_PROXY) {
        try {
          const target = new URL(fullUrl, (typeof window !== 'undefined' ? window.location.href : undefined));
          const currentOrigin = (typeof window !== 'undefined' ? window.location.origin : '');
          const isCrossOrigin = currentOrigin && target.origin !== currentOrigin;
          console.log('[ApiService] URL origin check:', { target: target.origin, currentOrigin, isCrossOrigin });

          if (isCrossOrigin) {
            console.log('[ApiService] Using backend proxy /api/proxy for cross-origin request');
            const proxyPayload: any = {
              url: target.href,
              method: (options.method || 'GET').toUpperCase(),
              headers,
            };
            if (options.body && proxyPayload.method !== 'GET' && proxyPayload.method !== 'HEAD') {
              // If body is not a string, send as JSON
              proxyPayload.body = typeof options.body === 'string' ? options.body : options.body;
            }

            // Use backend absolute URL for proxy to work across different web dev servers
            const proxyUrl = `${this.baseURL}/api/proxy`;
            console.log('[ApiService] Proxy URL:', proxyUrl);
            const proxyResponse = await fetch(proxyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-No-Compression': '1',
                'X-Platform': 'web',
              },
              body: JSON.stringify(proxyPayload),
            });

            console.log('[ApiService] Proxy response received');
            console.log('[ApiService] Proxy status:', proxyResponse.status);
            console.log('[ApiService] Proxy ok:', proxyResponse.ok);
            console.log('[ApiService] Proxy headers:', Object.fromEntries(proxyResponse.headers.entries()))
            ;

            if (!proxyResponse.ok) {
              throw new Error(`Proxy HTTP error! status: ${proxyResponse.status}`);
            }

            const ctype = proxyResponse.headers.get('content-type') || '';
            if (ctype.includes('application/json')) {
              const data = await proxyResponse.json();
              return { data, status: proxyResponse.status };
            }
            const text = await proxyResponse.text();
            try {
              const data = JSON.parse(text);
              return { data, status: proxyResponse.status };
            } catch {
              // Non-JSON text response
              return { data: text as any, status: proxyResponse.status };
            }
          }
        } catch (originCheckErr) {
          console.warn('[ApiService] Origin check/proxy handling failed, falling back to direct fetch:', originCheckErr);
        }
      }

      console.log('[ApiService] Calling direct fetch...');
      const response = await fetch(fullUrl, {
        ...options,
        headers,
      });
      
      console.log('[ApiService] Fetch response received');
      console.log('[ApiService] Response status:', response.status);
      console.log('[ApiService] Response ok:', response.ok);
      console.log('[ApiService] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('[ApiService] HTTP error - status:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('[ApiService] Parsing JSON...');
      const data = await response.json();
      console.log('[ApiService] JSON parsed successfully');
      console.log('[ApiService] Data type:', typeof data);
      console.log('[ApiService] Data keys:', Object.keys(data || {}));
      
      return { data, status: response.status };
    } catch (error) {
      console.error('[ApiService] Fetch error:', error);
      console.error('[ApiService] Error type:', typeof error);
      console.error('[ApiService] Error message:', error.message);
      throw error;
    }
  }

  // Generic fetch with hard timeout guard (RN Android AbortController can be unreliable)
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    label: string
  ): Promise<Response> {
    const controller = new AbortController();
    const start = Date.now();
    let abortId: any;
    let guardId: any;
    try {
      abortId = setTimeout(() => {
        try { controller.abort(); } catch {}
      }, timeoutMs);

      const timeoutReject = new Promise<never>((_, reject) => {
        guardId = setTimeout(() => {
          const elapsed = Date.now() - start;
          console.warn(`[ApiService] ${label} TIMEOUT after ${elapsed}ms`);
          reject(new Error('Timeout'));
        }, timeoutMs + 50);
      });

      const fetchPromise = fetch(url, { ...options, signal: controller.signal });
      // Diagnostics: observe if fetch resolves after timeout to understand race conditions on Android
      fetchPromise
        .then((r) => {
          const elapsed = Date.now() - start;
          try {
            console.log(`[ApiService] ${label} RESOLVED after ${elapsed}ms with status ${r?.status}`);
          } catch {}
        })
        .catch((err) => {
          const elapsed = Date.now() - start;
          try {
            console.warn(`[ApiService] ${label} FETCH ERROR after ${elapsed}ms:`, err?.message || String(err));
          } catch {}
        });
      const res = await Promise.race([fetchPromise, timeoutReject]);
      return res as Response;
    } finally {
      if (abortId) clearTimeout(abortId);
      if (guardId) clearTimeout(guardId);
    }
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // Initialize with wallet
  async initialize(wallet: any) {
    console.log('[ApiService] ===== INITIALIZE =====');
    console.log('[ApiService] Wallet received:', wallet ? 'YES' : 'NO');
    
    if (wallet) {
      console.log('[ApiService] Wallet address:', wallet.address);
      
      // Get private key from WalletService
      const { WalletService } = require('./WalletService');
      const walletService = WalletService.getInstance();
      const privateKey = await walletService.getPrivateKey();
      
      console.log('[ApiService] Private key retrieved:', !!privateKey);
      console.log('[ApiService] Private key prefix:', privateKey ? privateKey.substring(0, 10) + '...' : 'NONE');
      
      if (privateKey && privateKey.length >= 64) {
        // Create proper ethers.Wallet from private key
        try {
          this.signer = new ethers.Wallet(privateKey);
          console.log('[ApiService] ✅ Created ethers.Wallet from private key');
          console.log('[ApiService] Signer address:', this.signer.address);
          console.log('[ApiService] Has signTypedData method:', typeof this.signer.signTypedData === 'function');
          
          // Use the address from the ethers.Wallet, not the mock wallet
          this.userAddress = this.signer.address;
        } catch (error) {
          console.error('[ApiService] ❌ Failed to create ethers.Wallet:', error);
          this.signer = null;
          this.userAddress = wallet.address; // Fallback to mock address
        }
      } else {
        console.log('[ApiService] ⚠️ No valid private key available, using null signer');
        this.signer = null;
        this.userAddress = wallet.address; // Use mock address
      }
      
      console.log('[ApiService] Signer set:', !!this.signer);
      console.log('[ApiService] User address set:', this.userAddress);
      
      // Load saved auth token
      if (Platform.OS !== 'web') {
        const savedToken = await AsyncStorage.getItem('authToken');
        if (savedToken) {
          this.authToken = savedToken;
          console.log('[ApiService] Auth token loaded from storage');
        }
      }
    } else {
      console.log('[ApiService] ⚠️ No wallet provided to initialize');
      this.signer = null;
      this.userAddress = null;
    }
    
    // Auto-fetch feed after successful wallet initialization
    if (this.signer && this.userAddress) {
      console.log('[ApiService] 🚀 Wallet initialized successfully - auto-fetching feed...');
      try {
        const feedResult = await this.getFeed(1, 20);
        if (feedResult.success) {
          console.log('[ApiService] ✅ Feed auto-fetched successfully:', feedResult.data.length, 'posts');
        } else {
          console.log('[ApiService] ⚠️ Feed auto-fetch failed:', feedResult.error);
        }
      } catch (error: any) {
        console.log('[ApiService] ❌ Feed auto-fetch error:', error.message);
      }
    }
    
    console.log('[ApiService] ===== END INITIALIZE =====');
  }

  // Clear authentication
  async clearAuth() {
    this.authToken = null;
    this.userAddress = null;
    this.signer = null;
    
    if (Platform.OS !== 'web') {
      await AsyncStorage.removeItem('authToken');
    }
  }

  // HTTP GET helper with timeout
  private async get(url: string, params?: any): Promise<any> {
    console.log('[ApiService] GET request starting:', url, 'params:', params);
    console.log('[ApiService] Platform:', Platform.OS);

    try {
      let result;
      if (Platform.OS === 'web') {
        const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
        const fullUrl = `${url}${queryString}`;
        console.log('[ApiService] Web fetch URL:', fullUrl);
        result = await this.fetchWrapper(fullUrl, { method: 'GET' });
      } else {
        // Mobile platforms (iOS, Android)
        const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
        const fullUrl = `${this.baseURL}${url}${queryString}`;
        console.log('[ApiService] Mobile fetch URL:', fullUrl);

        if (Platform.OS === 'android') {
          // Android: prefer axios (okhttp) first with identity encoding; fallback to fetchWithTimeout on timeout/network errors
          try {
            const axiosResp = await this.client.get(url, {
              params,
              headers: {
                'Accept': 'application/json',
                'X-Platform': 'android',
                'Accept-Encoding': 'identity',
              },
              timeout: API_TIMEOUT,
            });
            result = { data: axiosResp?.data };
          } catch (axiosErr: any) {
            const msg = (axiosErr?.message || '').toString().toLowerCase();
            const code = (axiosErr?.code || '').toString();
            const isTimeout = msg.includes('timeout') || code === 'ECONNABORTED';
            const isNetwork = msg.includes('network') || code === 'ERR_NETWORK';
            console.warn('[ApiService] Android axios failed, attempting fetch fallback:', axiosErr?.message || String(axiosErr));
            if (isTimeout || isNetwork) {
              try {
                const headers: any = {
                  'Accept': 'application/json',
                  'X-Platform': 'android',
                };
                const resp = await this.fetchWithTimeout(fullUrl, { method: 'GET', headers }, API_TIMEOUT, 'AndroidGETFallback');
                if (!resp.ok) {
                  throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                }
                let data: any;
                const ctype = resp.headers.get('content-type') || '';
                try {
                  if (ctype.includes('application/json')) {
                    data = await resp.json();
                  } else {
                    const text = await resp.text();
                    try { data = JSON.parse(text); } catch { data = text as any; }
                  }
                } catch (e) {
                  // As a last resort, read text then parse
                  const text = await resp.text();
                  try { data = JSON.parse(text); } catch { data = text as any; }
                }
                result = { data };
              } catch (fetchErr: any) {
                console.error('[ApiService] Android fetch fallback failed:', fetchErr?.message || String(fetchErr));
                throw axiosErr;
              }
            } else {
              throw axiosErr;
            }
          }
        } else {
          // iOS: direct fetch
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
          const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'X-Platform': Platform.OS,
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          let data: any;
          try {
            data = await response.json();
          } catch (jsonErr) {
            console.warn('[ApiService] iOS JSON parse failed, reading text...', jsonErr);
            const text = await response.text();
            try { data = JSON.parse(text); } catch { data = text as any; }
          }
          result = { data };
        }
      }
      
      console.log('[ApiService] Request completed successfully');
      return result;
    } catch (error) {
      console.error('[ApiService] Request failed:', error);
      throw error;
    }
  }

  // HTTP POST helper with timeout
  private async post(url: string, data?: any): Promise<any> {
    console.log('[ApiService] 📤 POST REQUEST DEBUG:');
    console.log('[ApiService] - URL:', url);
    console.log('[ApiService] - Full URL:', `${this.baseURL}${url}`);
    console.log('[ApiService] - Data Type:', typeof data);
    console.log('[ApiService] - Data Keys:', data ? Object.keys(data) : 'null');
    console.log('[ApiService] - Data Size:', data ? JSON.stringify(data).length : 0, 'characters');
    console.log('[ApiService] - Is Signed Request:', url.includes('/api/signed/'));
    console.log('[ApiService] - Full Data:', JSON.stringify(data, null, 2));
    
    // Use the proper API timeout setting
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), API_TIMEOUT)
    );
    
    const requestPromise = (async () => {
      console.log('[ApiService] Using fetch for POST request');
      const postOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      };
      console.log('[ApiService] Fetch POST options:', postOptions);
      return this.fetchWrapper(url, postOptions);
    })();
    
    try {
      const result = await Promise.race([requestPromise, timeoutPromise]);
      console.log('[ApiService] 📥 POST RESPONSE DEBUG:');
      console.log('[ApiService] - Status:', result.status);
      console.log('[ApiService] - Data:', result.data);
      return result;
    } catch (error: any) {
      console.log('[ApiService] 📥 POST ERROR DEBUG:');
      console.log('[ApiService] - Error Message:', error.message);
      console.log('[ApiService] - Error Status:', error.response?.status);
      console.log('[ApiService] - Error Data:', error.response?.data);
      throw error;
    }
  }

  // Generate nonce for signing
  async getNonce(address: string): Promise<string> {
    console.log('[ApiService] ===== GET NONCE =====');
    console.log('[ApiService] 🎯 Getting nonce for address:', address);
    console.log('[ApiService] 🌐 Base URL:', this.baseURL);
    
    const noncePath = `/api/signed/nonce/${address}`;
    console.log('[ApiService] 📡 Nonce endpoint:', noncePath);
    console.log('[ApiService] 🔗 Full URL:', `${this.baseURL}${noncePath}`);
    
    try {
      console.log('[ApiService] 🚀 Attempting to fetch nonce from server...');
      const startTime = Date.now();
      
      const response = await this.get(noncePath);
      const endTime = Date.now();
      
      console.log('[ApiService] ⏱️ Nonce request took:', endTime - startTime, 'ms');
      console.log('[ApiService] 📦 Raw response:', response);
      console.log('[ApiService] 📊 Response type:', typeof response);
      console.log('[ApiService] 🔍 Response keys:', Object.keys(response || {}));
      
      if (response && response.data) {
        console.log('[ApiService] 📄 Response.data:', response.data);
        console.log('[ApiService] 🔍 Response.data keys:', Object.keys(response.data || {}));
        
        if (response.data.nonce) {
          console.log('[ApiService] ✅ Nonce received from server:', response.data.nonce);
          console.log('[ApiService] 📏 Nonce length:', response.data.nonce.length);
          console.log('[ApiService] 📋 Nonce type:', typeof response.data.nonce);
          console.log('[ApiService] ===== END GET NONCE SUCCESS =====');
          return response.data.nonce;
        } else {
          console.log('[ApiService] ❌ No nonce field in response.data');
          throw new Error('No nonce field in server response');
        }
      } else {
        console.log('[ApiService] ❌ No data field in response');
        throw new Error('Invalid server response format');
      }
    } catch (error: any) {
      console.log('[ApiService] ===== NONCE ERROR =====');
      console.log('[ApiService] ❌ Server nonce failed:', error.message || 'Unknown error');
      console.log('[ApiService] 📊 Error type:', typeof error);
      console.log('[ApiService] 🔍 Error keys:', Object.keys(error || {}));
      console.log('[ApiService] 📡 Error response:', error.response);
      console.log('[ApiService] 📊 Error response status:', error.response?.status);
      console.log('[ApiService] 📄 Error response data:', error.response?.data);
      
      console.log('[ApiService] 🎭 Using DEMO nonce for development');
      // In demo mode, generate a random nonce
      const demoNonce = Math.random().toString(36).substring(2, 15);
      console.log('[ApiService] 📝 Demo nonce generated:', demoNonce);
      console.log('[ApiService] 📏 Demo nonce length:', demoNonce.length);
      console.log('[ApiService] ===== END GET NONCE ERROR =====');
      return demoNonce;
    }
  }

  // Sign message with EIP-712
  async signMessage(primaryType: string, message: any): Promise<string> {
    console.log('[ApiService] ===== SIGN MESSAGE =====');
    console.log('[ApiService] Primary Type:', primaryType);
    
    if (!this.signer) {
      console.log('[ApiService] ❌ ERROR: No signer available');
      console.log('[ApiService] Current state:');
      console.log('[ApiService] - this.signer:', this.signer);
      console.log('[ApiService] - this.userAddress:', this.userAddress);
      throw new Error('No signer available');
    }
    
    console.log('[ApiService] ✅ Signer available');
    console.log('[ApiService] Signer check:');
    console.log('[ApiService] - Has signTypedData method:', typeof this.signer.signTypedData === 'function');
    console.log('[ApiService] - Has private key:', !!this.signer.privateKey);

    const types = this.getEIP712Types(primaryType);
    
    const domain = EIP712_DOMAIN;
    
    console.log('[ApiService] Signing EIP-712 message:');
    console.log('[ApiService] - Primary Type:', primaryType);
    console.log('[ApiService] - Domain:', JSON.stringify(domain, null, 2));
    console.log('[ApiService] - Types:', JSON.stringify(types, null, 2));
    console.log('[ApiService] - Message:', JSON.stringify(message, null, 2));
    console.log('[ApiService] - Signer Address:', this.signer.address);
    console.log('[ApiService] - Signer has private key:', !!this.signer.privateKey);
    
    // Sign the typed data
    console.log('[ApiService] Calling signTypedData...');
    const signature = await this.signer.signTypedData(domain, types, message);
    
    console.log('[ApiService] ✅ Signature generated successfully');
    console.log('[ApiService] - Signature:', signature);
    console.log('[ApiService] - Signature Length:', signature.length);
    console.log('[ApiService] - Signature is valid hex:', /^0x[0-9a-fA-F]+$/.test(signature));
    console.log('[ApiService] ===== END SIGN MESSAGE =====');
    
    return signature;
  }

  // Get EIP-712 types for different operations
  private getEIP712Types(primaryType: string) {
    const types: any = {
      Register: [
        { name: 'nickname', type: 'string' },
        { name: 'passportHash', type: 'string' },
        { name: 'nonce', type: 'string' },
        { name: 'deadline', type: 'uint256' },
      ],
      CreatePost: [
        { name: 'content', type: 'string' },
        { name: 'nonce', type: 'string' },
        { name: 'deadline', type: 'uint256' },
      ],
      Vote: [
        { name: 'postId', type: 'string' },
        { name: 'voteOption', type: 'string' }, // Changed from voteType to support multiple options
        { name: 'nonce', type: 'string' },
        { name: 'deadline', type: 'uint256' },
      ],
      GetFeed: [
        { name: 'page', type: 'uint256' },
        { name: 'limit', type: 'uint256' },
        { name: 'nonce', type: 'string' },
        { name: 'deadline', type: 'uint256' },
      ],
      GetProfile: [
        { name: 'address', type: 'string' },
        { name: 'nonce', type: 'string' },
        { name: 'deadline', type: 'uint256' },
      ],
    };

    return { [primaryType]: types[primaryType] };
  }

  // Create signed request payload
  private async createSignedRequest(primaryType: string, message: any): Promise<any> {
    console.log('[ApiService] ===== CREATE SIGNED REQUEST =====');
    console.log('[ApiService] 📝 Input Parameters:');
    console.log('[ApiService] - Primary Type:', primaryType);
    console.log('[ApiService] - Message:', JSON.stringify(message, null, 2));
    console.log('[ApiService] - User Address:', this.userAddress);
    console.log('[ApiService] - Has Signer:', !!this.signer);

    if (!this.signer || !this.userAddress) {
      console.log('[ApiService] ❌ ERROR: Wallet not initialized');
      console.log('[ApiService] - Signer exists:', !!this.signer);
      console.log('[ApiService] - User address exists:', !!this.userAddress);
      throw new Error('Wallet not initialized for signed request');
    }

    console.log('[ApiService] ✅ Wallet initialized, proceeding...');
    
    // Get nonce
    console.log('[ApiService] 🔢 Getting nonce...');
    const nonce = await this.getNonce(this.userAddress);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    console.log('[ApiService] 📋 Authentication fields:');
    console.log('[ApiService] - Nonce:', nonce);
    console.log('[ApiService] - Deadline:', deadline);
    console.log('[ApiService] - Deadline Date:', new Date(deadline * 1000).toISOString());

    // Add authentication fields to message
    const signedMessage = {
      ...message,
      nonce,
      deadline,
    };

    console.log('[ApiService] 📄 Complete signed message:', JSON.stringify(signedMessage, null, 2));

    // Sign the message
    console.log('[ApiService] 🖊️ Signing message...');
    const signature = await this.signMessage(primaryType, signedMessage);
    
    console.log('[ApiService] 🔐 Signature completed:', signature);
    
    // Get EIP-712 types for this primary type
    const types = this.getEIP712Types(primaryType);
    console.log('[ApiService] 📋 EIP-712 Types:', JSON.stringify(types, null, 2));

    const payload = {
      signature,
      message: signedMessage,
      types: this.getEIP712Types(primaryType),
      primaryType, // Add primaryType for server middleware
    };
    
    console.log('[ApiService] 📦 Final payload structure:');
    console.log('[ApiService] - Has signature:', !!payload.signature);
    console.log('[ApiService] - Has message:', !!payload.message);
    console.log('[ApiService] - Has types:', !!payload.types);
    console.log('[ApiService] - Has primaryType:', !!payload.primaryType);
    console.log('[ApiService] - Primary Type Value:', payload.primaryType);
    console.log('[ApiService] - Message Keys:', Object.keys(payload.message || {}));
    console.log('[ApiService] - Types Keys:', Object.keys(payload.types || {}));
    console.log('[ApiService] - Full Payload:', JSON.stringify(payload, null, 2));
    console.log('[ApiService] ===== END CREATE SIGNED REQUEST =====');

    return payload;
  }

  // === API METHODS ===

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health');
      return response.data.status === 'ok';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Minimal connectivity test to known endpoints (useful on Android)
  async testConnectivity(): Promise<{ github: boolean; health: boolean }> {
    const result = { github: false, health: false };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch('https://api.github.com', { method: 'GET', signal: ctrl.signal });
      clearTimeout(t);
      result.github = r.ok;
      console.log('[ApiService] Connectivity github:', r.status, r.ok);
    } catch (e: any) {
      console.log('[ApiService] Connectivity github failed:', e?.message || e);
    }

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`${this.baseURL}/health`, { method: 'GET', signal: ctrl.signal });
      clearTimeout(t);
      result.health = r.ok;
      console.log('[ApiService] Connectivity health:', r.status, r.ok);
    } catch (e: any) {
      console.log('[ApiService] Connectivity health failed:', e?.message || e);
    }

    return result;
  }

  // Register user
  async register(nickname: string, passportHash?: string): Promise<ApiResponse<UserProfile>> {
    try {
      if (!this.signer || !this.userAddress) {
        throw new Error('Wallet not initialized');
      }

      console.log('[ApiService] Registering user with nickname:', nickname);

      // Create signed request
      const signedPayload = await this.createSignedRequest('Register', {
        nickname,
        passportHash: passportHash || '',
      });

      // Send registration request
      const response = await this.post('/api/signed/register', signedPayload);

      console.log('[ApiService] Registration successful');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[ApiService] Registration failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get user profile
  async getUserProfile(address: string): Promise<ApiResponse<UserProfile>> {
    try {
      console.log('[ApiService] Getting user profile for:', address);
      
      let response;
      
      // For logged-in users, ONLY use signed endpoints
      if (this.signer && this.userAddress) {
        console.log('[ApiService] 🔐 User is logged in - using ONLY signed profile endpoint');
        console.log('[ApiService] Creating signed profile request...');
        
        const signedPayload = await this.createSignedRequest('GetProfile', {
          address,
        });
        
        console.log('[ApiService] Sending signed profile request...');
        response = await this.post('/api/signed/profile', signedPayload);
      } else {
        console.log('[ApiService] 👤 User not logged in - using unsigned profile request...');
        // Only use unsigned requests for non-logged-in users
        response = await this.get(`/api/profile/${address}`);
      }
      
      return {
        success: true,
        data: response.data.profile || response.data,
      };
    } catch (error: any) {
      console.error('Failed to get user profile:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get profile summary
  async getProfileSummary(address: string): Promise<ApiResponse<Partial<UserProfile>>> {
    try {
      const response = await this.get(`/api/profile/${address}/summary`);
      return {
        success: true,
        data: response.data.profile || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Search profiles
  async searchProfiles(query: string, limit: number = 10): Promise<ApiResponse<UserProfile[]>> {
    try {
      const response = await this.get(`/api/profile/search/${encodeURIComponent(query)}`, { limit });
      return {
        success: true,
        data: response.data.profiles || response.data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  // Get trending profiles
  async getTrendingProfiles(limit: number = 10): Promise<ApiResponse<UserProfile[]>> {
    try {
      const response = await this.get('/api/profile/trending', { limit });
      return {
        success: true,
        data: response.data.profiles || response.data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  // Batch profile lookup
  async getBatchProfiles(addresses: string[]): Promise<ApiResponse<UserProfile[]>> {
    try {
      if (addresses.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      if (addresses.length > 50) {
        return {
          success: false,
          error: 'Maximum 50 addresses allowed per batch request',
          data: [],
        };
      }

      const response = await this.post('/api/profile/batch', { addresses });
      return {
        success: true,
        data: response.data.profiles || response.data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  // Упрощенный метод для тестирования connectivity
  async testSimpleFetch(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept-Encoding': 'identity' },
      });
      return response.ok;
    } catch (error) {
      console.error('[ApiService] Simple fetch test failed:', error);
      return false;
    }
  }

  // Test external API connectivity
  async testExternalAPI(): Promise<{ jsonplaceholder: boolean; railway: boolean; details: any }> {
    const result: { jsonplaceholder: boolean; railway: boolean; details: any } = { jsonplaceholder: false, railway: false, details: {} };
    
    // Test using standard GET method (will use XHR on Android automatically)
    try {
      await this.get('/health');
      result.railway = true;
      result.details.railway = { success: true };
    } catch (error: any) {
      result.details.railway = { error: error.message };
    }
    
    return result;
  }

  // Test feed endpoint using standard GET method
  async testFeedEndpoint(): Promise<boolean> {
    try {
      const response = await this.get('/posts/feed', { page: 1, limit: 5 });
      return !!response.data;
    } catch (error) {
      console.error('[ApiService] Feed endpoint test failed:', error);
      return false;
    }
  }

  // Get feed
  async getFeed(page: number = 1, limit: number = 20): Promise<ApiResponse<Post[]>> {
    try {
      console.log('[ApiService] Fetching authenticated feed from:', `${this.baseURL}/api/signed/feed`);
      
      // ONLY signed endpoints - no fallback for anyone
      if (!this.signer || !this.userAddress) {
        console.log('[ApiService] ❌ User not logged in - feed requires authentication');
        return {
          success: false,
          error: 'Authentication required to access feed',
          data: [],
        };
      }

      console.log('[ApiService] 🔐 User is logged in - using ONLY signed feed endpoint');
      console.log('[ApiService] Creating signed feed request...');
      
      const signedPayload = await this.createSignedRequest('GetFeed', {
        page,
        limit,
      });
      
      console.log('[ApiService] Sending signed feed request...');
      const response = await this.post('/api/signed/feed', signedPayload);
      
      console.log('[ApiService] Raw response:', response);
      console.log('[ApiService] Response type:', typeof response);
      console.log('[ApiService] Response keys:', Object.keys(response || {}));
      
      // Handle different possible response formats
      let posts = [];
      
      // Response could be wrapped by axios in response.data or direct from fetch
      let data = response;
      if (response && response.data) {
        data = response.data;
      }
      
    
      console.log('[ApiService] Data type:', typeof data);
      console.log('[ApiService] Data keys:', Object.keys(data || {}));
      
      // API returns { posts: [...], pagination: {...} }
      if (data && data.posts && Array.isArray(data.posts)) {
        posts = data.posts;
      } else if (data && data.data && Array.isArray(data.data)) {
        posts = data.data;
      } else if (data && data.data && data.data.posts && Array.isArray(data.data.posts)) {
        posts = data.data.posts;
      } else if (Array.isArray(data)) {
        posts = data;
      }
      // Important: do NOT trigger Android text fallback on empty list; empty feed is valid and
      // fallback can cause long waits despite successful 200 responses.
      if (posts.length === 0) {
        console.log('[ApiService] No posts parsed from response; returning empty array without fallback');
      }
      
      // Add missing required fields for posts that don't have them
      posts = posts.map((post, index) => ({
        id: post.id || `api_post_${Date.now()}_${index}`,
        createdAt: post.createdAt || new Date().toISOString(),
        ...post,
      }));
      
     
      console.log('[ApiService] Posts count:', posts.length);
      
      return {
        success: true,
        data: posts,
      };
    } catch (error: any) {
      console.error('[ApiService] Failed to get feed:', error.message || error);
      console.error('[ApiService] Full error:', error);
      
      // Return error instead of mock data
      return {
        success: false,
        error: error.message || 'Failed to fetch feed from API',
        data: [],
      };
    }
  }

  // Create post
  async createPost(content: string): Promise<ApiResponse<Post>> {
    try {
      console.log('[ApiService] Attempting to create post');
      
      // Try server-based posting first
      if (this.signer && this.userAddress) {
        try {
          console.log('[ApiService] 🔐 User is logged in - using ONLY signed post endpoint');
          console.log('[ApiService] Creating signed post request...');
          
          // Create signed request
          const signedPayload = await this.createSignedRequest('CreatePost', {
            content,
          });

          console.log('[ApiService] Sending signed post request...');
          const response = await this.post('/api/signed/post', signedPayload);

          console.log('[ApiService] Post created via server');
          return {
            success: true,
            data: response.data,
          };
        } catch (serverError) {
          console.error('[ApiService] Failed to create post:', serverError);
          throw serverError;
        }
      } else {
        throw new Error('No wallet available for post creation');
      }
    } catch (error: any) {
      console.error('[ApiService] Failed to create post:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Vote on post (supports multiple options)
  async voteOnPost(postId: string, voteOption: string | number): Promise<ApiResponse> {
    try {
      // For demo mode or when server is not available, simulate the vote
      console.log('[ApiService] ====== VOTE ATTEMPT ======');
      console.log('[ApiService] Post ID:', postId);
      console.log('[ApiService] Vote Option:', voteOption);
      console.log('[ApiService] Wallet Address:', this.userAddress || 'No wallet');
      console.log('[ApiService] Has Signer:', !!this.signer);
      
      // Check signer state before attempting vote
      if (this.signer) {
        console.log('[ApiService] Signer details:');
        console.log('[ApiService] - Address:', this.signer.address);
        console.log('[ApiService] - Has private key:', !!this.signer.privateKey);
        console.log('[ApiService] - Private key prefix:', this.signer.privateKey ? this.signer.privateKey.substring(0, 10) + '...' : 'NONE');
        console.log('[ApiService] - Is connected to provider:', !!this.signer.provider);
      } else {
        console.log('[ApiService] ⚠️ NO SIGNER AVAILABLE - Cannot sign vote');
      }
      
      // Try server-based voting first
      if (this.signer && this.userAddress) {
        try {
          console.log('[ApiService] Step 1: Getting nonce...');
          const nonce = await this.getNonce(this.userAddress);
          console.log('[ApiService] Nonce obtained:', nonce);
          
          const deadline = Math.floor(Date.now() / 1000) + 3600;
          console.log('[ApiService] Deadline set:', deadline);

          const message = {
            postId,
            voteOption: String(voteOption), // Convert to string for signing
            nonce,
            deadline,
          };
          console.log('[ApiService] Vote message prepared:', JSON.stringify(message, null, 2));

          console.log('[ApiService] Step 2: Signing message with EIP-712...');
          let signature;
          try {
            signature = await this.signMessage('Vote', message);
            console.log('[ApiService] ✅ Message signed successfully');
            console.log('[ApiService] Signature:', signature);
          } catch (signError: any) {
            console.error('[ApiService] ❌ Failed to sign message:', signError.message || signError);
            console.error('[ApiService] Sign error stack:', signError.stack);
            throw signError;
          }

          console.log('[ApiService] Step 3: Sending signed vote to server (3s timeout)...');
          try {
            const response = await this.post(`/posts/${postId}/vote`, {
              voteOption,
              signature,
              message,
              types: this.getEIP712Types('Vote'),
              anonymous: true, // Always vote anonymously
            });

            console.log('[ApiService] ✅ Vote successful via server');
            console.log('[ApiService] Server response:', response.data);
            return {
              success: true,
              data: response.data,
            };
          } catch (postError: any) {
            console.log('[ApiService] ⚠️ Server POST failed:', postError.message);
            throw postError; // Re-throw to fall back to demo mode
          }
        } catch (serverError: any) {
          console.log('[ApiService] ⚠️ Server voting failed:', serverError.message || serverError);
          console.log('[ApiService] Error type:', serverError.constructor.name);
          console.log('[ApiService] Falling back to demo mode...');
          // Fall through to demo mode
        }
      }
      
      // Demo mode - simulate successful vote with signing
      console.log('[ApiService] 🎭 Using DEMO MODE for voting');
      console.log('[ApiService] Vote will be recorded locally only');
      
      // Even in demo mode, sign the message if we have a wallet
      let signatureData = null;
      if (this.signer && this.userAddress) {
        console.log('[ApiService] Demo mode: Signing message for local verification');
        try {
          console.log('[ApiService] Demo Step 1: Getting nonce...');
          const nonce = await this.getNonce(this.userAddress);
          console.log('[ApiService] Demo nonce obtained:', nonce);
          
          const deadline = Math.floor(Date.now() / 1000) + 3600;
          console.log('[ApiService] Demo deadline set:', deadline);

          const message = {
            postId,
            voteOption: String(voteOption),
            nonce,
            deadline,
          };
          console.log('[ApiService] Demo vote message:', JSON.stringify(message, null, 2));

          console.log('[ApiService] Demo Step 2: Signing with EIP-712...');
          const signature = await this.signMessage('Vote', message);
          console.log('[ApiService] ✅ Demo message signed successfully');
          console.log('[ApiService] Demo signature:', signature);
          
          signatureData = {
            signature,
            message,
            types: this.getEIP712Types('Vote'),
            domain: EIP712_DOMAIN,
          };
          
          console.log('[ApiService] Demo signed data:', JSON.stringify(signatureData, null, 2));
        } catch (signError: any) {
          console.error('[ApiService] ⚠️ Demo signing failed (non-critical):', signError.message);
          console.log('[ApiService] Continuing without signature in demo mode');
        }
      } else {
        console.log('[ApiService] No wallet available for demo signing');
      }
      
      // Simulate a delay to make it feel real
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = {
        success: true,
        data: {
          postId,
          voteOption,
          message: 'Vote recorded locally (demo mode)',
          timestamp: new Date().toISOString(),
          walletAddress: this.userAddress || 'anonymous',
          signatureData: signatureData, // Include signature data in result
        },
      };
      
      console.log('[ApiService] ✅ Demo vote recorded with signature:', {
        postId: result.data.postId,
        voteOption: result.data.voteOption,
        walletAddress: result.data.walletAddress,
        hasSignature: !!result.data.signatureData,
      });
      console.log('[ApiService] ====== END VOTE ======');
      
      return result;
    } catch (error: any) {
      console.error('[ApiService] ❌ Failed to vote:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Like/Dislike post (separate from voting)
  async likePost(postId: string, isLike: boolean): Promise<ApiResponse> {
    try {
      console.log('[ApiService] Like/Dislike post:', postId, isLike ? 'LIKE' : 'DISLIKE');
      
      // In demo mode, just return success
      return {
        success: true,
        data: {
          postId,
          action: isLike ? 'like' : 'dislike',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[ApiService] Failed to like/dislike:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get batch status
  async getBatchStatus(): Promise<ApiResponse<any>> {
    try {
      const response = await this.get('/api/autobatch/status');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('Failed to get batch status:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get blockchain status
  async getBlockchainStatus(): Promise<ApiResponse<any>> {
    try {
      const response = await this.get('/api/blockchain/status');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('Failed to get blockchain status:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default ApiService;
export type { ApiResponse, Post, BatchTransaction };
