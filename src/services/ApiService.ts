import { Platform } from "react-native";
import { ethers } from "ethers";
import { UserProfile } from "../types";
import i18n from "../localization/i18n";
import AsyncStorageService from "./AsyncStorageService";
import {
  getPostDisplayContent,
  getPostDisplayTitle,
  normalizeAppLanguage,
} from "../utils/localizedPost";
import {
  buildRegistrationIntent,
  RegistrationIntent,
} from "../utils/registrationIntent";

// API Configuration
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.REACT_APP_API_URL ||
  "https://dev-api.votta.vote";
const API_TIMEOUT = 30000; // 30 seconds

// EIP-712 Domain
const EIP712_DOMAIN = {
  name: "NFC Reader Platform",
  version: "1",
  chainId: 11155111, // Sepolia
  verifyingContract: "0x0000000000000000000000000000000000000000",
};

// Response interfaces
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  fromCache?: boolean;
  isStale?: boolean;
  serverResponse?: any;
}

interface Post {
  id: string;
  title?: string;
  legacySource?: string;
  isReadOnlyLegacy?: boolean;
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
  localizedTitle?: string;
  localizedContent?: string;
  localization?: {
    sourceLanguage: "en" | "ru" | "ua";
    titleTranslations?: Partial<Record<"en" | "ru" | "ua", string>>;
    contentTranslations?: Partial<Record<"en" | "ru" | "ua", string>>;
    translationStatus?: string;
    lastTranslatedAt?: string;
  } | null;
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
  status?: string;
  isPending?: boolean;
  isPendingModeration?: boolean;
  moderationStatus?: {
    status?: string;
    label?: string;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
  };
  voteData?: {
    yes: number;
    no: number;
    deadline?: string;
  };
}

interface PostComment {
  id: string;
  postId: string;
  parentPostId?: string;
  content: string;
  createdAt: string;
  status?: "approved" | "pending_review" | "rejected" | string;
  isPendingModeration?: boolean;
  author: {
    id: string;
    address?: string | null;
    username: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
  isGuest?: boolean;
}

export interface PublicTransactionLogItem {
  id: string;
  action: string;
  status: "success" | "failed" | "info" | string;
  actor: string;
  source: "live" | "derived" | string;
  timestamp: string;
  txHash?: string;
  contractAddress?: string;
  entityType?: string;
  entityId?: string;
  explorerTxUrl?: string | null;
  explorerAddressUrl?: string | null;
}

type ReactionType = "like" | "repost";

export interface AppFeatureFlags {
  lotteryEnabled: boolean;
  biometricsEnabled: boolean;
  avatarUploadEnabled: boolean;
  commentsEnabled: boolean;
  anonymousPostingEnabled: boolean;
}

export interface AppConfig {
  version?: string;
  featureFlags: AppFeatureFlags;
  timestamp?: string;
}

const DEFAULT_APP_CONFIG: AppConfig = {
  featureFlags: {
    lotteryEnabled: false,
    biometricsEnabled: false,
    avatarUploadEnabled: false,
    commentsEnabled: true,
    anonymousPostingEnabled: false,
  },
};

const REGISTRATION_INTENT_STORAGE_KEY = "registration_intent";
const REGISTRATION_COMPLETED_STORAGE_KEY = "registration_completed_address";
const CURRENT_PROFILE_CACHE_KEY_PREFIX = "current_profile_cache";

interface CurrentProfileCacheEntry {
  savedAt: number;
  data: any;
}

class ApiService {
  private static instance: ApiService;
  private authToken: string | null = null;
  private userAddress: string | null = null;
  private signer: ethers.Wallet | null = null;
  private baseURL: string = API_BASE_URL;
  private readonly debugLogs = process.env.EXPO_PUBLIC_API_DEBUG === "1";
  private appConfigCache: AppConfig | null = null;
  private appConfigCacheExpiresAt = 0;
  private appConfigRequest: Promise<AppConfig> | null = null;
  private readonly appConfigCacheTtlMs = 5 * 60 * 1000;
  private readonly currentProfileCacheTtlMs = 5 * 60 * 1000;
  private currentProfileCacheMemory = new Map<string, CurrentProfileCacheEntry>();
  private registrationIntent: RegistrationIntent | null = null;
  private registrationPromise: Promise<boolean> | null = null;
  private registrationCompletedAddress: string | null = null;

  private log(...args: any[]) {
    if (this.debugLogs) {
      // Keep noisy network/debug traces behind an explicit env flag.
      console.log(...args);
    }
  }

