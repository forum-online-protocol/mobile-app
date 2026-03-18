import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Post, User } from '../types';
import ApiService from '../services/ApiService';
import { DemoService } from '../services/DemoService';

type ReactionType = 'like' | 'repost';

interface SocialState {
  posts: Post[];
  following: string[];
  followers: string[];
  currentUser: User | null;
  feed: Post[];
  isLoading: boolean;
  error: string | null;
}

const normalizeProfileUsername = (value: unknown): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (/^[a-z0-9_.]{3,32}$/.test(normalized)) {
    return normalized;
  }

  return '';
};

const buildPendingAuthorSummary = (state: any, authorAddress: string) => {
  const passportData = state?.auth?.passportData;
  const firstName = String(
    passportData?.personalData?.firstName || passportData?.firstName || '',
  ).trim();
  const lastName = String(
    passportData?.personalData?.lastName || passportData?.lastName || '',
  ).trim();
  const displayName =
    [firstName, lastName].filter(Boolean).join('_') ||
    `user_${authorAddress.slice(2, 8)}`;
  const username =
    normalizeProfileUsername(displayName) ||
    `user_${authorAddress.slice(2, 8)}`;

  return {
    id: authorAddress,
    address: authorAddress,
    username,
    displayName,
    avatar: '',
    isVerified: true,
  };
};

const buildPendingPostFromSubmission = (payload: any, state: any): Post | null => {
  const submission = payload?.submission;
  if (!submission?.postId || !submission?.postDraft) {
    return null;
  }

  const authorAddress = String(
    submission.author || state?.auth?.wallet?.address || '',
  )
    .trim()
    .toLowerCase();
  if (!authorAddress) {
    return null;
  }

  const postDraft = submission.postDraft || {};
  const voteData = postDraft.voteData
    ? {
        ...postDraft.voteData,
        options: Array.isArray(postDraft.voteData.options)
          ? postDraft.voteData.options
          : [],
        totalVotes: Number(postDraft.voteData.totalVotes || 0),
      }
    : undefined;
  const createdAt = String(
    submission.submittedAt || submission.updatedAt || new Date().toISOString(),
  );

  return normalizePostCounters({
    id: submission.postId,
    submissionId: submission.id || payload?.submissionId,
    author: buildPendingAuthorSummary(state, authorAddress),
    title: postDraft.title,
    content: String(postDraft.content || ''),
    localizedTitle: postDraft.title || undefined,
    localizedContent: String(postDraft.content || '').trim() || undefined,
    localization: postDraft.localization || null,
    voteData,
    lottery: voteData?.lottery || null,
    ipfsHash: String(postDraft.ipfsHash || ''),
    isAnonymous: postDraft.isAnonymous === true,
    replyTo: Number(postDraft.replyTo || 0),
    likes: 0,
    dislikes: 0,
    reposts: 0,
    replies: 0,
    comments: 0,
    isLiked: false,
    isDisliked: false,
    isReposted: false,
    createdAt,
    timestamp: createdAt,
    type: postDraft.isProposal === true ? 'proposal' : 'regular',
    status: String(submission.status || payload?.status || 'pending_review'),
    isPending: true,
    isPendingModeration: true,
    moderationStatus: {
      status: 'pending_review',
      label: 'pending moderation',
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    },
  } as Post);
};

const upsertPostToFront = (collection: Post[], nextPost: Post) => {
  const existingIndex = collection.findIndex((item) => item.id === nextPost.id);
  if (existingIndex >= 0) {
    collection.splice(existingIndex, 1);
  }
  collection.unshift(nextPost);
};

type ToggleReactionArgs = {
  postId: string;
  reactionType: ReactionType;
  currentValue: boolean;
};

type ToggleReactionResult = {
  postId: string;
  reactionType: ReactionType;
  active: boolean;
  likes: number;
  reposts: number;
  isLiked: boolean;
  isReposted: boolean;
  previousValue: boolean;
};

