import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { likePost, dislikePost, repostPost, fetchFeed, voteOnPostAsync, setFeed } from '../store/socialSlice';
import ApiService from '../services/ApiService';
import { WalletService } from '../services/WalletService';
import { useNavigation } from '../contexts/NavigationContext';
// StorageService removed - no longer using cached posts
import { ethers } from 'ethers';
import { Post } from '../types';
import Layout from '../components/Layout';
import Logo from '../components/Logo';
import VotingCard from '../components/VotingCard';
import Icon from '../components/Icon';
import Toast from '../utils/Toast';
import { useLocalization } from '../hooks/useLocalization';

interface FeedScreenProps {
  navigation?: any;
}

const FeedScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t } = useLocalization();
  const feed = useSelector((state: RootState) => state.social.feed);
  const isLoading = useSelector((state: RootState) => state.social.isLoading);
  const error = useSelector((state: RootState) => state.social.error);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const passportData = useSelector((state: RootState) => state.auth.passportData);
  const wallet = useSelector((state: RootState) => state.auth.wallet);
  const isGuest = !passportData; // Guest if no passport data
  const following = useSelector((state: RootState) => state.social.following) || [];
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'for-you' | 'following' | 'proposals' | 'trending'>('proposals');
  const lastInitWalletRef = useRef<string | null>('__uninitialized__');
  const hasFetchedInitialRef = useRef(false);
  const hasFetchedAfterLoginRef = useRef(false);
  const loadingWatchdogRef = useRef<any>(null);

  const getFilteredFeed = () => {
    const safeFeed = Array.isArray(feed) ? feed : [];
    
    switch (activeTab) {
      case 'following':
        return safeFeed.filter(post => post && following.includes(post.author?.id));
      case 'proposals':
        return safeFeed.filter(post => post && post.voteData);
      case 'trending':
        // Server-side sorting by votes when sort=votes parameter is used
        return safeFeed;
      case 'for-you':
      default:
        return safeFeed;
    }
  };

  const filteredFeed = getFilteredFeed();

  // Debug logging
  console.log('[FeedScreen] Current state - isLoading:', isLoading, 'error:', error, 'feed length:', feed?.length);

  const handleUserPress = (user: any) => {
    // Don't navigate to our own profile
    if (user.address === wallet?.address) {
      return;
    }
    
    console.log('[FeedScreen] Navigating to user profile:', user);
    navigation.navigate('UserProfile', {
      userId: user.id,
      userAddress: user.address,
      username: user.username || user.displayName,
      displayName: user.displayName,
      avatar: user.avatar,
      isVerified: user.isVerified,
    });
  };

  // Initialize ApiService when wallet changes (avoid redundant re-inits)
  useEffect(() => {
    const init = async () => {
      try {
        const walletService = WalletService.getInstance();
        const currentWallet = walletService.getCurrentWallet();
        const addr = (wallet?.address || currentWallet?.address) ?? null;
        if (lastInitWalletRef.current === addr) {
          console.log('[FeedScreen] ApiService already initialized for', addr || 'no wallet', '- skipping');
          return;
        }
        lastInitWalletRef.current = addr;
        if (addr && Platform.OS !== 'web' && currentWallet) {
          console.log('[FeedScreen] Initializing ApiService with wallet', addr);
          await ApiService.getInstance().initialize(currentWallet);
        } else {
          console.log('[FeedScreen] Initializing ApiService without wallet');
          await ApiService.getInstance().initialize(null);
        }
      } catch (e) {
        console.warn('[FeedScreen] ApiService init failed:', e);
      }
    };
    init();
  }, [wallet]);

  // Fetch feed once on mount (avoid duplicate fetches on wallet change)
  useEffect(() => {
    if (hasFetchedInitialRef.current) return;
    hasFetchedInitialRef.current = true;
    console.log('[FeedScreen] Dispatching initial fetchFeed');

    // Test external API connectivity on Android
    if (Platform.OS === 'android') {
      console.log('[FeedScreen] Testing external API connectivity...');
      ApiService.getInstance().testExternalAPI()
        .then((result) => {
          console.log('[FeedScreen] External API test results:', result);
        })
        .catch((error) => {
          console.error('[FeedScreen] External API test failed:', error);
        });
    }

    dispatch(fetchFeed({} as any) as any).catch((e: any) =>
      console.error('[FeedScreen] Initial fetch failed:', e)
    );
  }, [dispatch]);

  // Reload feed when screen comes into focus (after login)
  useEffect(() => {
    // Check if screen is focused and we're authenticated with passport data
    if (navigation.currentScreen === 'Feed' && isAuthenticated && passportData && !hasFetchedAfterLoginRef.current) {
      console.log('[FeedScreen] User logged in and screen focused, reloading feed with user context');
      hasFetchedAfterLoginRef.current = true;
      dispatch(fetchFeed({} as any) as any).catch((e: any) =>
        console.error('[FeedScreen] Post-login fetch failed:', e)
      );
    }
  }, [navigation.currentScreen, isAuthenticated, passportData, dispatch]);

  // Watchdog: if loading persists too long with empty feed, show an alert and log
  useEffect(() => {
    // Clear any previous timer
    if (loadingWatchdogRef.current) {
      clearTimeout(loadingWatchdogRef.current);
      loadingWatchdogRef.current = null;
    }

    // Only set watchdog when loading and feed is empty
    if (isLoading && (!feed || feed.length === 0)) {
      // eslint-disable-next-line no-console
      console.log('[FeedScreen] Loading watchdog armed (8s)...');
      loadingWatchdogRef.current = setTimeout(() => {
        // eslint-disable-next-line no-console
        console.log('[FeedScreen] Loading watchdog fired. Still loading. Diagnostics:', {
          platform: Platform.OS,
          isLoading,
          error,
          feedLength: feed?.length ?? 0,
          lastInitWallet: lastInitWalletRef.current,
          initialFetchDispatched: hasFetchedInitialRef.current,
        });
        try {
          Alert.alert(
            'Debug: Still Loading',
            `platform: ${Platform.OS}\n` +
            `isLoading: ${isLoading}\n` +
            `error: ${error ?? 'none'}\n` +
            `feed length: ${feed?.length ?? 0}\n` +
            `lastInitWallet: ${String(lastInitWalletRef.current)}\n` +
            `initialFetchDispatched: ${String(hasFetchedInitialRef.current)}`
          );
        } catch {}
      }, 8000);
    }

    return () => {
      if (loadingWatchdogRef.current) {
        clearTimeout(loadingWatchdogRef.current);
        loadingWatchdogRef.current = null;
      }
    };
  }, [isLoading, feed?.length, error]);

  // Refetch feed when switching tabs with appropriate sort
  useEffect(() => {
    if (activeTab === 'trending') {
      console.log('[FeedScreen] Switching to trending tab - fetching with sort=votes');
      dispatch(fetchFeed({ sort: 'votes' } as any) as any).catch((e: any) =>
        console.error('[FeedScreen] Trending fetch failed:', e)
      );
    } else if (activeTab === 'proposals') {
      console.log('[FeedScreen] Switching to proposals tab - fetching with sort=timestamp');
      dispatch(fetchFeed({ sort: 'timestamp' } as any) as any).catch((e: any) =>
        console.error('[FeedScreen] Proposals fetch failed:', e)
      );
    }
  }, [activeTab, dispatch]);

  // Ensure FlatList always receives an array
  const safeFeed = Array.isArray(feed) ? feed : [];
  if (!Array.isArray(feed)) {
    // eslint-disable-next-line no-console
    console.warn('FeedScreen: feed is not an array, received:', typeof feed, feed);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    // Load new posts from server with appropriate sort parameter
    const sortParam = activeTab === 'trending' ? 'votes' : 
                     activeTab === 'proposals' ? 'timestamp' : undefined;
    await dispatch(fetchFeed({ sort: sortParam } as any) as any);
    setRefreshing(false);
  };

  const handleLike = async (postId: string) => {
    if (Platform.OS === 'web') {
      return; // Disabled on web
    }
    
    try {
      if (wallet) {
        // Try server vote first
        try {
          await dispatch(voteOnPostAsync({ postId, voteOption: 'like' }) as any);
          Toast.success('👍 Like recorded successfully!');
        } catch (error) {
          // Fallback to local state update
          dispatch(likePost(postId));
          Toast.info('👍 Like saved locally');
        }
      } else {
        // Local state only
        dispatch(likePost(postId));
        Toast.info('👍 Like saved locally');
      }
    } catch (error) {
      console.error('Like error:', error);
      Toast.error('Failed to like post. Please try again.');
    }
  };

  const handleDislike = async (postId: string) => {
    if (Platform.OS === 'web') {
      return; // Disabled on web
    }
    
    try {
      if (wallet) {
        // Try server vote first
        try {
          await dispatch(voteOnPostAsync({ postId, voteOption: 'dislike' }) as any);
          Toast.success('👎 Dislike recorded successfully!');
        } catch (error) {
          // Fallback to local state update
          dispatch(dislikePost(postId));
          Toast.info('👎 Dislike saved locally');
        }
      } else {
        // Local state only
        dispatch(dislikePost(postId));
        Toast.info('👎 Dislike saved locally');
      }
    } catch (error) {
      console.error('Dislike error:', error);
      Toast.error('Failed to dislike post. Please try again.');
    }
  };

  const handleSharePost = async (postId: string, content: string, author: string) => {
    try {
      const shareUrl = `https://votta.vote/p/${postId}`;
      const shareContent = content.length > 100 ? content.substring(0, 100) + '...' : content;
      
      const result = await Share.share({
        message: `Check out this proposal by ${author}: "${shareContent}" - ${shareUrl}`,
        url: shareUrl,
        title: 'Forum Proposal'
      });

      if (result.action === Share.sharedAction) {
        Toast.success('📤 Post shared successfully!');
      }
    } catch (error) {
      console.error('Share error:', error);
      Toast.error('Failed to share post');
    }
  };

  const AvatarComponent = ({ author, onPress }: { author: any, onPress: () => void }) => {
    const [imageError, setImageError] = React.useState(false);
    
    // Try to use a more reliable avatar service if the original fails
    const getAvatarSource = () => {
      if (imageError || !author.avatar) {
        // Generate consistent avatar based on username
        const seed = author.username || author.displayName || 'user';
        return { uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}` };
      }
      return { 
        uri: author.avatar,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
        }
      };
    };
    
    return (
      <TouchableOpacity style={styles.avatarColumn} onPress={onPress}>
        {author.avatar && !imageError ? (
          <Image 
            source={getAvatarSource()}
            style={styles.avatar}
            onError={(error) => {
              console.log('[FeedScreen] Image failed to load for:', author.avatar, 'trying fallback avatar');
              setImageError(true);
            }}
            onLoad={() => {
              console.log('[FeedScreen] Avatar loaded successfully for:', author.username);
            }}
          />
        ) : (
          <Image 
            source={getAvatarSource()}
            style={styles.avatar}
            onError={() => {
              console.log('[FeedScreen] Fallback avatar also failed, using icon placeholder');
            }}
            onLoad={() => {
              console.log('[FeedScreen] Fallback avatar loaded for:', author.username);
            }}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderPost = ({ item }: { item: Post }) => {
    return (
      <TouchableOpacity activeOpacity={0.9} style={styles.postContainer}>
        <View style={styles.postLayout}>
          <AvatarComponent author={item.author} onPress={() => handleUserPress(item.author)} />
        <View style={styles.contentColumn}>
          <View style={styles.postHeader}>
            <View style={styles.nameRow}>
              <TouchableOpacity onPress={() => handleUserPress(item.author)}>
                <Text style={styles.displayName}>{item.author.displayName}</Text>
              </TouchableOpacity>
              {item.author.isVerified && (
                <Icon name="checkmark" variant="filled" size={16} color="#1D9BF0" style={{marginLeft: 4, marginRight: 4}} />
              )}
              <TouchableOpacity onPress={() => handleUserPress(item.author)}>
                <Text style={styles.username}>@{item.author.username}</Text>
              </TouchableOpacity>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.time}>2h</Text>
            </View>
            <TouchableOpacity 
              style={styles.moreButton}
              onPress={() => handleSharePost(item.id, item.content, item.author.displayName)}
            >
              <Icon name="ellipsis-horizontal" size={20} color="#536471" variant="outline" />
            </TouchableOpacity>
          </View>
          
          {/* Show content only if not a voting post - voting posts show content in VotingCard */}
          {!item.voteData && (
            <Text style={styles.postContent}>{item.content}</Text>
          )}

          {/* Voting UI */}
          {item.voteData && (
            <VotingCard 
              postId={item.id}
              voteData={item.voteData}
              allowedCountries={item.allowedCountries}
              minAgeRange={item.minAgeRange}
              requiresVerification={item.requiresVerification}
              eligibilityRoot={item.eligibilityRoot}
              hasVoted={item.hasVoted}
              userVote={item.userVoteOption}
              disabled={isGuest}
              guestMessage={isGuest ? "Sign in with passport to vote on proposals" : undefined}
              proposalContent={item.content}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
    );
  };

  const content = (
    <View style={styles.container}>
      {/* Mobile Header with Logo and Settings */}
      {Platform.OS !== 'web' && (
        <View style={styles.mobileHeader}>
          <Logo size="medium" color="primary" />
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Icon name="settings-outline" size={24} color="#1D9BF0" variant="outline" />
          </TouchableOpacity>
        </View>
      )}
      
      {/* Feed Header with Tabs */}
      <View style={styles.feedHeader}>
        <View style={styles.tabContainer}>
          {Platform.OS === 'web' ? (
            <>
              <TouchableOpacity style={[styles.tab, styles.tabActive]}>
                <Text style={[styles.tabText, styles.tabTextActive]}>{t('feed.trending')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tab}>
                <Text style={styles.tabText}>{t('feed.proposals')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'proposals' && styles.tabActive]}
                onPress={() => setActiveTab('proposals')}
              >
                <Text style={[styles.tabText, activeTab === 'proposals' && styles.tabTextActive]}>{t('feed.new')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'trending' && styles.tabActive]}
                onPress={() => setActiveTab('trending')}
              >
                <Text style={[styles.tabText, activeTab === 'trending' && styles.tabTextActive]}>{t('feed.trending')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
      
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 80 : 120 }}
      >
        {isLoading && safeFeed.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1D9BF0" />
            <Text style={styles.loadingText}>{t('feed.loadingPosts')}</Text>
          </View>
        ) : error && safeFeed.length === 0 ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconContainer}>
              <Icon name="warning" size={24} color="#EF4444" variant="filled" />
              <Text style={styles.errorText}>{t('feed.failedToLoad')}</Text>
            </View>
            <Text style={styles.errorSubtext}>
              Unable to connect to the server. Please check your connection and try again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => {
              const sortParam = activeTab === 'trending' ? 'votes' : 
                               activeTab === 'proposals' ? 'timestamp' : undefined;
              dispatch(fetchFeed({ sort: sortParam } as any) as any);
            }}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : filteredFeed.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeTab === 'following' && 'No posts from people you follow'}
              {activeTab === 'proposals' && 'No voting proposals yet'}
              {activeTab === 'trending' && 'No trending posts yet'}
              {activeTab === 'for-you' && 'Welcome to Forum'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'following' && 'Start following people to see their posts here'}
              {activeTab === 'proposals' && 'Create a voting proposal to get started'}
              {activeTab === 'trending' && 'Posts will appear here when they get popular'}
              {activeTab === 'for-you' && 'One person, one vote. Join the decentralized democracy movement.'}
            </Text>
          </View>
        ) : (
          filteredFeed.map((item) => (
            <View key={item.id}>{renderPost({ item })}</View>
          ))
        )}
      </ScrollView>
      
      {/* Show FAB only on mobile and for authenticated users */}
      {Platform.OS !== 'web' && !isGuest && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('PostCreate')}
        >
          <Icon name="add" variant="filled" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      
      {/* Show Sign In button for guests */}
      {Platform.OS !== 'web' && isGuest && (
        <TouchableOpacity 
          style={styles.signInFab}
          onPress={() => navigation.navigate('Auth')}
        >
          <Icon name="person" variant="filled" size={20} color="#FFFFFF" />
          <Text style={styles.signInFabText}>{t('auth.signIn')}</Text>
        </TouchableOpacity>
      )}
      
    </View>
  );
  
  // Wrap with Layout for web
  if (Platform.OS === 'web') {
    return (
      <Layout navigation={navigation} currentScreen="Feed">
        {content}
      </Layout>
    );
  }
  
  // Return SafeAreaView for mobile with bottom navigation
  return (
    <SafeAreaView style={styles.container}>
      {content}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#536471',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F1419',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#536471',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1D9BF0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  mobileHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsButton: {
    padding: 8,
  },
  feedHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
    paddingTop: Platform.OS === 'web' ? 0 : 16,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F1419',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1D9BF0',
  },
  tabText: {
    fontSize: 15,
    color: '#536471',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0F1419',
    fontWeight: '700',
  },
  postContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
  },
  postLayout: {
    flexDirection: 'row',
    padding: 12,
  },
  avatarColumn: {
    marginRight: 12,
  },
  contentColumn: {
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF3F4',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1419',
    marginRight: 4,
  },
  verifiedBadge: {
    fontSize: 14,
    color: '#1D9BF0',
    marginRight: 4,
  },
  username: {
    fontSize: 15,
    color: '#536471',
    fontWeight: '400',
  },
  dot: {
    marginHorizontal: 4,
    color: '#536471',
    fontSize: 15,
  },
  time: {
    fontSize: 15,
    color: '#536471',
    fontWeight: '400',
  },
  moreButton: {
    padding: 8,
    marginRight: -8,
    marginTop: -8,
  },
  moreIcon: {
    fontSize: 20,
    color: '#536471',
  },
  postContent: {
    fontSize: 15,
    color: '#0F1419',
    lineHeight: 20,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 20,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
  },
  likeButton: {
    backgroundColor: '#E8F5E9',
  },
  dislikeButton: {
    backgroundColor: '#FFEBEE',
  },
  likeIcon: {
    fontSize: 16,
  },
  dislikeIcon: {
    fontSize: 16,
  },
  actionText: {
    fontSize: 13,
    color: '#536471',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeRepost: {
    color: '#00BA7C',
  },
  activeRepostText: {
    color: '#00BA7C',
  },
  activeLikeText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  activeDislikeText: {
    color: '#F44336',
    fontWeight: '600',
  },
  errorIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 31,
    fontWeight: '800',
    color: '#17559e',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#536471',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: Platform.OS === 'web' ? 20 : 16,
    bottom: Platform.OS === 'web' ? 20 : 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1D9BF0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  signInFab: {
    position: 'absolute',
    right: Platform.OS === 'web' ? 20 : 16,
    bottom: Platform.OS === 'web' ? 20 : 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  signInFabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  voteContainer: {
    marginTop: 12,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFF3F4',
  },
  voteBar: {
    height: 8,
    backgroundColor: '#EFF3F4',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  voteProgress: {
    height: '100%',
    borderRadius: 4,
  },
  voteStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  voteText: {
    fontSize: 13,
    color: '#536471',
  },
  voteButton: {
    backgroundColor: '#1D9BF0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default FeedScreen;