  private constructor() {
    this.log("[ApiService] Initialized with fetch-only implementation");
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private normalizeAddress(address: string | null | undefined): string | null {
    const normalized = String(address || "")
      .trim()
      .toLowerCase();
    return normalized || null;
  }

  private getCurrentProfileCacheKey(
    address?: string | null,
  ): string | null {
    const normalizedAddress = this.normalizeAddress(address || this.userAddress);
    if (!normalizedAddress) {
      return null;
    }
    return `${CURRENT_PROFILE_CACHE_KEY_PREFIX}:${normalizedAddress}`;
  }

  private async readCurrentProfileCacheEntry(
    address?: string | null,
  ): Promise<CurrentProfileCacheEntry | null> {
    const cacheKey = this.getCurrentProfileCacheKey(address);
    if (!cacheKey) {
      return null;
    }

    const memoryEntry = this.currentProfileCacheMemory.get(cacheKey);
    if (memoryEntry && Number.isFinite(memoryEntry.savedAt)) {
      return memoryEntry;
    }

    const rawCacheEntry = await AsyncStorageService.getItem(cacheKey);
    if (!rawCacheEntry) {
      return null;
    }

    try {
      const parsedEntry = JSON.parse(rawCacheEntry);
      if (
        parsedEntry &&
        Number.isFinite(parsedEntry.savedAt) &&
        Object.prototype.hasOwnProperty.call(parsedEntry, "data")
      ) {
        const normalizedEntry: CurrentProfileCacheEntry = {
          savedAt: parsedEntry.savedAt,
          data: parsedEntry.data,
        };
        this.currentProfileCacheMemory.set(cacheKey, normalizedEntry);
        return normalizedEntry;
      }
    } catch (error) {
      this.log("[ApiService] Failed to parse current profile cache:", error);
    }

    await AsyncStorageService.removeItem(cacheKey);
    this.currentProfileCacheMemory.delete(cacheKey);
    return null;
  }

  private async writeCurrentProfileCache(
    address: string,
    data: any,
  ): Promise<void> {
    const cacheKey = this.getCurrentProfileCacheKey(address);
    if (!cacheKey) {
      return;
    }

    const nextEntry: CurrentProfileCacheEntry = {
      savedAt: Date.now(),
      data,
    };

    this.currentProfileCacheMemory.set(cacheKey, nextEntry);
    await AsyncStorageService.setItem(cacheKey, JSON.stringify(nextEntry));
  }

  async getCachedCurrentProfile(options?: {
    address?: string;
    maxAgeMs?: number;
    allowStale?: boolean;
  }): Promise<ApiResponse<any>> {
    const normalizedAddress = this.normalizeAddress(
      options?.address || this.userAddress,
    );
    if (!normalizedAddress) {
      return {
        success: false,
        error: "Wallet not initialized for cached profile access",
      };
    }

    const entry = await this.readCurrentProfileCacheEntry(normalizedAddress);
    if (!entry) {
      return {
        success: false,
        error: "Cached profile not available",
      };
    }

    const maxAgeMs =
      typeof options?.maxAgeMs === "number" && options.maxAgeMs > 0
        ? options.maxAgeMs
        : this.currentProfileCacheTtlMs;
    const isStale = Date.now() - entry.savedAt > maxAgeMs;

    if (isStale && options?.allowStale !== true) {
      return {
        success: false,
        error: "Cached profile is stale",
      };
    }

    return {
      success: true,
      data: entry.data,
      fromCache: true,
      isStale,
    };
  }

  async primeCurrentProfileCache(
    data: any,
    options?: { address?: string },
  ): Promise<void> {
    const normalizedAddress = this.normalizeAddress(
      options?.address || this.userAddress,
    );
    if (!normalizedAddress || !data) {
      return;
    }

    await this.writeCurrentProfileCache(normalizedAddress, data);
  }

  async patchCurrentProfileCache(
    profilePatch: Record<string, any>,
    options?: { address?: string },
  ): Promise<void> {
    const normalizedAddress = this.normalizeAddress(
      options?.address || this.userAddress,
    );
    if (!normalizedAddress || !profilePatch) {
      return;
    }

    const existingEntry = await this.readCurrentProfileCacheEntry(
      normalizedAddress,
    );
    const existingData =
      existingEntry && existingEntry.data && typeof existingEntry.data === "object"
        ? existingEntry.data
        : {};
    const existingProfile =
      existingData.profile && typeof existingData.profile === "object"
        ? existingData.profile
        : {};

    await this.writeCurrentProfileCache(normalizedAddress, {
      ...existingData,
      profile: {
        ...existingProfile,
        ...profilePatch,
      },
    });
  }

  async clearCurrentProfileCache(address?: string): Promise<void> {
    const cacheKey = this.getCurrentProfileCacheKey(address);
    if (!cacheKey) {
      return;
    }

    this.currentProfileCacheMemory.delete(cacheKey);
    await AsyncStorageService.removeItem(cacheKey);
  }

  private async persistRegistrationIntent(
    intent: RegistrationIntent | null,
  ): Promise<void> {
    if (!intent) {
      this.registrationIntent = null;
      await AsyncStorageService.removeItem(REGISTRATION_INTENT_STORAGE_KEY);
      return;
    }

    this.registrationIntent = {
      ...intent,
      userAddress:
        this.normalizeAddress(intent.userAddress) || intent.userAddress,
    };

    await AsyncStorageService.setItem(
      REGISTRATION_INTENT_STORAGE_KEY,
      JSON.stringify(this.registrationIntent),
    );
  }

  private async markRegistrationCompleted(address: string): Promise<void> {
    const normalizedAddress = this.normalizeAddress(address);
    if (!normalizedAddress) {
      return;
    }

    this.registrationCompletedAddress = normalizedAddress;
    await AsyncStorageService.setItem(
      REGISTRATION_COMPLETED_STORAGE_KEY,
      normalizedAddress,
    );

    if (this.registrationIntent?.userAddress === normalizedAddress) {
      await this.persistRegistrationIntent(null);
    }
  }

  private async hydrateRegistrationState(): Promise<void> {
    const currentAddress = this.normalizeAddress(this.userAddress);
    if (!currentAddress) {
      return;
    }

    if (!this.registrationCompletedAddress) {
      this.registrationCompletedAddress = this.normalizeAddress(
        await AsyncStorageService.getItem(REGISTRATION_COMPLETED_STORAGE_KEY),
      );
    }

    if (this.registrationIntent?.userAddress === currentAddress) {
      return;
    }

    const persistedIntentRaw = await AsyncStorageService.getItem(
      REGISTRATION_INTENT_STORAGE_KEY,
    );
    if (persistedIntentRaw) {
      try {
        const parsed = JSON.parse(persistedIntentRaw);
        if (
          parsed &&
          typeof parsed.nickname === "string" &&
          typeof parsed.passportHash === "string" &&
          typeof parsed.passportCountry === "string" &&
          this.normalizeAddress(parsed.userAddress) === currentAddress
        ) {
          this.registrationIntent = {
            nickname: parsed.nickname,
            passportHash: parsed.passportHash,
            passportCountry: parsed.passportCountry,
            userAddress: currentAddress,
          };
          return;
        }
      } catch (error) {
        this.log("[ApiService] Failed to parse registration intent:", error);
      }
    }

    try {
      const [passportDataRaw, nicknameRaw] = await Promise.all([
        AsyncStorageService.getItem("passport_data"),
        AsyncStorageService.getItem("nickname"),
      ]);

      if (!passportDataRaw) {
        return;
      }

      const passportData = JSON.parse(passportDataRaw);
      const derivedIntent = buildRegistrationIntent(
        passportData,
        nicknameRaw || undefined,
        currentAddress,
      );
      await this.persistRegistrationIntent(derivedIntent);
    } catch (error) {
      this.log(
        "[ApiService] Unable to derive registration intent from storage:",
        error,
      );
    }
  }

  async setRegistrationIntent(intent: RegistrationIntent | null): Promise<void> {
    const normalizedAddress = this.normalizeAddress(intent?.userAddress);

    if (normalizedAddress && this.registrationCompletedAddress !== normalizedAddress) {
      this.registrationCompletedAddress = null;
      await AsyncStorageService.removeItem(REGISTRATION_COMPLETED_STORAGE_KEY);
    }

    await this.persistRegistrationIntent(
      intent
        ? {
            ...intent,
            userAddress: normalizedAddress || intent.userAddress,
          }
        : null,
    );
  }

  private isUserNotRegisteredError(error: any): boolean {
    const status = Number(error?.response?.status || 0);
    const details = [
      error?.message,
      error?.response?.data?.error,
      error?.response?.data?.details,
      error?.response?.data?.reason,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      status === 403 &&
      (details.includes("not registered") ||
        details.includes("signer passport is not registered on-chain"))
    );
  }

  async ensureRegistration(options?: {
    background?: boolean;
    force?: boolean;
    reason?: string;
  }): Promise<boolean> {
    const normalizedAddress = this.normalizeAddress(this.userAddress);
    if (!this.signer || !normalizedAddress) {
      return false;
    }

    await this.hydrateRegistrationState();

    if (!options?.force && this.registrationCompletedAddress === normalizedAddress) {
      return true;
    }

    if (
      !this.registrationIntent ||
      this.normalizeAddress(this.registrationIntent.userAddress) !== normalizedAddress
    ) {
      return false;
    }

    if (this.registrationPromise) {
      if (options?.background) {
        return false;
      }
      return this.registrationPromise;
    }

    this.log(
      "[ApiService] Starting deferred registration sync:",
      options?.reason || "unspecified",
    );

    const promise = this.register(
      this.registrationIntent.nickname,
      this.registrationIntent.passportHash,
      this.registrationIntent.passportCountry,
    )
      .then(async (response) => {
        if (response.success) {
          await this.markRegistrationCompleted(normalizedAddress);
          return true;
        }
        return false;
      })
      .catch((error) => {
        this.log("[ApiService] Deferred registration failed:", error);
        return false;
      })
      .finally(() => {
        this.registrationPromise = null;
      });

    this.registrationPromise = promise;

    if (options?.background) {
      void promise;
      return false;
    }

    return promise;
  }

  private async runWithRegistrationRetry<T>(
    operation: () => Promise<T>,
    options?: {
      registrationRequired?: boolean;
      reason?: string;
    },
  ): Promise<T> {
    if (options?.registrationRequired) {
      await this.ensureRegistration({
        reason: options.reason,
      });
    }

    try {
      return await operation();
    } catch (error: any) {
      if (
        options?.registrationRequired &&
        this.isUserNotRegisteredError(error)
      ) {
        const registrationRecovered = await this.ensureRegistration({
          force: true,
          reason: `${options.reason || "request"}:retry-after-not-registered`,
        });

        if (registrationRecovered) {
          return operation();
        }
      }

      throw error;
    }
  }

  // Universal fetch wrapper
  private async fetchWrapper(url: string, options: any = {}): Promise<any> {
    const fullUrl = url.startsWith("http") ? url : `${this.baseURL}${url}`;

    // Build headers
    const headers: any = {
      Accept: "application/json",
      "User-Agent": "ForumApp/1.0",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      "X-Platform": Platform.OS,
      "X-Forum-Language": normalizeAppLanguage(i18n.language, "en"),
      ...options.headers,
    };

    // Add auth token if available
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    // Add Content-Type for POST requests with body
    if (options.method === "POST" && options.body) {
      headers["Content-Type"] = "application/json";
    }

    this.log("[ApiService] 🚀 REQUEST:", options.method || "GET", fullUrl);
    this.log("[ApiService] 📋 Headers:", JSON.stringify(headers, null, 2));
    if (options.body) {
      this.log(
        "[ApiService] 📦 Body length:",
        options.body.length,
        "characters",
      );
    }

    // Make request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      this.log("[ApiService] ⏰ Request timeout after", API_TIMEOUT, "ms");
      controller.abort();
    }, API_TIMEOUT);

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      this.log("[ApiService] 📥 Response status:", response.status);
      this.log(
        "[ApiService] 📥 Response headers:",
        Object.fromEntries(response.headers.entries()),
      );