const applyReactionPatch = (
  collection: Post[],
  postId: string,
  reactionType: ReactionType,
  active: boolean
) => {
  const post = collection.find((item) => item.id === postId);
  if (!post) {
    return;
  }

  if (reactionType === 'like') {
    const baseline = Number(post.likes || 0);
    post.isLiked = active;
    post.likes = Math.max(0, baseline + (active ? 1 : -1));
    return;
  }

  const baseline = Number(post.reposts || 0);
  post.isReposted = active;
  post.reposts = Math.max(0, baseline + (active ? 1 : -1));
};

const applyReactionAuthoritative = (collection: Post[], payload: ToggleReactionResult) => {
  const post = collection.find((item) => item.id === payload.postId);
  if (!post) {
    return;
  }

  post.likes = payload.likes;
  post.reposts = payload.reposts;
  post.isLiked = payload.isLiked;
  post.isReposted = payload.isReposted;
};

const toNonNegativeNumber = (value: unknown): number | null => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return null;
  }
  return normalized;
};

const normalizePostCounters = (post: any): Post => {
  const replies = toNonNegativeNumber(post?.replies);
  const comments = toNonNegativeNumber(post?.comments);
  const resolvedReplies = replies ?? comments ?? 0;
  const resolvedComments = comments ?? resolvedReplies;

  return {
    ...(post as Post),
    replies: resolvedReplies,
    comments: resolvedComments,
  };
};

// Async thunks for API calls
export const fetchFeed = createAsyncThunk(
  'social/fetchFeed',
  async ({ page = 1, limit = 20, sort }: { page?: number; limit?: number; sort?: string } = {}, { getState }) => {
    // Always fetch real feed data - demo mode only affects user actions, not viewing content
    const apiService = ApiService.getInstance();
    const response = await apiService.getFeed(page, limit, sort);
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch feed');
    }
    return response.data;
  },
  {
    condition: (_: any, { getState }) => {
      try {
        const state: any = getState();
        const isLoading = !!state?.social?.isLoading;
        if (isLoading) {
          // eslint-disable-next-line no-console
          console.log('[socialSlice] Skipping fetchFeed: already loading');
          return false;
        }
      } catch {}
      return true;
    },
  }
);

export const createPostAsync = createAsyncThunk(
  'social/createPost',
  async (
    payload: {
      content: string;
      isProposal?: boolean;
      voteData?: any;
      isAnonymous?: boolean;
      ipfsHash?: string;
      replyTo?: number;
    },
    { getState }
  ) => {
    // Check if in demo mode - create local post without API call
    const demoService = DemoService.getInstance();
    if (demoService.isDemoModeActive) {
      console.log('[socialSlice] Demo mode active - creating local post (no API call)');
      const state: any = getState();
      const wallet = state?.auth?.wallet;
      return {
        id: 'demo_post_' + Date.now(),
        content: payload.content,
        author: {
          id: 'demo_user',
          address: wallet?.address || '0xDemo000000000000000000000000000000000000',
          displayName: 'Demo User',
          username: 'demo_user',
          isVerified: true,
        },
        createdAt: new Date().toISOString(),
        likes: 0,
        dislikes: 0,
        reposts: 0,
        replies: 0,
        isLiked: false,
        isDisliked: false,
        isReposted: false,
      };
    }

    const apiService = ApiService.getInstance();
    const response = await apiService.createPost(payload);
    if (!response.success) {
      throw new Error(response.error || 'Failed to create post');
    }
    const state: any = getState();
    const pendingPostRecord = buildPendingPostFromSubmission(response.data, state);
    return {
      ...response.data,
      pendingPostRecord,
    };
  }
);

export const voteOnPostAsync = createAsyncThunk(
  'social/voteOnPost',
  async ({ postId, voteOption }: { postId: string; voteOption: string | number }) => {
    // Check if in demo mode - vote locally without API call
    const demoService = DemoService.getInstance();
    if (demoService.isDemoModeActive) {
      console.log('[socialSlice] Demo mode active - recording local vote (no API call)');
      return { postId, voteOption };
    }

    const { WalletService } = require('../services/WalletService');
    const walletService = WalletService.getInstance();
    const currentWallet = walletService.getCurrentWallet();

    const apiService = ApiService.getInstance();

    if (currentWallet) {
      await apiService.initialize(currentWallet);
    }

    const response = await apiService.voteOnPost(postId, voteOption);
    if (!response.success) {
      throw new Error(response.error || 'Failed to vote');
    }
    return { postId, voteOption };
  }
);

