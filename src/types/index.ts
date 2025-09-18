export interface PassportData {
  documentType: string;
  issuingCountry: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  gender?: string; // Alternative to sex field
  dateOfExpiry: string;
  personalNumber: string;
  firstName?: string;
  lastName?: string;
  mrz?: string; // Machine Readable Zone
  checkDigits?: {
    documentNumber?: string;
    dateOfBirth?: string;
    dateOfExpiry?: string;
  };
  dataGroups: {
    COM?: any;
    DG1?: any;
    DG2?: any;
    DG14?: any;
    SOD?: any;
    signatureAlgorithm?: any;
    dscSignature?: any;
    publicKey?: any;
    eContent?: any;
    encryptedDigest?: any;
  };
}

export interface WalletData {
  address: string;
  publicKey: string;
  balance: string;
  network: string;
  createdAt: string;
  identityHash?: string; // Unified identity hash for deduplication
}

export interface IdentityCheckResult {
  exists: boolean;
  walletAddress?: string;
  registrationDate?: string;
  documentType?: string;
  identityHash?: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  isVerified: boolean;
  country?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  walletAddress?: string;
  address?: string;
  joinedAt?: string;
}

export interface UserProfile {
  address: string;
  nickname: string;
  isVerified: boolean;
  verificationLevel?: number;
  registrationTime?: number;
  joinedDate?: string;
  bio?: string;
  avatar?: string;
  location?: string;
  profileType?: string;
  socialStats?: {
    totalPosts: number;
    totalFollowers: number;
    totalFollowing: number;
    totalMutualFollows?: number;
  };
  activity?: {
    totalLikes: number;
    totalDislikes?: number;
    postsLiked?: number;
    lastActive?: string;
  };
  source?: 'blockchain' | 'mock' | 'generated';
  passportHash?: string;
  createdAt?: string;
}

export interface VoteOption {
  id: string | number;
  label: string;
  count: number;
  percentage?: number;
}

export interface VoteRestrictions {
  minAge?: number;
  maxAge?: number;
  allowedNationalities?: string[]; // ISO country codes
  excludedNationalities?: string[]; // ISO country codes
  residencyRequired?: boolean;
  verificationLevel?: 'passport' | 'id' | 'any';
}

export interface Post {
  id: string;
  author: Pick<User, 'id' | 'username' | 'displayName' | 'avatar' | 'isVerified' | 'address'>;
  content: string;
  media?: string[];
  poll?: Poll;
  voteData?: {
    options: VoteOption[]; // All votes now use multi-option format
    totalVotes: number;
    deadline?: string;
    userVote?: string | number; // Which option the user voted for
    restrictions?: VoteRestrictions; // Eligibility criteria (legacy)
  };
  // New Merkle-based restriction fields
  allowedCountries?: string[]; // ISO country codes for Merkle tree
  minAgeRange?: number; // Age range: 1=18-20, 2=21-35, 3=36+
  requiresVerification?: boolean; // Whether passport verification is required
  eligibilityRoot?: string; // Merkle root for eligible combinations
  restrictions?: VoteRestrictions; // Legacy format
  likes: number;
  dislikes?: number;
  reposts: number;
  replies: number;
  tips?: string;
  isLiked: boolean;
  isDisliked?: boolean;
  isReposted: boolean;
  hasVoted?: boolean; // Whether user has voted on this post
  userVoteOption?: string; // The option the user voted for (e.g., "agree", "disagree")
  createdAt: string;
  timestamp?: string;
  isAnonymous?: boolean;
  type?: string;
  comments?: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  expiresAt: string;
  hasVoted: boolean;
  votedOption?: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  type: 'send' | 'receive' | 'tip';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  gasUsed?: string;
  gasPrice?: string;
}

export interface Vote {
  pollId: string;
  choice: number;
  timestamp: number;
  nonce: number;
  passportHash: string;
}

export class NFCError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NFCError';
  }
}