      // Handle response
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: response.statusText };
        }

        this.log("[ApiService] ❌ Error response:", errorData);

        // Check for rate limit error
        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const rateLimitRemaining = response.headers.get(
            "ratelimit-remaining",
          );
          const rateLimitReset = response.headers.get("ratelimit-reset");

          this.log("[ApiService] ⚠️ RATE LIMIT HIT!");
          this.log("[ApiService] ⏰ Retry after:", retryAfter, "seconds");
          this.log("[ApiService] 🔢 Remaining requests:", rateLimitRemaining);
          this.log("[ApiService] 🔄 Reset in:", rateLimitReset, "seconds");

          const error = new Error(
            `Rate limit exceeded. Please wait ${retryAfter || rateLimitReset || "5 minutes"} seconds before trying again.`,
          ) as any;
          error.response = {
            status: response.status,
            data: errorData,
            isRateLimit: true,
            retryAfter: parseInt(retryAfter || rateLimitReset || "300"),
          };
          throw error;
        }

        const serverMessage =
          (typeof errorData?.details === "string" &&
            errorData.details.trim()) ||
          (typeof errorData?.reason === "string" && errorData.reason.trim()) ||
          (typeof errorData?.message === "string" &&
            errorData.message.trim()) ||
          (typeof errorData?.error === "string" && errorData.error.trim()) ||
          response.statusText ||
          "Request failed";

        const error = new Error(
          `HTTP ${response.status}: ${serverMessage}`,
        ) as any;
        error.response = { status: response.status, data: errorData };
        throw error;
      }

      // Parse response
      let data;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      this.log(
        "[ApiService] ✅ Success response data keys:",
        Object.keys(data || {}),
      );
      return { data, status: response.status };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        this.log("[ApiService] ❌ Request aborted (timeout)");
        throw new Error("Request timeout");
      }

      this.log("[ApiService] ❌ Fetch error:", error.message);
      throw error;
    }
  }

  // HTTP GET
  private async get(url: string, params?: any): Promise<any> {
    const queryString = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return this.fetchWrapper(`${url}${queryString}`, { method: "GET" });
  }

  // HTTP POST
  private async post(url: string, data?: any): Promise<any> {
    return this.fetchWrapper(url, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  private normalizeAppConfig(payload: any): AppConfig {
    const featureFlags = payload?.featureFlags || {};
    return {
      version:
        typeof payload?.version === "string" ? payload.version : undefined,
      timestamp:
        typeof payload?.timestamp === "string" ? payload.timestamp : undefined,
      featureFlags: {
        lotteryEnabled: featureFlags?.lotteryEnabled === true,
        biometricsEnabled: featureFlags?.biometricsEnabled === true,
        avatarUploadEnabled: featureFlags?.avatarUploadEnabled === true,
        commentsEnabled: featureFlags?.commentsEnabled !== false,
        anonymousPostingEnabled:
          featureFlags?.anonymousPostingEnabled === true,
      },
    };
  }

  private normalizePostRecord(post: any): Post {
    const normalizedLanguage = normalizeAppLanguage(i18n.language, "en");
    const normalizedPost = {
      ...(post || {}),
      localizedTitle:
        String(post?.localizedTitle || "").trim() ||
        getPostDisplayTitle(post || {}, normalizedLanguage) ||
        undefined,
      localizedContent:
        String(post?.localizedContent || "").trim() ||
        getPostDisplayContent(post || {}, normalizedLanguage) ||
        undefined,
    } as Post;

    return normalizedPost;
  }

  private normalizePostsCollection(posts: any[]): Post[] {
    return (posts || []).map((post) => this.normalizePostRecord(post));
  }

  // Initialize with wallet for real signing
  async initialize(wallet: any): Promise<void> {
    this.log("[ApiService] ===== INITIALIZE =====");
    this.log("[ApiService] Wallet received:", wallet ? "YES" : "NO");

    if (wallet) {
      this.log("[ApiService] Wallet address:", wallet.address);

      // Get real ethers.Wallet instance from WalletService (not just private key)
      const { WalletService } = require("./WalletService");
      const walletService = WalletService.getInstance();
      const ethersWallet = await walletService.getEthersWallet();

      if (ethersWallet) {
        this.signer = ethersWallet;
        this.userAddress = ethersWallet.address;
        this.log(
          "[ApiService] ✅ Initialized with real ethers.Wallet:",
          this.userAddress,
        );
        this.log("[ApiService] ✅ Real EIP-712 signing enabled");
      } else {
        this.log("[ApiService] ❌ No ethers.Wallet available for signing");
        this.signer = null;
        this.userAddress = wallet.address;
      }

      this.log("[ApiService] Signer set:", !!this.signer);
      this.log("[ApiService] User address set:", this.userAddress);
    } else {
      this.log("[ApiService] ⚠️ No wallet provided to initialize");
      this.signer = null;
      this.userAddress = null;
    }

    await this.hydrateRegistrationState();

    if (
      this.signer &&
      this.userAddress &&
      this.registrationCompletedAddress !== this.normalizeAddress(this.userAddress)
    ) {
      void this.ensureRegistration({
        background: true,
        reason: "initialize",
      });
    }

    // Auto-fetch feed after successful wallet initialization
    if (this.signer && this.userAddress) {
      this.log(
        "[ApiService] 🚀 Wallet initialized successfully - auto-fetching feed...",
      );
      try {
        const feedResult = await this.getFeed(1, 20);
        if (feedResult.success) {
          this.log(
            "[ApiService] ✅ Feed auto-fetched successfully:",
            feedResult.data.length,
            "posts",
          );
        } else {
          this.log("[ApiService] ⚠️ Feed auto-fetch failed:", feedResult.error);
        }
      } catch (error: any) {
        this.log("[ApiService] ❌ Feed auto-fetch error:", error.message);
      }
    }

    this.log("[ApiService] ===== END INITIALIZE =====");
  }

  async getAppConfig(
    forceRefresh: boolean = false,
  ): Promise<ApiResponse<AppConfig>> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.appConfigCache &&
      this.appConfigCacheExpiresAt > now
    ) {
      return {
        success: true,
        data: this.appConfigCache,
      };
    }

    try {
      if (!forceRefresh && this.appConfigRequest) {
        const data = await this.appConfigRequest;
        return {
          success: true,
          data,
        };
      }

      this.appConfigRequest = (async () => {
        try {
          const response = await this.get("/api/app-config");
          const normalized = this.normalizeAppConfig(response.data || response);
          this.appConfigCache = normalized;
          this.appConfigCacheExpiresAt = Date.now() + this.appConfigCacheTtlMs;
          return normalized;
        } catch (appConfigError: any) {
          this.log(
            "[ApiService] App config endpoint failed, fallback to /api/status",
            appConfigError?.message || appConfigError,
          );
          const response = await this.get("/api/status");
          const normalized = this.normalizeAppConfig(response.data || response);
          this.appConfigCache = normalized;
          this.appConfigCacheExpiresAt = Date.now() + this.appConfigCacheTtlMs;
          return normalized;
        } finally {
          this.appConfigRequest = null;
        }
      })();

      const data = await this.appConfigRequest;
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      const fallback = this.appConfigCache || DEFAULT_APP_CONFIG;
      return {
        success: !!this.appConfigCache,
        data: fallback,
        error: error.message || "Failed to fetch app configuration",
      };
    }
  }

  // Generate nonce for signing
  async getNonce(address: string): Promise<string> {
    this.log("[ApiService] Getting nonce for address:", address);
    try {
      const response = await this.get(`/api/signed/nonce/${address}`);
      this.log("[ApiService] ✅ Nonce received:", response.data.nonce);
      return response.data.nonce;
    } catch (error: any) {
      this.log(
        "[ApiService] ⚠️ Server nonce failed, using demo nonce:",
        error.message,
      );
      const demoNonce = Math.random().toString(36).substring(2, 15);
      this.log("[ApiService] 📝 Demo nonce generated:", demoNonce);
      return demoNonce;
    }
  }

  // Sign message with EIP-712
  async signMessage(primaryType: string, message: any): Promise<string> {
    this.log("[ApiService] 🖊️ Signing message:", primaryType);

    if (!this.signer) {
      throw new Error("No signer available");
    }

    const types = this.getEIP712Types(primaryType);
    const domain = EIP712_DOMAIN;

    this.log("[ApiService] Signing with domain:", domain);
    this.log("[ApiService] Signing with types:", types);
    this.log("[ApiService] Signing message:", message);

    const signature = await this.signer.signTypedData(domain, types, message);

    this.log("[ApiService] ✅ Signature generated:", signature);
    return signature;
  }

  // Get EIP-712 types for different operations
  private getEIP712Types(primaryType: string) {
    const types: any = {
      Register: [
        { name: "nickname", type: "string" },
        { name: "passportHash", type: "bytes32" },
        { name: "passportCountry", type: "string" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      CreatePost: [
        { name: "content", type: "string" },
        { name: "title", type: "string" },
        { name: "isProposal", type: "bool" },
        { name: "voteData", type: "string" },
        { name: "isAnonymous", type: "bool" },
        { name: "ipfsHash", type: "string" },
        { name: "replyTo", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      CreateComment: [
        { name: "content", type: "string" },
        { name: "parentPostId", type: "string" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      ReportComment: [
        { name: "commentId", type: "string" },
        { name: "reason", type: "string" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      Follow: [
        { name: "userToFollow", type: "address" },
        { name: "isFollowing", type: "bool" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      ReactToPost: [
        { name: "postId", type: "string" },
        { name: "reactionType", type: "string" },
        { name: "active", type: "bool" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      PassportVerification: [
        { name: "merkleRoot", type: "bytes32" },
        { name: "merkleProof", type: "bytes32[]" },
        { name: "merkleLeaf", type: "bytes32" },
        { name: "nonce", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
      GetFeed: [
        { name: "page", type: "uint256" },
        { name: "limit", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      GetPostComments: [
        { name: "postId", type: "string" },
        { name: "limit", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      GetProfile: [
        { name: "address", type: "string" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      UpdateProfileSettings: [
        { name: "address", type: "string" },
        { name: "username", type: "string" },
        { name: "displayName", type: "string" },
        { name: "avatar", type: "string" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
      UploadProfileAvatar: [
        { name: "address", type: "string" },
        { name: "fileName", type: "string" },
        { name: "mimeType", type: "string" },
        { name: "sizeBytes", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
    };

    return { [primaryType]: types[primaryType] };
  }

  // Create signed request payload
  private async createSignedRequest(
    primaryType: string,
    message: any,
  ): Promise<any> {
    this.log("[ApiService] ===== CREATE SIGNED REQUEST =====");
    this.log("[ApiService] Primary Type:", primaryType);
    this.log("[ApiService] Message:", JSON.stringify(message, null, 2));

    if (!this.signer || !this.userAddress) {
      throw new Error("Wallet not initialized for signed request");
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

    this.log(
      "[ApiService] Complete signed message:",
      JSON.stringify(signedMessage, null, 2),
    );

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

    this.log(
      "[ApiService] Final payload created - keys:",
      Object.keys(payload),
    );
    this.log("[ApiService] ===== END CREATE SIGNED REQUEST =====");

    return payload;
  }

  // Get public feed (no authentication required)
  async getPublicFeed(
    page: number = 1,
    limit: number = 20,
    sort?: string,
  ): Promise<ApiResponse<Post[]>> {
    try {
      this.log("[ApiService] Getting public feed...");

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (sort) {
        params.append("sort", sort);
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

      this.log("[ApiService] Public feed received:", posts.length, "posts");

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
        data: this.normalizePostsCollection(posts),
      };
    } catch (error) {
      console.error("[ApiService] Public feed error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch public feed",
        data: [],
      };
    }
  }

  // Get feed (with authentication fallback to public)
  async getFeed(
    page: number = 1,
    limit: number = 20,
    sort?: string,
  ): Promise<ApiResponse<Post[]>> {
    try {
      this.log("[ApiService] Getting feed...");

      // If not authenticated, use public feed
      if (!this.signer || !this.userAddress) {
        this.log("[ApiService] No authentication - using public feed");
        return await this.getPublicFeed(page, limit, sort);
      }

      this.log("[ApiService] 🔐 Creating signed feed request...");

      const message: any = { page, limit };
      if (sort) {
        message.sort = sort;
      }

      const signedPayload = await this.createSignedRequest("GetFeed", message);

      this.log("[ApiService] Sending signed feed request...");
      const response = await this.post("/api/signed/feed", signedPayload);

      // Process response
      let posts = [];
      let data = response.data || response;

      if (data && data.posts && Array.isArray(data.posts)) {
        posts = data.posts;
      } else if (Array.isArray(data)) {
        posts = data;
      }

      this.log("[ApiService] Feed received:", posts.length, "posts");

      // Focus on post_commandment_1 specifically
      this.log("[ApiService] 🎯 SEARCHING FOR post_commandment_1...");
      const targetPost = posts.find((post) => post.id === "post_commandment_1");

      if (targetPost) {
        this.log("[ApiService] ✅ FOUND post_commandment_1:");
        this.log(
          "[ApiService] COMPLETE post_commandment_1 structure:",
          JSON.stringify(targetPost, null, 2),
        );
        this.log("[ApiService] post_commandment_1 vote fields:", {
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
          currentVote: targetPost.currentVote,
        });
      } else {
        this.log("[ApiService] ❌ post_commandment_1 NOT FOUND in feed");
        this.log(
          "[ApiService] Available post IDs:",
          posts.map((p) => p.id),
        );
      }

      // Also log raw response for completeness
      this.log("[ApiService] 🔍 RAW API RESPONSE:");
      this.log("[ApiService] Response status:", response.status);
      this.log(
        "[ApiService] Response data keys:",
        response.data ? Object.keys(response.data) : "null",
      );

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
        data: this.normalizePostsCollection(posts),
      };
    } catch (error: any) {
      console.error("[ApiService] Failed to get feed:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch feed",
        data: [],
      };
    }
  }

  // Get user profile
  async getUserProfile(address: string): Promise<ApiResponse<UserProfile>> {
    try {
      this.log("[ApiService] Getting user profile for:", address);

      let response;
      const normalizedRequestedAddress = this.normalizeAddress(address);
      const normalizedCurrentAddress = this.normalizeAddress(this.userAddress);
      const isOwnProfile =
        !!normalizedRequestedAddress &&
        !!normalizedCurrentAddress &&
        normalizedRequestedAddress === normalizedCurrentAddress;

      // Signed profile endpoint is for the current signer profile only.
      // For other users we must use the public profile route, otherwise
      // the backend returns the current signer and the UI shows the wrong header.
      if (this.signer && this.userAddress && isOwnProfile) {
        this.log("[ApiService] 🔐 Creating signed profile request...");

        const signedPayload = await this.createSignedRequest("GetProfile", {
          address: normalizedRequestedAddress,
        });

        response = await this.post("/api/signed/profile", signedPayload);
      } else {
        this.log("[ApiService] 👤 Using unsigned profile request...");
        response = await this.get(`/api/profile/${normalizedRequestedAddress || address}`);
      }

      return {
        success: true,
        data: response.data.profile || response.data,
      };
    } catch (error: any) {
      console.error("[ApiService] Failed to get user profile:", error);
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
        throw new Error("Wallet not initialized for profile access");
      }

      this.log("[ApiService] Getting my profile with voting history...");

      // Use the same signature structure as regular getUserProfile but for own profile
      const signedPayload = await this.createSignedRequest("GetProfile", {
        address: this.userAddress,
      });

      this.log(
        "[ApiService] Sending signed profile request with voting history...",
      );
      const response = await this.post("/api/signed/profile", signedPayload);
      const normalizedData = this.normalizePostRecord(response.data);
      await this.writeCurrentProfileCache(this.userAddress, normalizedData);

      return {
        success: true,
        data: normalizedData,
      };
    } catch (error: any) {
      console.error(
        "[ApiService] Failed to get profile with voting history:",
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async updateProfileSettings(payload: {
    address?: string;
    username: string;
    displayName: string;
    avatar?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.runWithRegistrationRetry(
        async () => {
          if (!this.signer || !this.userAddress) {
            throw new Error("Wallet not initialized for profile update");
          }

          const targetAddress = payload.address || this.userAddress;
          const signedPayload = await this.createSignedRequest(
            "UpdateProfileSettings",
            {
              address: targetAddress,
              username: String(payload.username || "")
                .trim()
                .toLowerCase(),
              displayName: String(payload.displayName || "").trim(),
              avatar: String(payload.avatar || "").trim(),
            },
          );

          return this.post("/api/signed/profile-metadata", signedPayload);
        },
        {
          registrationRequired: true,
          reason: "profile-update",
        },
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to update profile settings",
      };
    }
  }

  async uploadProfileAvatar(payload: {
    address?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    fileDataBase64: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.runWithRegistrationRetry(
        async () => {
          if (!this.signer || !this.userAddress) {
            throw new Error("Wallet not initialized for avatar upload");
          }

          const targetAddress = payload.address || this.userAddress;
          const signedPayload = await this.createSignedRequest(
            "UploadProfileAvatar",
            {
              address: targetAddress,
              fileName: String(payload.fileName || "").trim(),
              mimeType: String(payload.mimeType || "")
                .trim()
                .toLowerCase(),
              sizeBytes: Math.max(0, Math.floor(Number(payload.sizeBytes || 0))),
            },
          );

          return this.post("/api/signed/profile-avatar/upload", {
            ...signedPayload,
            fileDataBase64: String(payload.fileDataBase64 || "").trim(),
          });
        },
        {
          registrationRequired: true,
          reason: "profile-avatar-upload",
        },
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to upload avatar",
      };
    }
  }
  // Create post submission (requires admin approval before publication)
  async createPost(payload: {
    content: string;
    title?: string;
    isProposal?: boolean;
    voteData?: any;
    isAnonymous?: boolean;
    ipfsHash?: string;
    replyTo?: number;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.runWithRegistrationRetry(
        async () => {
          if (!this.signer || !this.userAddress) {
            throw new Error("No wallet available for post creation");
          }

          this.log("[ApiService] Creating signed post request...");

          const serializedVoteData =
            payload.isProposal === true
              ? JSON.stringify(payload.voteData || {})
              : "";

          const signedPayload = await this.createSignedRequest("CreatePost", {
            content: payload.content,
            title: payload.title || "",
            isProposal: payload.isProposal === true,
            voteData: serializedVoteData,
            isAnonymous: payload.isAnonymous === true,
            ipfsHash: payload.ipfsHash || "",
            replyTo: Number(payload.replyTo || 0),
          });

          return this.post("/api/signed/post-submission", signedPayload);
        },
        {
          registrationRequired: true,
          reason: "create-post",
        },
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("[ApiService] Failed to create post:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async followUser(
    userToFollow: string,
    isFollowing: boolean = true,
  ): Promise<ApiResponse<any>> {
    try {
      const response = await this.runWithRegistrationRetry(
        async () => {
          if (!this.signer || !this.userAddress) {
            throw new Error("Wallet not initialized for follow action");
          }

          const signedPayload = await this.createSignedRequest("Follow", {
            userToFollow,
            isFollowing,
          });

          return this.post("/api/signed/follow", signedPayload);
        },
        {
          registrationRequired: true,
          reason: "follow-user",
        },
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("[ApiService] Follow action failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async toggleReaction(
    postId: string,
    reactionType: ReactionType,
    active: boolean,
  ): Promise<ApiResponse<any>> {
    try {
      if (!this.signer || !this.userAddress) {
        throw new Error("Wallet not initialized for reaction");
      }

      const signedPayload = await this.createSignedRequest("ReactToPost", {
        postId,
        reactionType,
        active,
      });

      const response = await this.post("/api/signed/reaction", signedPayload);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("[ApiService] Reaction action failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get("/health");
      return response.status === 200;
    } catch (error) {
      console.error("[ApiService] Health check failed:", error);
      return false;
    }
  }

  // Test external APIs
  async testExternalAPI(): Promise<{
    jsonplaceholder: boolean;
    railway: boolean;
    details: any;
  }> {
    const result: {
      jsonplaceholder: boolean;
      railway: boolean;
      details: Record<string, any>;
    } = {
      jsonplaceholder: false,
      railway: false,
      details: {},
    };

    // Test JSONPlaceholder
    try {
      const response = await fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
        {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        },
      );
      result.jsonplaceholder = response.ok;
      result.details.jsonplaceholder = { status: response.status };
    } catch (error: any) {
      this.log("[ApiService] JSONPlaceholder test failed:", error.message);
      result.details.jsonplaceholder = { error: error.message };
    }

    // Test Railway health
    try {
      const response = await this.get("/health");
      result.railway = response.status === 200;
      result.details.railway = { status: response.status };
    } catch (error: any) {
      this.log("[ApiService] Railway test failed:", error.message);
      result.details.railway = { error: error.message };
    }

    this.log("[ApiService] External API test results:", result);
    return result;
  }

  // Test connectivity
  async testConnectivity(): Promise<{ github: boolean; health: boolean }> {
    const result = { github: false, health: false };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch("https://api.github.com", {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      result.github = response.ok;
      this.log(
        "[ApiService] GitHub connectivity:",
        response.status,
        response.ok,
      );
    } catch (error: any) {
      this.log("[ApiService] GitHub connectivity failed:", error.message);
    }

    try {
      const response = await this.get("/health");
      result.health = response.status === 200;
      this.log("[ApiService] Health connectivity:", result.health);
    } catch (error: any) {
      this.log("[ApiService] Health connectivity failed:", error.message);
    }

    return result;
  }

  // Clear authentication
  async clearAuth() {
    const currentAddress = this.userAddress;
    this.authToken = null;
    this.userAddress = null;
    this.signer = null;
    this.registrationIntent = null;
    this.registrationPromise = null;
    this.registrationCompletedAddress = null;
    await AsyncStorageService.removeItem(REGISTRATION_INTENT_STORAGE_KEY);
    await AsyncStorageService.removeItem(REGISTRATION_COMPLETED_STORAGE_KEY);
    await this.clearCurrentProfileCache(currentAddress || undefined);
    this.log("[ApiService] Authentication cleared");
  }

  // Register user (if needed)
  async register(
    nickname: string,
    passportHash?: string,
    passportCountry?: string,
  ): Promise<ApiResponse<UserProfile>> {
    try {
      if (!this.signer || !this.userAddress) {
        throw new Error("Wallet not initialized for registration");
      }

      const normalizedAddress = this.normalizeAddress(this.userAddress);
      if (
        normalizedAddress &&
        passportHash &&
        passportCountry &&
        ethers.isHexString(passportHash, 32) &&
        passportHash.toLowerCase() !== ethers.ZeroHash.toLowerCase()
      ) {
        await this.setRegistrationIntent({
          nickname: String(nickname || "").trim(),
          passportHash,
          passportCountry: String(passportCountry || "")
            .trim()
            .toUpperCase(),
          userAddress: normalizedAddress,
        });
      }

      const signedPayload = await this.createSignedRequest("Register", {
        nickname,
        passportHash: passportHash || "",
        passportCountry: passportCountry || "",
      });

      const response = await this.post("/api/signed/register", signedPayload);

      if (normalizedAddress) {
        await this.markRegistrationCompleted(normalizedAddress);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("[ApiService] Registration failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Vote on post with Merkle proof verification
  async voteOnPost(
    postId: string,
    voteOption: string | number,
    verificationProof?: any,
  ): Promise<ApiResponse<any>> {
    try {
      const response = await this.runWithRegistrationRetry(
        async () => {
          if (!this.signer || !this.userAddress) {
            throw new Error("Wallet not initialized for voting");
          }

          this.log("[ApiService] 🗳️ Voting on post with Merkle verification...");

          if (postId === "post_commandment_1") {
            this.log("[ApiService] 🎯 VOTING ON post_commandment_1:");
            this.log("[ApiService] Post ID:", postId);
            this.log("[ApiService] Vote Option:", voteOption);
            this.log("[ApiService] Signer Address:", this.userAddress);
            this.log("[ApiService] Has Verification Proof:", !!verificationProof);
            if (verificationProof) {
              this.log(
                "[ApiService] Verification Proof Structure:",
                JSON.stringify(verificationProof, null, 2),
              );
            }
          }

          let verification = null;
          if (verificationProof && typeof verificationProof === "object") {
            const currentTime = Math.floor(Date.now() / 1000);
            const proofAge = currentTime - verificationProof.timestamp;

            this.log("[ApiService] Timestamp validation:", {
              currentTime: currentTime,
              proofTimestamp: verificationProof.timestamp,
              proofAge: proofAge,
              maxAllowed: 300,
              isValid: Math.abs(proofAge) <= 300,
            });

            if (Math.abs(proofAge) > 300) {
              this.log(
                "[ApiService] ⚠️ Verification proof is too old, need to regenerate",
              );
              throw new Error(
                "Verification proof expired. Please try voting again.",
              );
            }

            verification = {
              signature: verificationProof.signature,
              merkleRoot: verificationProof.merkleRoot,
              merkleProof: verificationProof.merkleProof,
              merkleLeaf: verificationProof.merkleLeaf,
              postId: postId,
              voteOption: voteOption.toString(),
              nonce: verificationProof.nonce,
              timestamp: verificationProof.timestamp,
              ...(verificationProof.ageRange !== undefined
                ? { ageRange: Number(verificationProof.ageRange) }
                : {}),
              ...(verificationProof.country
                ? { country: String(verificationProof.country).toUpperCase() }
                : {}),
              ...(verificationProof.passportHash
                ? { passportHash: verificationProof.passportHash }
                : {}),
              ...(verificationProof.ageRangeProof
                ? { ageRangeProof: verificationProof.ageRangeProof }
                : {}),
            };

            this.log("[ApiService] Created verification object:", {
              hasSignature: !!verification.signature,
              merkleRoot: verification.merkleRoot?.substring(0, 10) + "...",
              merkleProofLength: verification.merkleProof?.length,
              merkleLeaf: verification.merkleLeaf?.substring(0, 10) + "...",
              postId: verification.postId,
              voteOption: verification.voteOption,
              nonce: verification.nonce,
              timestamp: verification.timestamp,
              hasPassportBoundFields:
                verification.ageRange !== undefined &&
                typeof verification.country === "string" &&
                typeof verification.passportHash === "string",
            });
          } else {
            this.log(
              "[ApiService] ❌ No verification proof provided in vote request",
            );
            throw new Error("Verification proof required for voting");
          }

          const requestBody = {
            voteOption: voteOption.toString(),
            verification: verification,
          };

          this.log("[ApiService] Request body structure:", {
            voteOption: requestBody.voteOption,
            hasVerification: !!requestBody.verification,
            verificationKeys: requestBody.verification
              ? Object.keys(requestBody.verification)
              : [],
          });

          this.log(
            "[ApiService] Full request body being sent:",
            JSON.stringify(requestBody, null, 2),
          );

          return this.post(`/api/posts/${postId}/vote`, requestBody);
        },
        {
          registrationRequired: true,
          reason: "vote-on-post",
        },
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("[ApiService] Vote failed:", error);
      console.error("[ApiService] Error response details:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        stack: error.stack,
      });
      return {
        success: false,
        error: error.message,
        serverResponse: error.response?.data,
      };
    }
  }

  async getVoteReceipt(
    postId: string,
    nullifier: string,
  ): Promise<ApiResponse<any>> {
    try {
      const response = await this.get(
        `/api/posts/${postId}/vote-receipt/${nullifier}`,
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch vote receipt",
      };
    }
  }

  // Check voting eligibility for an initiative
  async checkVotingEligibility(postId: string): Promise<ApiResponse<any>> {
    try {
      this.log("[ApiService] Checking voting eligibility for post:", postId);

      const response = await this.get(`/api/posts/${postId}/vote-restrictions`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("[ApiService] Eligibility check failed:", error);
      return {
        success: false,
        error: error.message || "Failed to check eligibility",
      };
    }
  }

  // Get a single post by ID
  async getPost(postId: string): Promise<ApiResponse<any>> {
    try {
      this.log("[ApiService] Getting post:", postId);

      // Try unsigned endpoint first
      const response = await this.get(`/api/posts/${postId}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("[ApiService] Failed to get post:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch post",
      };
    }
  }

  // Get comments for a post
  async getPostComments(
    postId: string,
  ): Promise<ApiResponse<{ comments: PostComment[]; total: number }>> {
    try {
      const normalizedPostId = String(postId || "").trim();
      const defaultLimit = 200;

      if (this.signer && this.userAddress) {
        try {
          const signedPayload = await this.createSignedRequest(
            "GetPostComments",
            {
              postId: normalizedPostId,
              limit: defaultLimit,
            },
          );
          const signedResponse = await this.post(
            "/api/signed/post-comments",
            signedPayload,
          );
          return {
            success: true,
            data: {
              comments: Array.isArray(signedResponse.data?.comments)
                ? signedResponse.data.comments
                : [],
              total: Number(signedResponse.data?.total || 0),
            },
          };
        } catch (signedError: any) {
          this.log(
            "[ApiService] Signed comments request failed, fallback to public endpoint",
            signedError?.message || signedError,
          );
        }
      }

      const response = await this.get(
        `/api/posts/${normalizedPostId}/comments`,
      );
      return {
        success: true,
        data: {
          comments: Array.isArray(response.data?.comments)
            ? response.data.comments
            : [],
          total: Number(response.data?.total || 0),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch comments",
      };
    }
  }

  // Create comment for a post
  async createPostComment(
    postId: string,
    content: string,
  ): Promise<ApiResponse<any>> {
    try {
      const normalizedContent = String(content || "").trim();
      if (!normalizedContent) {
        throw new Error("Comment content is required");
      }
      if (normalizedContent.length > 2000) {
        throw new Error("Comment exceeds max length (2000)");
      }

      const response = await this.runWithRegistrationRetry(
        async () => {
          if (!this.signer || !this.userAddress) {
            const { WalletService } = require("./WalletService");
            const walletService = WalletService.getInstance();
            const currentWallet = walletService.getCurrentWallet();
            if (currentWallet) {
              await this.initialize(currentWallet);
            }
          }
          if (!this.signer || !this.userAddress) {
            throw new Error("Wallet not initialized for comment submission");
          }

          const signedPayload = await this.createSignedRequest("CreateComment", {
            content: normalizedContent,
            parentPostId: postId,
          });

          return this.post("/api/signed/post-submission", signedPayload);
        },
        {
          registrationRequired: true,
          reason: "create-comment",
        },
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to create comment",
      };
    }
  }

  async reportComment(
    commentId: string,
    reason: string,
  ): Promise<ApiResponse<{ report: any; duplicate?: boolean }>> {
    try {
      const normalizedCommentId = String(commentId || "").trim();
      const normalizedReason = String(reason || "")
        .trim()
        .toLowerCase();

      if (!normalizedCommentId) {
        throw new Error("commentId is required");
      }
      if (!normalizedReason) {
        throw new Error("reason is required");
      }

      const response = await this.runWithRegistrationRetry(
        async () => {
          if (!this.signer || !this.userAddress) {
            const { WalletService } = require("./WalletService");
            const walletService = WalletService.getInstance();
            const currentWallet = walletService.getCurrentWallet();
            if (currentWallet) {
              await this.initialize(currentWallet);
            }
          }
          if (!this.signer || !this.userAddress) {
            throw new Error("Wallet not initialized for comment report");
          }

          const signedPayload = await this.createSignedRequest("ReportComment", {
            commentId: normalizedCommentId,
            reason: normalizedReason,
          });

          return this.post("/api/signed/comment-report", signedPayload);
        },
        {
          registrationRequired: true,
          reason: "comment-report",
        },
      );
      return {
        success: true,
        data: {
          report: response.data?.report,
          duplicate: response.data?.duplicate === true,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to submit comment report",
      };
    }
  }

  // Get lottery details for an initiative post
  async getPostLottery(postId: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.get(`/api/posts/${postId}/lottery`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch lottery details",
      };
    }
  }

  // Get winner/claim status for current wallet in post lottery
  async getPostLotteryParticipant(postId: string): Promise<ApiResponse<any>> {
    try {
      let walletAddress = this.userAddress;
      if (!walletAddress) {
        const { WalletService } = require("./WalletService");
        const walletService = WalletService.getInstance();
        walletAddress = walletService.getAddress();
      }

      if (!walletAddress) {
        throw new Error("Wallet not initialized");
      }

      const response = await this.get(
        `/api/posts/${postId}/lottery/participant/${walletAddress}`,
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch lottery participant state",
      };
    }
  }

  // Donate native token to initiative lottery contract
  async donateToPostLottery(
    postId: string,
    amountEth: string,
  ): Promise<ApiResponse<any>> {
    try {
      const lottery = await this.getPostLottery(postId);
      if (!lottery.success || !lottery.data?.lottery?.contractAddress) {
        throw new Error(
          "Lottery contract is not available for this initiative",
        );
      }

      const { WalletService } = require("./WalletService");
      const walletService = WalletService.getInstance();
      const txHash = await walletService.sendTransaction(
        lottery.data.lottery.contractAddress,
        amountEth,
      );

      return {
        success: true,
        data: {
          txHash,
          contractAddress: lottery.data.lottery.contractAddress,
          amountEth,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to donate to lottery",
      };
    }
  }

  async claimPostLotteryReward(postId: string): Promise<ApiResponse<any>> {
    try {
      const lottery = await this.getPostLottery(postId);
      if (!lottery.success || !lottery.data?.lottery?.contractAddress) {
        throw new Error(
          "Lottery contract is not available for this initiative",
        );
      }

      const { WalletService } = require("./WalletService");
      const walletService = WalletService.getInstance();
      const txHash = await walletService.claimLotteryReward(
        lottery.data.lottery.contractAddress,
      );

      return {
        success: true,
        data: {
          txHash,
          contractAddress: lottery.data.lottery.contractAddress,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to claim lottery reward",
      };
    }
  }

  // Check app version
  async checkVersion(params?: {
    platform?: string;
    appVersion?: string;
  }): Promise<ApiResponse<any>> {
    try {
      this.log("[ApiService] Checking app version...");

      const query: Record<string, string> = {};
      if (params?.platform) query.platform = params.platform;
      if (params?.appVersion) query.appVersion = params.appVersion;

      const response = await this.get("/api/version", query);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("[ApiService] Failed to check version:", error);
      return {
        success: false,
        error: error.message || "Failed to check version",
      };
    }
  }

  // Public transaction log (read-only)
  async getPublicTransactionLog(params?: {
    limit?: number;
    status?: string;
    action?: string;
    includeDerived?: boolean;
  }): Promise<
    ApiResponse<{
      items: PublicTransactionLogItem[];
      total: number;
      returned: number;
      includeDerived: boolean;
      summary?: {
        byStatus?: Record<string, number>;
        byAction?: Record<string, number>;
      };
    }>
  > {
    try {
      const query: Record<string, string> = {};
      if (params?.limit) query.limit = String(params.limit);
      if (params?.status) query.status = String(params.status).trim();
      if (params?.action) query.action = String(params.action).trim();
      if (params?.includeDerived !== undefined) {
        query.includeDerived = params.includeDerived ? "1" : "0";
      }

      const response = await this.get("/api/admin/public/transactions", query);
      const payload = response.data || {};
      return {
        success: true,
        data: {
          items: Array.isArray(payload.items) ? payload.items : [],
          total: Number(payload.total || 0),
          returned: Number(payload.returned || 0),
          includeDerived: Boolean(payload.includeDerived),
          summary: payload.summary,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch transaction log",
      };
    }
  }
}

export default ApiService;