export const toggleReactionAsync = createAsyncThunk(
  'social/toggleReaction',
  async ({ postId, reactionType, currentValue }: ToggleReactionArgs, { getState }) => {
    const nextValue = !currentValue;

    // Demo mode: keep everything local and return emulated authoritative values
    const demoService = DemoService.getInstance();
    if (demoService.isDemoModeActive) {
      const state: any = getState();
      const post = (state?.social?.feed || []).find((item: Post) => item.id === postId);
      if (!post) {
        throw new Error('Post not found');
      }

      return {
        postId,
        reactionType,
        active: nextValue,
        likes:
          reactionType === 'like'
            ? Math.max(0, Number(post.likes || 0) + (nextValue ? 1 : -1))
            : Number(post.likes || 0),
        reposts:
          reactionType === 'repost'
            ? Math.max(0, Number(post.reposts || 0) + (nextValue ? 1 : -1))
            : Number(post.reposts || 0),
        isLiked: reactionType === 'like' ? nextValue : !!post.isLiked,
        isReposted: reactionType === 'repost' ? nextValue : !!post.isReposted,
        previousValue: currentValue,
      } as ToggleReactionResult;
    }

    const { WalletService } = require('../services/WalletService');
    const walletService = WalletService.getInstance();
    const currentWallet = walletService.getCurrentWallet();

    const apiService = ApiService.getInstance();
    let response = await apiService.toggleReaction(postId, reactionType, nextValue);
    if (!response.success && currentWallet && /not initialized/i.test(response.error || '')) {
      await apiService.initialize(currentWallet);
      response = await apiService.toggleReaction(postId, reactionType, nextValue);
    }
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update reaction');
    }

    return {
      postId,
      reactionType,
      active: nextValue,
      likes: Number(response.data.likes || 0),
      reposts: Number(response.data.reposts || 0),
      isLiked: !!response.data.isLiked,
      isReposted: !!response.data.isReposted,
      previousValue: currentValue,
    } as ToggleReactionResult;
  }
);

const initialState: SocialState = {
  posts: [],
  following: [],
  followers: [],
  currentUser: null,
  feed: [],
  isLoading: false,
  error: null,
};

