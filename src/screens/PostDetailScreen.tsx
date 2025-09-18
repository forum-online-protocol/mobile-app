import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useNavigation } from '../contexts/NavigationContext';
import { Post } from '../types';
import ApiService from '../services/ApiService';
import VotingCard from '../components/VotingCard';
import Icon from '../components/Icon';
import Toast from '../utils/Toast';

interface PostDetailScreenProps {
  route?: {
    params: {
      postId: string;
    };
  };
}

const PostDetailScreen: React.FC<PostDetailScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const feed = useSelector((state: RootState) => state.social.feed);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const postId = route?.params?.postId;

  useEffect(() => {
    loadPost();
  }, [postId]);

  const loadPost = async () => {
    if (!postId) {
      setError('No post ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('[PostDetail] Loading post:', postId);

      // First, try to find the post in the current feed
      const existingPost = feed.find(p => p.id === postId);
      if (existingPost) {
        console.log('[PostDetail] Found post in feed cache');
        setPost(existingPost);
        setLoading(false);
        return;
      }

      // If not in cache, try to fetch from API using ApiService
      console.log('[PostDetail] Post not in cache, fetching from API...');
      
      const apiService = ApiService.getInstance();
      
      // Try to get the specific post using dedicated endpoint
      const postResponse = await apiService.getPost(postId);
      
      if (postResponse.success && postResponse.data) {
        console.log('[PostDetail] Found post from API:', postResponse.data);
        setPost(postResponse.data);
      } else {
        // Fallback: try to find in fresh feed data
        console.log('[PostDetail] Single post fetch failed, trying feed...');
        const feedResponse = await apiService.getFeed(1, 50);
        
        if (feedResponse.success) {
          const targetPost = feedResponse.data.find(p => p.id === postId);
          if (targetPost) {
            console.log('[PostDetail] Found post in fresh feed data:', targetPost);
            setPost(targetPost);
          } else {
            throw new Error('Post not found');
          }
        } else {
          throw new Error(postResponse.error || 'Failed to fetch post');
        }
      }

    } catch (err) {
      console.error('[PostDetail] Error loading post:', err);
      setError(err instanceof Error ? err.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Feed');
    }
  };

  const handleUserPress = (author: any) => {
    navigation.navigate('UserProfile', { 
      userId: author.id,
      userAddress: author.address,
      username: author.username 
    });
  };

  const handleSharePost = async () => {
    if (!post) return;

    try {
      const shareUrl = `https://votta.vote/p/${post.id}`;
      const shareContent = post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content;
      
      const result = await Share.share({
        message: `Check out this proposal by ${post.author.displayName}: "${shareContent}" - ${shareUrl}`,
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

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - postTime.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'now';
    if (diffInHours < 24) return `${diffInHours}h`;
    return `${Math.floor(diffInHours / 24)}d`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#FFFFFF" variant="outline" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D9BF0" />
          <Text style={styles.loadingText}>Loading post...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#FFFFFF" variant="outline" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={styles.errorContainer}>
          <Icon name="warning" size={48} color="#EF4444" variant="filled" />
          <Text style={styles.errorTitle}>Post Not Found</Text>
          <Text style={styles.errorText}>
            {error || 'This post may have been removed or doesn\'t exist.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPost}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#FFFFFF" variant="outline" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <TouchableOpacity onPress={handleSharePost} style={styles.shareButton}>
          <Icon name="share" size={20} color="#FFFFFF" variant="outline" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.postContainer}>
          {/* Author Info */}
          <TouchableOpacity style={styles.authorSection} onPress={() => handleUserPress(post.author)}>
            {post.author.avatar ? (
              <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Icon name="person" size={24} color="#536471" variant="filled" />
              </View>
            )}
            <View style={styles.authorInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{post.author.displayName}</Text>
                {post.author.isVerified && (
                  <Icon name="checkmark" variant="filled" size={16} color="#1D9BF0" style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={styles.username}>@{post.author.username}</Text>
              {post.isAnonymous && (
                <View style={styles.anonymousBadge}>
                  <Text style={styles.anonymousBadgeText}>🔒 Anonymous Vote</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Post Content */}
          <View style={styles.contentSection}>
            <Text style={styles.postContent}>{post.content}</Text>
            <Text style={styles.postTime}>
              {new Date(post.timestamp || post.createdAt).toLocaleString()}
            </Text>
          </View>

          {/* Voting Card */}
          {post.voteData && (
            <View style={styles.votingSection}>
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
            </View>
          )}

          {/* Post Stats (if needed) */}
          <View style={styles.statsSection}>
            <Text style={styles.statText}>🔄 {post.reposts || 0} reposts</Text>
            <Text style={styles.statText}>💬 {post.replies || 0} replies</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  shareButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8B98A5',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#8B98A5',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1D9BF0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  postContainer: {
    backgroundColor: '#1A1A1A',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  authorSection: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#EFF3F4',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 14,
    color: '#8B98A5',
  },
  anonymousBadge: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  anonymousBadgeText: {
    fontSize: 11,
    color: '#FFC107',
    fontWeight: '500',
  },
  contentSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  postContent: {
    fontSize: 18,
    lineHeight: 24,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  postTime: {
    fontSize: 14,
    color: '#8B98A5',
  },
  votingSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  statText: {
    fontSize: 14,
    color: '#8B98A5',
  },
});

export default PostDetailScreen;