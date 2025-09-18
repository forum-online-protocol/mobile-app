import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface StorageKeys {
  USER_PROFILE: string;
  WALLET_DATA: string;
  POSTS_CACHE: string;
  USER_VOTES: string;
  DRAFT_POSTS: string;
  SETTINGS: string;
  AUTH_TOKEN: string;
  LAST_SYNC: string;
}

const STORAGE_KEYS: StorageKeys = {
  USER_PROFILE: '@forum_user_profile',
  WALLET_DATA: '@forum_wallet_data',
  POSTS_CACHE: '@forum_posts_cache',
  USER_VOTES: '@forum_user_votes',
  DRAFT_POSTS: '@forum_draft_posts',
  SETTINGS: '@forum_settings',
  AUTH_TOKEN: '@forum_auth_token',
  LAST_SYNC: '@forum_last_sync',
};

export interface UserVote {
  postId: string;
  voteType: string;
  timestamp: string;
  anonymous?: boolean;
  verificationProof?: {
    merkleRoot: string;
    merkleProof: string[];
    merkleLeaf: string;
    nonce: number;
    timestamp: number;
    signature: string;
  };
}

interface DraftPost {
  id: string;
  content: string;
  isProposal: boolean;
  proposalTitle?: string;
  proposalOptions?: string[];
  createdAt: string;
  updatedAt: string;
}

class StorageService {
  private static instance: StorageService;
  private memoryCache: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Generic storage methods
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      this.memoryCache.set(key, value);
      
