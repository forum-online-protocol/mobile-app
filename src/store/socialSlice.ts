import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Post, User } from '../types';
import ApiService from '../services/ApiService';
import { ethers } from 'ethers';

interface SocialState {
  posts: Post[];
  following: string[];
  followers: string[];
  currentUser: User | null;
  feed: Post[];
  isLoading: boolean;
  error: string | null;
}

// Async thunks for API calls
export const fetchFeed = createAsyncThunk(
  'social/fetchFeed',
  async ({ page = 1, limit = 20, sort }: { page?: number; limit?: number; sort?: string } = {}, { getState }) => {
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
  async (content: string) => {
    const apiService = ApiService.getInstance();
    const response = await apiService.createPost(content);
    if (!response.success) {
      throw new Error(response.error || 'Failed to create post');
    }
    return response.data;
  }
);

export const voteOnPostAsync = createAsyncThunk(
  'social/voteOnPost',
  async ({ postId, voteOption }: { postId: string; voteOption: string | number }) => {
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
        state.feed = (action.payload || []) as any;
        state.posts = (action.payload || []) as any;
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
        if (action.payload) {
          state.posts.unshift(action.payload as any);
          state.feed.unshift(action.payload as any);
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