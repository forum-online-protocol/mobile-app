import { Platform } from 'react-native';
import { ethers } from 'ethers';
import { UserProfile } from '../types';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://forum-api-production-42de.up.railway.app';
const API_TIMEOUT = 30000; // 30 seconds

// EIP-712 Domain
const EIP712_DOMAIN = {
  name: 'NFC Reader Platform',
  version: '1',
  chainId: 11155111, // Sepolia
  verifyingContract: '0x0000000000000000000000000000000000000000'
};

// Response interfaces
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

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

class ApiService {
  private static instance: ApiService;
  private authToken: string | null = null;
  private userAddress: string | null = null;
  private signer: ethers.Wallet | null = null;
  private baseURL: string = API_BASE_URL;

  private constructor() {
    console.log('[ApiService] Initialized with fetch-only implementation');
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }


  // Universal fetch wrapper
  private async fetchWrapper(url: string, options: any = {}): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    // Build headers
    const headers: any = {
      'Accept': 'application/json',
      'User-Agent': 'ForumApp/1.0',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'X-Platform': Platform.OS,
      ...options.headers,
    };

    // Add auth token if available
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    // Add Content-Type for POST requests with body
    if (options.method === 'POST' && options.body) {
      headers['Content-Type'] = 'application/json';
    }

    console.log('[ApiService] 🚀 REQUEST:', options.method || 'GET', fullUrl);
    console.log('[ApiService] 📋 Headers:', JSON.stringify(headers, null, 2));
    if (options.body) {
      console.log('[ApiService] 📦 Body length:', options.body.length, 'characters');
    }

