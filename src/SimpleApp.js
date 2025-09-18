import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  FlatList,
  Modal,
  Dimensions,
  Platform
} from 'react-native';

const { width, height } = Dimensions.get('window');

const SimpleApp = () => {
  const [currentScreen, setCurrentScreen] = useState('splash');
  const [activeTab, setActiveTab] = useState('Feed');
  const [composeVisible, setComposeVisible] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [posts, setPosts] = useState([
    {
      id: '1',
      author: 'John Smith',
      handle: '@john_smith',
      verified: true,
      content: 'Just voted on the new DAO proposal using my passport verification! Democracy meets blockchain 🗳️',
      timestamp: '2m',
      likes: 42,
      reposts: 12,
      comments: 8,
      tips: 0.5,
      liked: false,
      reposted: false,
    },
    {
      id: '2',
      author: 'Sarah Chen',
      handle: '@sarah_chen',
      verified: true,
      content: 'Created a new poll:',
      timestamp: '15m',
      likes: 156,
      reposts: 45,
      comments: 23,
      tips: 0,
      liked: true,
      reposted: false,
      poll: {
        question: 'Should we implement quadratic voting?',
        options: [
          {text: 'Yes', percentage: 67, votes: 823},
          {text: 'No', percentage: 33, votes: 411},
        ],
        totalVotes: 1234,
        timeLeft: '2 hours left',
      },
    },
    {
      id: '3',
      author: 'Crypto Mike',
      handle: '@crypto_mike',
      verified: true,
      content: 'New NFT drop exclusively for verified passport holders! Link your wallet to claim 🎨',
      timestamp: '1h',
      likes: 89,
      reposts: 23,
      comments: 15,
      tips: 2.0,
      liked: false,
      reposted: true,
    },
  ]);

  useEffect(() => {
    // Show splash screen for 3 seconds
    const timer = setTimeout(() => {
      setCurrentScreen('main');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleLike = (postId) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          liked: !post.liked,
          likes: post.liked ? post.likes - 1 : post.likes + 1,
        };
      }
      return post;
    }));
  };

  const handleRepost = (postId) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          reposted: !post.reposted,
          reposts: post.reposted ? post.reposts - 1 : post.reposts + 1,
        };
      }
      return post;
    }));
  };

  const renderPost = ({ item }) => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.author.split(' ').map(n => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.postAuthor}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{item.author}</Text>
            {item.verified && <Text style={styles.verified}>✓</Text>}
          </View>
          <Text style={styles.handle}>{item.handle} · {item.timestamp}</Text>
        </View>
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      {item.poll && (
        <View style={styles.pollContainer}>
          <Text style={styles.pollQuestion}>{item.poll.question}</Text>
          {item.poll.options.map((option, index) => (
            <TouchableOpacity key={index} style={styles.pollOption}>
              <View style={[styles.pollBar, { width: `${option.percentage}%` }]} />
              <Text style={styles.pollText}>
                {option.text} {option.percentage}%
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.pollInfo}>
            {item.poll.totalVotes} votes · {item.poll.timeLeft}
          </Text>
        </View>
      )}

      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}>
          <Text style={[styles.actionIcon, item.liked && styles.likedIcon]}>
            {item.liked ? '❤' : '♡'}
          </Text>
          <Text style={[styles.actionText, item.liked && styles.likedText]}>
            {item.likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleRepost(item.id)}>
          <Text style={[styles.actionIcon, item.reposted && styles.repostedIcon]}>
            🔄
          </Text>
          <Text style={[styles.actionText, item.reposted && styles.repostedText]}>
            {item.reposts}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionText}>{item.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.tipIcon}>⟠</Text>
          <Text style={styles.actionText}>
            {item.tips > 0 ? `${item.tips} ETH` : 'Tip'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>↗</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Splash Screen
  if (currentScreen === 'splash') {
    return (
      <View style={styles.splash}>
        <View style={styles.splashLogo}>
          <Text style={styles.passportEmoji}>📔</Text>
          <Text style={styles.nfcSymbol}>📡</Text>
        </View>
        <Text style={styles.splashTitle}>Forum.org</Text>
        <Text style={styles.splashSubtitle}>Anonymous Democracy Platform</Text>
        <View style={styles.tagline}>
          <Text style={styles.taglineText}>Passport • Wallet • Social</Text>
        </View>
      </View>
    );
  }

  // Main App
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Forum.org</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Text style={styles.headerIcon}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Text style={styles.headerIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed Screen */}
      {activeTab === 'Feed' && (
        <View style={styles.feedWrapper}>
          <TouchableOpacity
            style={styles.composeBar}
            onPress={() => setComposeVisible(true)}>
            <Text style={styles.composePlaceholder}>What's happening?</Text>
            <Text style={styles.composeIcon}>✏️</Text>
          </TouchableOpacity>

          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.feedContainer}
          />
        </View>
      )}

      {/* Wallet Screen */}
      {activeTab === 'Wallet' && (
        <ScrollView style={styles.walletContainer}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceTitle}>Total Balance</Text>
            <Text style={styles.balanceAmount}>12.5 ETH</Text>
            <Text style={styles.balanceUsd}>≈ $25,000 USD</Text>
          </View>
          
          <View style={styles.walletActions}>
            <TouchableOpacity style={styles.walletButton}>
              <Text style={styles.walletButtonIcon}>⬆️</Text>
              <Text style={styles.walletButtonText}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.walletButton}>
              <Text style={styles.walletButtonIcon}>⬇️</Text>
              <Text style={styles.walletButtonText}>Receive</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.walletButton}>
              <Text style={styles.walletButtonIcon}>⇄</Text>
              <Text style={styles.walletButtonText}>Swap</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.walletButton}>
              <Text style={styles.walletButtonIcon}>📊</Text>
              <Text style={styles.walletButtonText}>History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionList}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.transaction}>
              <Text style={styles.transactionIcon}>⬆️</Text>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>Sent tip to @john_smith</Text>
                <Text style={styles.transactionTime}>2 min ago</Text>
              </View>
              <Text style={styles.transactionAmount}>-0.5 ETH</Text>
            </View>
            <View style={styles.transaction}>
              <Text style={styles.transactionIcon}>⬇️</Text>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>Received from @sarah_chen</Text>
                <Text style={styles.transactionTime}>1 hour ago</Text>
              </View>
              <Text style={styles.transactionAmount}>+1.2 ETH</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Profile Screen */}
      {activeTab === 'Profile' && (
        <ScrollView style={styles.profileContainer}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>AD</Text>
            </View>
            <Text style={styles.profileName}>Alice Doe ✓</Text>
            <Text style={styles.profileHandle}>@alice_doe</Text>
            <Text style={styles.profileBio}>Digital nomad | Web3 enthusiast | DAO voter</Text>
            <View style={styles.profileStats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>1,234</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>5,678</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
            </View>
          </View>
          <View style={styles.profileWallet}>
            <Text style={styles.walletAddress}>0x742d...39eD</Text>
            <TouchableOpacity style={styles.copyButton}>
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'Feed' && styles.navItemActive]}
          onPress={() => setActiveTab('Feed')}>
          <Text style={[styles.navIcon, activeTab === 'Feed' && styles.navIconActive]}>🏠</Text>
          <Text style={[styles.navLabel, activeTab === 'Feed' && styles.navLabelActive]}>
            Home
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'Explore' && styles.navItemActive]}
          onPress={() => setActiveTab('Explore')}>
          <Text style={[styles.navIcon, activeTab === 'Explore' && styles.navIconActive]}>🔍</Text>
          <Text style={[styles.navLabel, activeTab === 'Explore' && styles.navLabelActive]}>
            Explore
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'Wallet' && styles.navItemActive]}
          onPress={() => setActiveTab('Wallet')}>
          <Text style={[styles.navIcon, activeTab === 'Wallet' && styles.navIconActive]}>💳</Text>
          <Text style={[styles.navLabel, activeTab === 'Wallet' && styles.navLabelActive]}>
            Wallet
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'Messages' && styles.navItemActive]}
          onPress={() => setActiveTab('Messages')}>
          <Text style={[styles.navIcon, activeTab === 'Messages' && styles.navIconActive]}>✉️</Text>
          <Text style={[styles.navLabel, activeTab === 'Messages' && styles.navLabelActive]}>
            Messages
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'Profile' && styles.navItemActive]}
          onPress={() => setActiveTab('Profile')}>
          <Text style={[styles.navIcon, activeTab === 'Profile' && styles.navIconActive]}>👤</Text>
          <Text style={[styles.navLabel, activeTab === 'Profile' && styles.navLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* Compose Modal */}
      <Modal
        visible={composeVisible}
        animationType="slide"
        transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setComposeVisible(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity style={styles.postButton}>
                <Text style={styles.postButtonText}>Post</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.composeInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#666"
              multiline
              value={newPost}
              onChangeText={setNewPost}
              maxLength={280}
            />
            <View style={styles.composeFooter}>
              <View style={styles.composeActions}>
                <TouchableOpacity style={styles.composeAction}>
                  <Text style={styles.composeActionIcon}>📷</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.composeAction}>
                  <Text style={styles.composeActionIcon}>🎥</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.composeAction}>
                  <Text style={styles.composeActionIcon}>📊</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.composeAction}>
                  <Text style={styles.composeActionIcon}>📍</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.charCount}>{280 - newPost.length}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  splash: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 120,
    height: 120,
    backgroundColor: '#3a3a3a',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  passportEmoji: {
    fontSize: 60,
  },
  nfcSymbol: {
    position: 'absolute',
    top: -10,
    right: -10,
    fontSize: 30,
  },
  splashTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  splashSubtitle: {
    fontSize: 18,
    color: '#a0a0a0',
    marginBottom: 20,
  },
  tagline: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  taglineText: {
    color: '#fff',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 20,
  },
  headerIcon: {
    fontSize: 20,
  },
  feedWrapper: {
    flex: 1,
  },
  composeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    margin: 10,
    padding: 15,
    borderRadius: 10,
  },
  composePlaceholder: {
    color: '#666',
    fontSize: 16,
  },
  composeIcon: {
    fontSize: 20,
    color: '#666',
  },
  feedContainer: {
    paddingBottom: 20,
  },
  postContainer: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 10,
    marginVertical: 5,
    padding: 15,
    borderRadius: 10,
  },
  postHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4c669f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  postAuthor: {
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 5,
  },
  verified: {
    color: '#4c669f',
    fontSize: 16,
  },
  handle: {
    color: '#666',
    fontSize: 14,
  },
  postContent: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  pollContainer: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  pollQuestion: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  pollOption: {
    backgroundColor: '#333',
    borderRadius: 5,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
    height: 35,
    justifyContent: 'center',
  },
  pollBar: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#4c669f',
    borderRadius: 5,
  },
  pollText: {
    color: '#fff',
    paddingHorizontal: 10,
    zIndex: 1,
  },
  pollInfo: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 20,
    color: '#666',
    marginRight: 5,
  },
  likedIcon: {
    color: '#e91e63',
  },
  repostedIcon: {
    color: '#4caf50',
  },
  actionText: {
    color: '#666',
    fontSize: 14,
  },
  likedText: {
    color: '#e91e63',
  },
  repostedText: {
    color: '#4caf50',
  },
  tipIcon: {
    fontSize: 16,
    color: '#ffa726',
  },
  walletContainer: {
    flex: 1,
    padding: 20,
  },
  balanceCard: {
    backgroundColor: '#2a2a2a',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 30,
  },
  balanceTitle: {
    color: '#666',
    fontSize: 14,
    marginBottom: 10,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  balanceUsd: {
    color: '#666',
    fontSize: 16,
  },
  walletActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  walletButton: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  walletButtonIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  walletButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  transactionList: {
    flex: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  transaction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  transactionIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 3,
  },
  transactionTime: {
    color: '#666',
    fontSize: 12,
  },
  transactionAmount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileContainer: {
    flex: 1,
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4c669f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  profileHandle: {
    color: '#666',
    fontSize: 16,
    marginBottom: 15,
  },
  profileBio: {
    color: '#a0a0a0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#666',
    fontSize: 14,
  },
  profileWallet: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletAddress: {
    color: '#fff',
    fontSize: 14,
  },
  copyButton: {
    backgroundColor: '#4c669f',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#4c669f',
  },
  navIcon: {
    fontSize: 24,
    color: '#666',
  },
  navIconActive: {
    color: '#4c669f',
  },
  navLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  navLabelActive: {
    color: '#4c669f',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeIcon: {
    fontSize: 24,
    color: '#fff',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  postButton: {
    backgroundColor: '#4c669f',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  composeInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 15,
    textAlignVertical: 'top',
  },
  composeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  composeActions: {
    flexDirection: 'row',
  },
  composeAction: {
    marginRight: 20,
  },
  composeActionIcon: {
    fontSize: 24,
    color: '#666',
  },
  charCount: {
    color: '#666',
  },
});

export default SimpleApp;