const socialSlice = createSlice({
  name: 'social',
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
    },
    addPost: (state, action: PayloadAction<Post>) => {
      state.posts.unshift(action.payload);
      state.feed.unshift(action.payload);
    },
    setPosts: (state, action: PayloadAction<Post[]>) => {
      state.posts = action.payload;
    },
    setFeed: (state, action: PayloadAction<Post[]>) => {
      state.feed = action.payload;
    },
    likePost: (state, action: PayloadAction<string>) => {
      const post = state.feed.find(p => p.id === action.payload);
      if (post) {
        // If already disliked, remove dislike first
        if (post.isDisliked) {
          post.isDisliked = false;
          post.dislikes = (post.dislikes || 1) - 1;
        }
        post.isLiked = !post.isLiked;
        post.likes += post.isLiked ? 1 : -1;
      }
    },
    dislikePost: (state, action: PayloadAction<string>) => {
      const post = state.feed.find(p => p.id === action.payload);
      if (post) {
        // If already liked, remove like first
        if (post.isLiked) {
          post.isLiked = false;
          post.likes -= 1;
        }
        post.isDisliked = !post.isDisliked;
        post.dislikes = (post.dislikes || 0) + (post.isDisliked ? 1 : -1);
      }
    },
    repostPost: (state, action: PayloadAction<string>) => {
      const post = state.feed.find(p => p.id === action.payload);
      if (post) {
        post.isReposted = !post.isReposted;
        post.reposts += post.isReposted ? 1 : -1;
      }
    },
    followUser: (state, action: PayloadAction<string>) => {
      if (!state.following.includes(action.payload)) {
        state.following.push(action.payload);
      }
    },
    unfollowUser: (state, action: PayloadAction<string>) => {
      state.following = state.following.filter(id => id !== action.payload);
    },
    resetSocialState: (state) => {
      state.posts = [];
      state.feed = [];
      state.following = [];
      state.followers = [];
      state.currentUser = null;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch feed
    builder
      .addCase(fetchFeed.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        // eslint-disable-next-line no-console
        console.log('[socialSlice] fetchFeed.pending -> isLoading:', true);
      })
      .addCase(fetchFeed.fulfilled, (state, action) => {
        state.isLoading = false;
        const normalizedFeed = ((action.payload || []) as any[]).map(normalizePostCounters);
        state.feed = normalizedFeed as any;
        state.posts = normalizedFeed as any;
        // eslint-disable-next-line no-console
        console.log('[socialSlice] fetchFeed.fulfilled -> items:', (action.payload || []).length);
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch feed';
        // Don't load any fallback data
        state.feed = [];
        state.posts = [];
        // eslint-disable-next-line no-console
        console.log('[socialSlice] fetchFeed.rejected -> error:', state.error);
      });

    // Create post
    builder
      .addCase(createPostAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPostAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        const payload: any = action.payload;
        const isSubmissionOnly =
          payload?.status === 'pending_review' ||
          !!payload?.submissionId ||
          !!payload?.submission;

        if (payload?.pendingPostRecord?.id) {
          upsertPostToFront(state.posts, payload.pendingPostRecord as Post);
          upsertPostToFront(state.feed, payload.pendingPostRecord as Post);
          return;
        }

        if (payload && !isSubmissionOnly && payload.id) {
          upsertPostToFront(state.posts, action.payload as any);
          upsertPostToFront(state.feed, action.payload as any);
        }
      })
      .addCase(createPostAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create post';
      });

    // Vote on post
    builder
      .addCase(voteOnPostAsync.pending, (state) => {
        // Optional: could show a voting indicator
      })
      .addCase(voteOnPostAsync.fulfilled, (state, action) => {
        const { postId, voteOption } = action.payload;
        const post = state.feed.find(p => p.id === postId);
        if (post && post.voteData) {
          // Update vote data for multi-option proposals
          const option = post.voteData.options?.find(opt => opt.id === voteOption);
          if (option) {
            option.count += 1;
            post.voteData.totalVotes = (post.voteData.totalVotes || 0) + 1;
            post.voteData.userVote = voteOption;
            
            // Recalculate percentages
            post.voteData.options?.forEach(opt => {
              opt.percentage = Math.round((opt.count / post.voteData!.totalVotes) * 100);
            });
          }
        }
      })
      .addCase(voteOnPostAsync.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to vote';
      });

    // Reactions with optimistic update + rollback
    builder
      .addCase(toggleReactionAsync.pending, (state, action) => {
        const { postId, reactionType, currentValue } = action.meta.arg;
        const nextValue = !currentValue;
        applyReactionPatch(state.feed, postId, reactionType, nextValue);
        if (state.posts !== state.feed) {
          applyReactionPatch(state.posts, postId, reactionType, nextValue);
        }
      })
      .addCase(toggleReactionAsync.fulfilled, (state, action) => {
        applyReactionAuthoritative(state.feed, action.payload);
        if (state.posts !== state.feed) {
          applyReactionAuthoritative(state.posts, action.payload);
        }
      })
      .addCase(toggleReactionAsync.rejected, (state, action) => {
        const { postId, reactionType, currentValue } = action.meta.arg;
        applyReactionPatch(state.feed, postId, reactionType, currentValue);
        if (state.posts !== state.feed) {
          applyReactionPatch(state.posts, postId, reactionType, currentValue);
        }
        state.error = action.error.message || 'Failed to update reaction';
      });
  },
});

export const {
  setCurrentUser,
  addPost,
  setPosts,
  setFeed,
  likePost,
  dislikePost,
  repostPost,
  followUser,
  unfollowUser,
  resetSocialState,
} = socialSlice.actions;

export default socialSlice.reducer;