      if (Platform.OS === 'web') {
        localStorage.setItem(key, jsonValue);
      } else {
        await AsyncStorage.setItem(key, jsonValue);
      }
    } catch (error) {
      console.error('StorageService: Error saving item', error);
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      if (this.memoryCache.has(key)) {
        return this.memoryCache.get(key) as T;
      }

      let jsonValue: string | null;
      
      if (Platform.OS === 'web') {
        jsonValue = localStorage.getItem(key);
      } else {
        jsonValue = await AsyncStorage.getItem(key);
      }
      
      if (jsonValue != null) {
        const value = JSON.parse(jsonValue);
        this.memoryCache.set(key, value);
        return value;
      }
      
      return null;
    } catch (error) {
      console.error('StorageService: Error getting item', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('StorageService: Error removing item', error);
    }
  }

  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      
      if (Platform.OS === 'web') {
        // Clear only our app's keys
        Object.values(STORAGE_KEYS).forEach(key => {
          localStorage.removeItem(key);
        });
      } else {
        await AsyncStorage.clear();
      }
    } catch (error) {
      console.error('StorageService: Error clearing storage', error);
    }
  }

  // User Profile
  async saveUserProfile(profile: any): Promise<void> {
    await this.setItem(STORAGE_KEYS.USER_PROFILE, profile);
  }

  async getUserProfile(): Promise<any | null> {
    return this.getItem(STORAGE_KEYS.USER_PROFILE);
  }

  // Wallet Data
  async saveWalletData(walletData: any): Promise<void> {
    // Encrypt sensitive data before storing
    const sanitizedData = {
      address: walletData.address,
      // Don't store private key directly
      hasPrivateKey: !!walletData.privateKey,
    };
    await this.setItem(STORAGE_KEYS.WALLET_DATA, sanitizedData);
  }

  async getWalletData(): Promise<any | null> {
    return this.getItem(STORAGE_KEYS.WALLET_DATA);
  }

  // Posts Cache
  async savePosts(posts: any[]): Promise<void> {
    const cacheData = {
      posts,
      timestamp: new Date().toISOString(),
    };
    await this.setItem(STORAGE_KEYS.POSTS_CACHE, cacheData);
  }

  async getCachedPosts(): Promise<any[] | null> {
    const cacheData = await this.getItem<{ posts: any[]; timestamp: string }>(
      STORAGE_KEYS.POSTS_CACHE
    );
    
    if (!cacheData) return null;
    
    // Check if cache is older than 5 minutes
    const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
    if (cacheAge > 5 * 60 * 1000) {
      await this.removeItem(STORAGE_KEYS.POSTS_CACHE);
      return null;
    }
    
    return cacheData.posts;
  }

  // User Votes
  async saveUserVote(vote: UserVote): Promise<void> {
    const votes = await this.getUserVotes();
    const updatedVotes = votes.filter(v => v.postId !== vote.postId);
    updatedVotes.push(vote);
    await this.setItem(STORAGE_KEYS.USER_VOTES, updatedVotes);
  }

  async getUserVotes(): Promise<UserVote[]> {
    const votes = await this.getItem<UserVote[]>(STORAGE_KEYS.USER_VOTES);
    return votes || [];
  }

  async getUserVoteForPost(postId: string): Promise<UserVote | null> {
    const votes = await this.getUserVotes();
    return votes.find(v => v.postId === postId) || null;
  }

  // Get verification proof for a specific vote
  async getVerificationProofForPost(postId: string): Promise<UserVote['verificationProof'] | null> {
    const vote = await this.getUserVoteForPost(postId);
    return vote?.verificationProof || null;
  }

  // Get all votes with verification proofs (for audit purposes)
  async getVerifiedVotes(): Promise<UserVote[]> {
    const votes = await this.getUserVotes();
    return votes.filter(vote => vote.verificationProof);
  }

  // Export verification data for audit/backup
  async exportVerificationData(): Promise<{
    totalVotes: number;
    verifiedVotes: number;
    votesWithProofs: Array<{
      postId: string;
      voteType: string;
      timestamp: string;
      merkleRoot: string;
      signature: string;
    }>;
  }> {
    const allVotes = await this.getUserVotes();
    const verifiedVotes = allVotes.filter(vote => vote.verificationProof);
    
    return {
      totalVotes: allVotes.length,
      verifiedVotes: verifiedVotes.length,
      votesWithProofs: verifiedVotes.map(vote => ({
        postId: vote.postId,
        voteType: vote.voteType,
        timestamp: vote.timestamp,
        merkleRoot: vote.verificationProof!.merkleRoot,
        signature: vote.verificationProof!.signature,
      })),
    };
  }

  // Draft Posts
  async saveDraftPost(draft: DraftPost): Promise<void> {
    const drafts = await this.getDraftPosts();
    const index = drafts.findIndex(d => d.id === draft.id);
    
    if (index >= 0) {
      drafts[index] = { ...draft, updatedAt: new Date().toISOString() };
    } else {
      drafts.push(draft);
    }
    
    await this.setItem(STORAGE_KEYS.DRAFT_POSTS, drafts);
  }

  async getDraftPosts(): Promise<DraftPost[]> {
    const drafts = await this.getItem<DraftPost[]>(STORAGE_KEYS.DRAFT_POSTS);
    return drafts || [];
  }

  async deleteDraftPost(draftId: string): Promise<void> {
    const drafts = await this.getDraftPosts();
    const filteredDrafts = drafts.filter(d => d.id !== draftId);
    await this.setItem(STORAGE_KEYS.DRAFT_POSTS, filteredDrafts);
  }

  // Settings
  async saveSettings(settings: any): Promise<void> {
    await this.setItem(STORAGE_KEYS.SETTINGS, settings);
  }

  async getSettings(): Promise<any | null> {
    return this.getItem(STORAGE_KEYS.SETTINGS);
  }

  // Auth Token
  async saveAuthToken(token: string): Promise<void> {
    await this.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  async getAuthToken(): Promise<string | null> {
    return this.getItem<string>(STORAGE_KEYS.AUTH_TOKEN);
  }

  async clearAuthToken(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  // Sync Management
  async updateLastSync(): Promise<void> {
    await this.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  async getLastSync(): Promise<string | null> {
    return this.getItem<string>(STORAGE_KEYS.LAST_SYNC);
  }

  // Data Migration (for app updates)
  async migrateData(fromVersion: string, toVersion: string): Promise<void> {
    console.log(`Migrating data from v${fromVersion} to v${toVersion}`);
    
    // Add migration logic here based on version changes
    // Example:
    // if (fromVersion < '1.0.0' && toVersion >= '1.0.0') {
    //   // Migrate old data structure to new
    // }
  }

  // Export all data (for backup)
  async exportAllData(): Promise<any> {
    const data: any = {};
    
    for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
      const value = await this.getItem(storageKey);
      if (value) {
        data[key] = value;
      }
    }
    
    return data;
  }

  // Import data (from backup)
  async importData(data: any): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      const storageKey = STORAGE_KEYS[key as keyof StorageKeys];
      if (storageKey) {
        await this.setItem(storageKey, value);
      }
    }
  }

  // Clear all user-specific data on logout
  async clearAllUserData(): Promise<void> {
    console.log('🗑️ Clearing all user data from storage...');
    
    try {
      // Clear all storage keys
      const keysToRemove = Object.values(STORAGE_KEYS);
      
      for (const key of keysToRemove) {
        await this.removeItem(key);
        console.log(`   ✅ Cleared: ${key}`);
      }
      
      // Clear memory cache
      this.memoryCache.clear();
      
      console.log('✅ All user data cleared from StorageService');
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
      throw error;
    }
  }
}

export default StorageService;
export { STORAGE_KEYS, type DraftPost };