    // Make request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[ApiService] ⏰ Request timeout after', API_TIMEOUT, 'ms');
      controller.abort();
    }, API_TIMEOUT);

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[ApiService] 📥 Response status:', response.status);
      console.log('[ApiService] 📥 Response headers:', Object.fromEntries(response.headers.entries()));

      // Handle response
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: response.statusText };
        }
        
        console.log('[ApiService] ❌ Error response:', errorData);
        
        // Check for rate limit error
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const rateLimitRemaining = response.headers.get('ratelimit-remaining');
          const rateLimitReset = response.headers.get('ratelimit-reset');
          
          console.log('[ApiService] ⚠️ RATE LIMIT HIT!');
          console.log('[ApiService] ⏰ Retry after:', retryAfter, 'seconds');
          console.log('[ApiService] 🔢 Remaining requests:', rateLimitRemaining);
          console.log('[ApiService] 🔄 Reset in:', rateLimitReset, 'seconds');
          
          const error = new Error(`Rate limit exceeded. Please wait ${retryAfter || rateLimitReset || '5 minutes'} seconds before trying again.`) as any;
          error.response = { 
            status: response.status, 
            data: errorData,
            isRateLimit: true,
            retryAfter: parseInt(retryAfter || rateLimitReset || '300')
          };
          throw error;
        }
        
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as any;
        error.response = { status: response.status, data: errorData };
        throw error;
      }

      // Parse response
      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      console.log('[ApiService] ✅ Success response data keys:', Object.keys(data || {}));
      return { data, status: response.status };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.log('[ApiService] ❌ Request aborted (timeout)');
        throw new Error('Request timeout');
      }
      
      console.log('[ApiService] ❌ Fetch error:', error.message);
      throw error;
    }
  }

  // HTTP GET
  private async get(url: string, params?: any): Promise<any> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.fetchWrapper(`${url}${queryString}`, { method: 'GET' });
  }

  // HTTP POST
  private async post(url: string, data?: any): Promise<any> {
    return this.fetchWrapper(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Initialize with wallet for real signing
  async initialize(wallet: any): Promise<void> {
    console.log('[ApiService] ===== INITIALIZE =====');
    console.log('[ApiService] Wallet received:', wallet ? 'YES' : 'NO');
    
    if (wallet) {
      console.log('[ApiService] Wallet address:', wallet.address);
      
      // Get real ethers.Wallet instance from WalletService (not just private key)
      const { WalletService } = require('./WalletService');
      const walletService = WalletService.getInstance();
      const ethersWallet = await walletService.getEthersWallet();
      
      if (ethersWallet) {
        this.signer = ethersWallet;
        this.userAddress = ethersWallet.address;
        console.log('[ApiService] ✅ Initialized with real ethers.Wallet:', this.userAddress);
        console.log('[ApiService] ✅ Real EIP-712 signing enabled');
      } else {
        console.log('[ApiService] ❌ No ethers.Wallet available for signing');
        this.signer = null;
        this.userAddress = wallet.address;
      }
      
      console.log('[ApiService] Signer set:', !!this.signer);
      console.log('[ApiService] User address set:', this.userAddress);
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

  // Generate nonce for signing
  async getNonce(address: string): Promise<string> {
    console.log('[ApiService] Getting nonce for address:', address);
    try {
      const response = await this.get(`/api/signed/nonce/${address}`);
      console.log('[ApiService] ✅ Nonce received:', response.data.nonce);
      return response.data.nonce;
    } catch (error: any) {
      console.log('[ApiService] ⚠️ Server nonce failed, using demo nonce:', error.message);
      const demoNonce = Math.random().toString(36).substring(2, 15);
      console.log('[ApiService] 📝 Demo nonce generated:', demoNonce);
      return demoNonce;
    }
  }

  // Sign message with EIP-712
  async signMessage(primaryType: string, message: any): Promise<string> {
    console.log('[ApiService] 🖊️ Signing message:', primaryType);
    
    if (!this.signer) {
      throw new Error('No signer available');
    }

    const types = this.getEIP712Types(primaryType);
    const domain = EIP712_DOMAIN;
    
    console.log('[ApiService] Signing with domain:', domain);
    console.log('[ApiService] Signing with types:', types);
    console.log('[ApiService] Signing message:', message);
    
    const signature = await this.signer.signTypedData(domain, types, message);
    
    console.log('[ApiService] ✅ Signature generated:', signature);
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
        { name: 'voteOption', type: 'string' },
        { name: 'nonce', type: 'string' },
        { name: 'deadline', type: 'uint256' },
      ],
      PassportVerification: [
        { name: 'merkleRoot', type: 'bytes32' },
        { name: 'merkleProof', type: 'bytes32[]' },
        { name: 'merkleLeaf', type: 'bytes32' },
        { name: 'nonce', type: 'string' },
        { name: 'timestamp', type: 'uint256' },
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
    console.log('[ApiService] Primary Type:', primaryType);
    console.log('[ApiService] Message:', JSON.stringify(message, null, 2));

    if (!this.signer || !this.userAddress) {
      throw new Error('Wallet not initialized for signed request');
    }

    // Get nonce
    const nonce = await this.getNonce(this.userAddress);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    // Add authentication fields to message
    const signedMessage = {
      ...message,
      nonce,
      deadline,
    };

    console.log('[ApiService] Complete signed message:', JSON.stringify(signedMessage, null, 2));

    // Sign the message
    const signature = await this.signMessage(primaryType, signedMessage);
    
    // Get EIP-712 types
    const types = this.getEIP712Types(primaryType);

    const payload = {
      signature,
      message: signedMessage,
      types,
      primaryType,
    };
    
    console.log('[ApiService] Final payload created - keys:', Object.keys(payload));
    console.log('[ApiService] ===== END CREATE SIGNED REQUEST =====');

    return payload;
  }

  // Get public feed (no authentication required)
  async getPublicFeed(page: number = 1, limit: number = 20, sort?: string): Promise<ApiResponse<Post[]>> {
    try {
      console.log('[ApiService] Getting public feed...');
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (sort) {
        params.append('sort', sort);
      }
      
      const response = await this.get(`/api/posts/feed?${params.toString()}`);
      
      // Process response
      let posts = [];
      let data = response.data || response;
      
      if (data && data.posts && Array.isArray(data.posts)) {
        posts = data.posts;
      } else if (Array.isArray(data)) {
        posts = data;
      }
      
      console.log('[ApiService] Public feed received:', posts.length, 'posts');

      // TEST: Add a long message post to test UI
      // const testLongPost = {
      //   id: 'test_long_message_' + Date.now(),
      //   content: '**Testnet Initiative : Opinion Poll on Direct Democracy/ Народне волевиявлення щодо прямої демократії/Народное Волеизъявление о Прямой Демократий**\n\nDo you support the introduction of mechanisms of direct democracy, whereby the people, rather than political elites, hold the final authority over the nation\'s future, allowing citizens to make binding decisions on national policy through referendums, rather than delegating these decisions exclusively to elected representatives?\n\nЧи підтримуєте ви запровадження механізму прямої демократії, за якого народ, а не політичні еліти, матиме суверенітет у прийнятті рішень з питань національної політики через референдуми, а не делегуватиме ці рішення виключно обраним представникам?\n\nПоддерживаете ли вы введение механизма прямой демократии, при котором народ, а не политические элиты, обладали суверенитетом в принятий решений по вопросам национальной политики через референдумы, а не делегировали эти решения исключительно избранным представителям?',
      //   author: {
      //     address: '0xTestLongMessage',
      //     displayName: 'Democracy Initiative',
      //     username: 'democracy_test',
      //     isVerified: true
      //   },
      //   timestamp: new Date().toISOString(),
      //   likes: 0,
      //   dislikes: 0,
      //   reposts: 0,
      //   hasLiked: false,
      //   hasDisliked: false,
      //   hasReposted: false,
      //   isProposal: true,
      //   voteData: {
      //     options: [
      //       { id: 'yes', label: 'Agree', count: 1523, votes: 1523 },
      //       { id: 'no', label: 'Disagree', count: 892, votes: 892 }
      //     ],
      //     deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      //     totalVotes: 2415,
      //     passportRequired: true
      //   }
      // };

      // // Prepend the test post to the feed
      // posts.unshift(testLongPost);

      return {
        success: true,
        data: posts,
      };
    } catch (error) {
      console.error('[ApiService] Public feed error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch public feed',
        data: [],
      };
    }
  }

  // Get feed (with authentication fallback to public)
  async getFeed(page: number = 1, limit: number = 20, sort?: string): Promise<ApiResponse<Post[]>> {
    try {
      console.log('[ApiService] Getting feed...');
      
      // If not authenticated, use public feed
      if (!this.signer || !this.userAddress) {
        console.log('[ApiService] No authentication - using public feed');
        return await this.getPublicFeed(page, limit, sort);
      }

      console.log('[ApiService] 🔐 Creating signed feed request...');
      
      const message: any = { page, limit };
      if (sort) {
        message.sort = sort;
      }
      
      const signedPayload = await this.createSignedRequest('GetFeed', message);
      
      console.log('[ApiService] Sending signed feed request...');
      const response = await this.post('/api/signed/feed', signedPayload);

      // Process response
      let posts = [];
      let data = response.data || response;
      
      if (data && data.posts && Array.isArray(data.posts)) {
        posts = data.posts;
      } else if (Array.isArray(data)) {
        posts = data;
      }
      
      console.log('[ApiService] Feed received:', posts.length, 'posts');
      
      // Focus on post_commandment_1 specifically
      console.log('[ApiService] 🎯 SEARCHING FOR post_commandment_1...');
      const targetPost = posts.find(post => post.id === 'post_commandment_1');
      
      if (targetPost) {
        console.log('[ApiService] ✅ FOUND post_commandment_1:');
        console.log('[ApiService] COMPLETE post_commandment_1 structure:', JSON.stringify(targetPost, null, 2));
        console.log('[ApiService] post_commandment_1 vote fields:', {
          id: targetPost.id,
          hasVoteData: !!targetPost.voteData,
          voteDataComplete: targetPost.voteData,
          allowedCountries: targetPost.allowedCountries,
          minAgeRange: targetPost.minAgeRange,
          eligibilityRoot: targetPost.eligibilityRoot,
          // All possible user vote fields
          userVote: targetPost.userVote,
          hasVoted: targetPost.hasVoted,
          myVote: targetPost.myVote,
          currentUserVote: targetPost.currentUserVote,
          voted: targetPost.voted,
          userChoice: targetPost.userChoice,
          userSelected: targetPost.userSelected,
          currentVote: targetPost.currentVote
        });
      } else {
        console.log('[ApiService] ❌ post_commandment_1 NOT FOUND in feed');
        console.log('[ApiService] Available post IDs:', posts.map(p => p.id));
      }
      
      // Also log raw response for completeness
      console.log('[ApiService] 🔍 RAW API RESPONSE:');
      console.log('[ApiService] Response status:', response.status);
      console.log('[ApiService] Response data keys:', response.data ? Object.keys(response.data) : 'null');

      // TEST: Add a long message post to test UI
      // const testLongPost = {
      //   id: 'test_long_message_' + Date.now(),
      //   content: '**Testnet Initiative : Opinion Poll on Direct Democracy/ Народне волевиявлення щодо прямої демократії/Народное Волеизъявление о Прямой Демократий**\n\nDo you support the introduction of mechanisms of direct democracy, whereby the people, rather than political elites, hold the final authority over the nation\'s future, allowing citizens to make binding decisions on national policy through referendums, rather than delegating these decisions exclusively to elected representatives?\n\nЧи підтримуєте ви запровадження механізму прямої демократії, за якого народ, а не політичні еліти, матиме суверенітет у прийнятті рішень з питань національної політики через референдуми, а не делегуватиме ці рішення виключно обраним представникам?\n\nПоддерживаете ли вы введение механизма прямой демократии, при котором народ, а не политические элиты, обладали суверенитетом в принятий решений по вопросам национальной политики через референдумы, а не делегировали эти решения исключительно избранным представителям?',
      //   author: {
      //     address: '0xTestLongMessage',
      //     displayName: 'Democracy Initiative',
      //     username: 'democracy_test',
      //     isVerified: true
      //   },
      //   timestamp: new Date().toISOString(),
      //   likes: 0,
      //   dislikes: 0,
      //   reposts: 0,
      //   hasLiked: false,
      //   hasDisliked: false,
      //   hasReposted: false,
      //   isProposal: true,
      //   voteData: {
      //     options: [
      //       { id: 'yes', label: 'Agree', count: 1523, votes: 1523 },
      //       { id: 'no', label: 'Disagree', count: 892, votes: 892 }
      //     ],
      //     deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      //     totalVotes: 2415,
      //     passportRequired: true
      //   }
      // };

      // // Prepend the test post to the feed
      // posts.unshift(testLongPost);

      return {
        success: true,
        data: posts,
      };
    } catch (error: any) {
      console.error('[ApiService] Failed to get feed:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch feed',
        data: [],
      };
    }
  }

  // Get user profile
  async getUserProfile(address: string): Promise<ApiResponse<UserProfile>> {
    try {
      console.log('[ApiService] Getting user profile for:', address);
      
      let response;
      
      // For logged-in users, use signed endpoints
      if (this.signer && this.userAddress) {
        console.log('[ApiService] 🔐 Creating signed profile request...');
        
        const signedPayload = await this.createSignedRequest('GetProfile', {
          address,
        });
        
        response = await this.post('/api/signed/profile', signedPayload);
      } else {
        console.log('[ApiService] 👤 Using unsigned profile request...');
        response = await this.get(`/api/profile/${address}`);
      }
      
      return {
        success: true,
        data: response.data.profile || response.data,
      };
    } catch (error: any) {
      console.error('[ApiService] Failed to get user profile:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get current user's profile with voting history
  async getMyProfileWithVotingHistory(): Promise<ApiResponse<any>> {
    try {
      if (!this.signer || !this.userAddress) {
        throw new Error('Wallet not initialized for profile access');
      }

      console.log('[ApiService] Getting my profile with voting history...');
      
      // Use the same signature structure as regular getUserProfile but for own profile
      const signedPayload = await this.createSignedRequest('GetProfile', {
        address: this.userAddress,
      });

      console.log('[ApiService] Sending signed profile request with voting history...');
      const response = await this.post('/api/signed/profile', signedPayload);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[ApiService] Failed to get profile with voting history:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Create post
  async createPost(content: string): Promise<ApiResponse<Post>> {
    try {
      if (!this.signer || !this.userAddress) {
        throw new Error('No wallet available for post creation');
      }

      console.log('[ApiService] 🔐 Creating signed post request...');
      
      const signedPayload = await this.createSignedRequest('CreatePost', {
        content,
      });

      const response = await this.post('/api/signed/post', signedPayload);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[ApiService] Failed to create post:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('[ApiService] Health check failed:', error);
      return false;
    }
  }

  // Test external APIs
  async testExternalAPI(): Promise<{ jsonplaceholder: boolean; railway: boolean; details: any }> {
    const result = { jsonplaceholder: false, railway: false, details: {} };
    
    // Test JSONPlaceholder
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      result.jsonplaceholder = response.ok;
      result.details.jsonplaceholder = { status: response.status };
    } catch (error: any) {
      console.log('[ApiService] JSONPlaceholder test failed:', error.message);
      result.details.jsonplaceholder = { error: error.message };
    }

    // Test Railway health
    try {
      const response = await this.get('/health');
      result.railway = response.status === 200;
      result.details.railway = { status: response.status };
    } catch (error: any) {
      console.log('[ApiService] Railway test failed:', error.message);
      result.details.railway = { error: error.message };
    }

    console.log('[ApiService] External API test results:', result);
    return result;
  }

  // Test connectivity
  async testConnectivity(): Promise<{ github: boolean; health: boolean }> {
    const result = { github: false, health: false };
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch('https://api.github.com', { 
        method: 'GET', 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      result.github = response.ok;
      console.log('[ApiService] GitHub connectivity:', response.status, response.ok);
    } catch (error: any) {
      console.log('[ApiService] GitHub connectivity failed:', error.message);
    }

    try {
      const response = await this.get('/health');
      result.health = response.status === 200;
      console.log('[ApiService] Health connectivity:', result.health);
    } catch (error: any) {
      console.log('[ApiService] Health connectivity failed:', error.message);
    }

    return result;
  }

  // Clear authentication
  async clearAuth() {
    this.authToken = null;
    this.userAddress = null;
    this.signer = null;
    console.log('[ApiService] Authentication cleared');
  }

  // Register user (if needed)
  async register(nickname: string, passportHash?: string): Promise<ApiResponse<UserProfile>> {
    try {
      if (!this.signer || !this.userAddress) {
        throw new Error('Wallet not initialized for registration');
      }

      const signedPayload = await this.createSignedRequest('Register', {
        nickname,
        passportHash: passportHash || '',
      });

      const response = await this.post('/api/signed/register', signedPayload);

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

  // Vote on post with Merkle proof verification
  async voteOnPost(postId: string, voteOption: string | number, verificationProof?: any): Promise<ApiResponse<any>> {
    try {
      if (!this.signer || !this.userAddress) {
        throw new Error('Wallet not initialized for voting');
      }

      console.log('[ApiService] 🗳️ Voting on post with Merkle verification...');
      
      // Special logging for post_commandment_1
      if (postId === 'post_commandment_1') {
        console.log('[ApiService] 🎯 VOTING ON post_commandment_1:');
        console.log('[ApiService] Post ID:', postId);
        console.log('[ApiService] Vote Option:', voteOption);
        console.log('[ApiService] Signer Address:', this.userAddress);
        console.log('[ApiService] Has Verification Proof:', !!verificationProof);
        if (verificationProof) {
          console.log('[ApiService] Verification Proof Structure:', JSON.stringify(verificationProof, null, 2));
        }
      }

      // Create verification object with all required fields
      let verification = null;
      if (verificationProof && typeof verificationProof === 'object') {
        // Check if proof timestamp is too old (server allows 300s window)
        const currentTime = Math.floor(Date.now() / 1000);
        const proofAge = currentTime - verificationProof.timestamp;
        
        console.log('[ApiService] Timestamp validation:', {
          currentTime: currentTime,
          proofTimestamp: verificationProof.timestamp,
          proofAge: proofAge,
          maxAllowed: 300,
          isValid: Math.abs(proofAge) <= 300
        });
        
        // If proof is too old, we need to regenerate it
        if (Math.abs(proofAge) > 300) {
          console.log('[ApiService] ⚠️ Verification proof is too old, need to regenerate');
          throw new Error('Verification proof expired. Please try voting again.');
        }

        // Use the original nonce and timestamp from the verification proof
        // (these were used when the signature was generated)
        verification = {
          signature: verificationProof.signature,
          merkleRoot: verificationProof.merkleRoot,
          merkleProof: verificationProof.merkleProof,
          merkleLeaf: verificationProof.merkleLeaf,
          postId: postId,
          voteOption: voteOption.toString(),
          nonce: verificationProof.nonce,
          timestamp: verificationProof.timestamp
        };

        console.log('[ApiService] Created verification object:', {
          hasSignature: !!verification.signature,
          merkleRoot: verification.merkleRoot?.substring(0, 10) + '...',
          merkleProofLength: verification.merkleProof?.length,
          merkleLeaf: verification.merkleLeaf?.substring(0, 10) + '...',
          postId: verification.postId,
          voteOption: verification.voteOption,
          nonce: verification.nonce,
          timestamp: verification.timestamp
        });
      } else {
        console.log('[ApiService] ❌ No verification proof provided in vote request');
        throw new Error('Verification proof required for voting');
      }

      // Create request body in correct format for server
      const requestBody = {
        voteOption: voteOption.toString(),
        verification: verification
      };

      console.log('[ApiService] Request body structure:', {
        voteOption: requestBody.voteOption,
        hasVerification: !!requestBody.verification,
        verificationKeys: requestBody.verification ? Object.keys(requestBody.verification) : []
      });

      console.log('[ApiService] Full request body being sent:', JSON.stringify(requestBody, null, 2));

      // Use correct endpoint: /api/posts/{postId}/vote
      const response = await this.post(`/api/posts/${postId}/vote`, requestBody);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[ApiService] Vote failed:', error);
      console.error('[ApiService] Error response details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message,
        serverResponse: error.response?.data
      };
    }
  }

  // Check voting eligibility for a proposal
  async checkVotingEligibility(postId: string): Promise<ApiResponse<any>> {
    try {
      console.log('[ApiService] Checking voting eligibility for post:', postId);

      const response = await this.get(`/api/proposal/${postId}/eligibility`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[ApiService] Eligibility check failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to check eligibility',
      };
    }
  }

  // Get a single post by ID
  async getPost(postId: string): Promise<ApiResponse<any>> {
    try {
      console.log('[ApiService] Getting post:', postId);

      // Try unsigned endpoint first
      const response = await this.get(`/api/posts/${postId}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[ApiService] Failed to get post:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch post',
      };
    }
  }

  // Check app version
  async checkVersion(): Promise<ApiResponse<any>> {
    try {
      console.log('[ApiService] Checking app version...');

      const response = await this.get('/api/version');

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[ApiService] Failed to check version:', error);
      return {
        success: false,
        error: error.message || 'Failed to check version',
      };
    }
  }
}

export default ApiService;