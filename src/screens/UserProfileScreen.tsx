import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Post, User, UserProfile } from '../types';
import ApiService from '../services/ApiService';
import { useNavigation } from '../contexts/NavigationContext';
import VotingCard from '../components/VotingCard';
import Icon from '../components/Icon';

interface UserProfileScreenProps {
  route?: any;
  navigation?: any;
}

interface RouteParams {
  userId?: string;
  userAddress?: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  isVerified?: boolean;
}

const UserProfileScreen: React.FC<UserProfileScreenProps> = () => {
  const navigation = useNavigation();
  // Get user data from navigation params
  const { userId, userAddress, username, displayName, avatar, isVerified } = navigation.params || {} as RouteParams;
  
  const feed = useSelector((state: RootState) => state.social.feed);
  const following = useSelector((state: RootState) => state.social.following);
  const currentUser = useSelector((state: RootState) => state.auth.wallet);
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts'>('posts');

  useEffect(() => {
    loadUserData();
  }, [userId, userAddress, username]);

  const loadUserData = async () => {
    console.log('[UserProfileScreen] Loading user data with params:', {
      userId, userAddress, username, displayName, avatar, isVerified
    });
    setLoading(true);
    try {
      const apiService = ApiService.getInstance();
      
      // Try to get profile from new API first
      if (userAddress) {
        console.log('Loading profile for address:', userAddress);
        const profileResult = await apiService.getUserProfile(userAddress);
        
        if (profileResult.success && profileResult.data) {
          console.log('Profile loaded from API:', profileResult.data);
          setUserProfile(profileResult.data);
          
          // Filter posts by this user
          const posts = feed.filter(post => 
            post.author.address === userAddress ||
            post.author.username === profileResult.data!.nickname
          );
          setUserPosts(posts);
          
          // Check if following
          setIsFollowing(following.includes(userAddress));
          return;
        } else {
          console.log('API profile failed, falling back to feed data');
        }
      }
      
      // Fallback 1: Use passed navigation params
      if (userAddress || userId || username) {
        const profileData: UserProfile = {
          address: userAddress || '',
          nickname: displayName || username || 'Unknown User',
          isVerified: isVerified || false,
          avatar: avatar,
          bio: '',
          source: 'params' as any,
          socialStats: {
            totalPosts: feed.filter(p => p.author.address === userAddress).length,
            totalFollowers: 0,
            totalFollowing: 0,
          }
        };
        
        setUserProfile(profileData);
        
        // Filter posts by this user
        const posts = feed.filter(post => 
          post.author.id === userId ||
          post.author.address === userAddress ||
          post.author.username === username ||
          post.author.displayName === displayName
        );
        setUserPosts(posts);
        
        // Check if following
        setIsFollowing(
          following.includes(userId || '') ||
          following.includes(userAddress || '') ||
          following.includes(username || '')
        );
        return;
      }
      
      // Fallback 2: Find user profile from posts in feed
      const userFromPosts = feed.find(post => 
        post.author.id === userId || 
        post.author.address === userAddress ||
        post.author.username === username
      )?.author;

      if (userFromPosts) {
        // Convert User to UserProfile format
        const profileData: UserProfile = {
          address: userFromPosts.address || '',
          nickname: userFromPosts.displayName || userFromPosts.username || '',
          isVerified: userFromPosts.isVerified || false,
          avatar: userFromPosts.avatar,
          bio: '',
          source: 'feed' as any,
          socialStats: {
            totalPosts: feed.filter(p => p.author.address === userFromPosts.address).length,
            totalFollowers: 0,
            totalFollowing: 0,
          }
        };
        
        setUserProfile(profileData);
        
        // Filter posts by this user
        const posts = feed.filter(post => 
          post.author.id === userFromPosts.id ||
          post.author.address === userFromPosts.address ||
          post.author.username === userFromPosts.username
        );
        setUserPosts(posts);
        
        // Check if following
        setIsFollowing(
          following.includes(userFromPosts.id || '') ||
          following.includes(userFromPosts.username || '')
        );
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleFollow = () => {
    // TODO: Implement follow/unfollow logic
    setIsFollowing(!isFollowing);
  };

  const handleBack = () => {
    navigation.navigate('Feed');
  };

  const renderUserHeader = () => {
    if (!userProfile) return null;

    return (
      <View style={styles.headerContainer}>
        <View style={styles.profileHeader}>
          {userProfile.avatar ? (
            <Image source={{ uri: userProfile.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Icon name="person" size={40} color="#536471" variant="filled" />
            </View>
          )}
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{userProfile.nickname}</Text>
              {userProfile.isVerified && (
                <Text style={styles.verifiedIcon}>✓</Text>
              )}
            </View>
            <Text style={styles.username}>@{userProfile.nickname}</Text>
            <Text style={styles.address}>
              {userProfile.address.slice(0, 6)}...{userProfile.address.slice(-4)}
            </Text>
            {userProfile.bio && (
              <Text style={styles.bio}>{userProfile.bio}</Text>
            )}
            {userProfile.location && (
              <Text style={styles.location}>📍 {userProfile.location}</Text>
            )}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {userProfile.socialStats?.totalPosts || userPosts.length}
            </Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
        </View>

      </View>
    );
  };

  const renderTabs = () => {
    return (
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
            Posts
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPost = (post: Post) => {
    return (
      <View key={post.id} style={styles.postContainer}>
        <View style={styles.postHeader}>
          <Text style={styles.postContent}>{post.content}</Text>
          <Text style={styles.postDate}>
            {new Date(post.createdAt).toLocaleDateString()}
          </Text>
        </View>
        
        {post.voteData && (
          <VotingCard
            postId={post.id}
            voteData={post.voteData}
            allowedCountries={post.allowedCountries}
            minAgeRange={post.minAgeRange}
            requiresVerification={post.requiresVerification}
            eligibilityRoot={post.eligibilityRoot}
            hasVoted={post.hasVoted}
            userVote={post.userVoteOption}
            disabled={false}
          />
        )}
        
        {/* <View style={styles.postStats}>
          <Text style={styles.statText}>👍 {post.likes || 0}</Text>
          <Text style={styles.statText}>🔄 {post.reposts || 0}</Text>
          <Text style={styles.statText}>💬 {post.replies || 0}</Text>
        </View> */}
      </View>
    );
  };

  const renderVotingHistory = () => {
    const votingPosts = userPosts.filter(post => post.voteData);
    
    if (votingPosts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🗳️</Text>
          <Text style={styles.emptyTitle}>No voting activity</Text>
          <Text style={styles.emptySubtitle}>
            This user hasn't created any proposals yet
          </Text>
        </View>
      );
    }

    return (
      <View>
        {votingPosts.map(renderPost)}
      </View>
    );
  };

  const renderContent = () => {
    if (activeTab === 'posts') {
      if (userPosts.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySubtitle}>
              This user hasn't posted anything yet
            </Text>
          </View>
        );
      }
      
      return (
        <View>
          {userPosts.map(renderPost)}
        </View>
      );
    }

    return renderVotingHistory();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D9BF0" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>User not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="arrow-back" variant="outline" size={24} color="#0F1419" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userProfile.nickname}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderUserHeader()}
        {renderTabs()}
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#0F1419',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#0F1419',
    textAlign: 'center',
    marginRight: 40, // Account for back button
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F1419',
    marginBottom: 16,
  },
  backButtonText: {
    color: '#1D9BF0',
    fontSize: 16,
    fontWeight: '600',
  },
  headerContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    backgroundColor: '#EFF3F4',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F1419',
  },
  verifiedIcon: {
    fontSize: 18,
    color: '#1D9BF0',
    marginLeft: 4,
  },
  username: {
    fontSize: 15,
    color: '#536471',
    marginTop: 2,
  },
  address: {
    fontSize: 13,
    color: '#536471',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  bio: {
    fontSize: 15,
    color: '#0F1419',
    marginTop: 8,
    lineHeight: 20,
  },
  location: {
    fontSize: 13,
    color: '#536471',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F1419',
  },
  statLabel: {
    fontSize: 13,
    color: '#536471',
    marginTop: 2,
  },
  followButton: {
    backgroundColor: '#1D9BF0',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 24,
    alignSelf: 'center',
  },
  followingButton: {
    backgroundColor: '#EFF3F4',
    borderWidth: 1,
    borderColor: '#CFD9DE',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#0F1419',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1D9BF0',
  },
  tabText: {
    fontSize: 15,
    color: '#536471',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#0F1419',
    fontWeight: '700',
  },
  postContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
  },
  postHeader: {
    marginBottom: 12,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 20,
    color: '#0F1419',
    marginBottom: 8,
  },
  postDate: {
    fontSize: 13,
    color: '#536471',
  },
  postStats: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  statText: {
    fontSize: 13,
    color: '#536471',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F1419',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#536471',
    textAlign: 'center',
  },
});

export default UserProfileScreen;