import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform,
  SafeAreaView,
  Share
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '../contexts/NavigationContext';
import { RootState } from '../store';
import { logout } from '../store/authSlice';
import { resetWalletState } from '../store/walletSlice';
import { resetSocialState } from '../store/socialSlice';
import { WalletService } from '../services/WalletService';
import StorageService from '../services/StorageService';
import AsyncStorageService from '../services/AsyncStorageService';
import ApiService from '../services/ApiService';
import { Post } from '../types';
import VotingCard from '../components/VotingCard';
import Toast from '../utils/Toast';
import { useLocalization } from '../hooks/useLocalization';

import Icon from '../components/Icon';

const ProfileScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t } = useLocalization();
  const { passportData, wallet, isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  // Check if this is John Doe demo account - check both direct and nested structure
  const firstName = passportData?.personalData?.firstName || passportData?.firstName || 'Guest';
  const lastName = passportData?.personalData?.lastName || passportData?.lastName || 'User';
  const isDemoAccount = firstName === 'John' && lastName === 'Doe';
  const feed = useSelector((state: RootState) => state.social.feed);
  const [balance, setBalance] = useState('0');
  const [identityHash, setIdentityHash] = useState('');
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [myVotes, setMyVotes] = useState<any[]>([]);
  const [voteStats, setVoteStats] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'posts' | 'votes'>('profile');
  const walletService = WalletService.getInstance();
  const storageService = StorageService.getInstance();

  useEffect(() => {
    loadUserData();
  }, [wallet]);

  const loadUserData = async () => {
    if (wallet) {
      try {
        // Get wallet balance
        const walletBalance = await walletService.getBalance();
        setBalance(walletBalance);
        
        // Get identity hash from passport data
        if (passportData) {
          const hash = await walletService.getIdentityHash(passportData);
          setIdentityHash(hash);
        }
        
        // Load my posts (posts created by this wallet address)
        const posts = feed.filter(post => 
          post.author.id === wallet.address ||
          post.author.address === wallet.address ||
          post.author.username === firstName?.toLowerCase()
        );
        setMyPosts(posts);
        
        // Load my voting history from API
        try {
          const apiService = ApiService.getInstance();
          const profileResponse = await apiService.getMyProfileWithVotingHistory();
          
          if (profileResponse.success && profileResponse.data.profile) {
            const profile = profileResponse.data.profile;
            setProfileData(profile);
            setVoteStats(profile.voteStats);
            setMyVotes(profile.voteStats?.recentVotes || []);
            
            console.log('[ProfileScreen] Voting history loaded:', {
              totalVotes: profile.voteStats?.totalVotes,
              recentVotes: profile.voteStats?.recentVotes?.length
            });
          } else {
            console.log('[ProfileScreen] No voting history available or API failed, using storage fallback');
            // Fallback to storage
            const votes = await storageService.getUserVotes();
            setMyVotes(votes);
          }
        } catch (error) {
          console.error('[ProfileScreen] Failed to load voting history from API, using storage fallback:', error);
          // Fallback to storage
          const votes = await storageService.getUserVotes();
          setMyVotes(votes);
        }
        
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Starting logout process...');
      
      // Clear wallet data and private keys
      const walletService = WalletService.getInstance();
      await walletService.clearWallet();
      
      // Clear all user-specific storage data
      const storageService = StorageService.getInstance();
      await storageService.clearAllUserData();
      
      // Clear stored passport and MRZ data
      await AsyncStorageService.removeItem('passport_data');
      await AsyncStorageService.removeItem('mrz_data');
      console.log('✅ Passport data cleared from storage');
      
      // Clear all Redux states
      dispatch(resetSocialState());
      dispatch(resetWalletState());
      dispatch(logout());
      
      console.log('✅ Logout completed - all data cleared');
      
      // Navigate to Feed screen for guest experience
      navigation.navigate('Feed');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      // Still logout even if cleanup fails
      dispatch(logout());
      // Navigate to Feed screen for guest experience
      navigation.navigate('Feed');
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleShareProfile = async () => {
    try {
      const profileUrl = `https://votta.vote/u/${wallet?.address}`;
      const displayName = passportData ? `${firstName} ${lastName}` : 'Forum User';
      
      const result = await Share.share({
        message: `Check out ${displayName}'s profile on Forum - Join the democratic movement: ${profileUrl}`,
        url: profileUrl,
        title: `${displayName}'s Forum Profile`
      });

      if (result.action === Share.sharedAction) {
        Toast.success(t('profile.profileShared'));
      }
    } catch (error) {
      console.error('Share error:', error);
      Toast.error(t('profile.shareError'));
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return t('profile.noWallet');
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatHash = (hash: string) => {
    if (!hash) return t('profile.notAvailable');
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(text);
      alert(t('profile.copiedToClipboard', { label }));
    } else {
      // For React Native, you'd need to import Clipboard from @react-native-clipboard/clipboard
      alert(`${label}: ${text}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Navigation Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>
              {t('profile.profile')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
              {t('profile.myProposals', { count: myPosts.length })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'votes' && styles.activeTab]}
            onPress={() => setActiveTab('votes')}
          >
            <Text style={[styles.tabText, activeTab === 'votes' && styles.activeTabText]}>
              {t('profile.myVotes', { count: voteStats?.totalVotes || myVotes.length })}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Content based on active tab */}
        {activeTab === 'profile' && (
          <View>
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                 <Icon name="person" variant="filled" size={48} color="#1DA1F2" />
              </View>
              <View style={styles.nameContainer}>
                <Text style={styles.name}>
                  {firstName} {lastName}
                </Text>
                {isDemoAccount && (
                  <View style={styles.demoBadge}>
                    <Text style={styles.demoBadgeText}>DEMO</Text>
                  </View>
                )}
              </View>
              {isAuthenticated && (
                <View style={styles.verifiedBadge}>
                   <Text style={{color: '#1DA1F2'}}>✓</Text>
                  <Text style={styles.verifiedText}>{t('profile.verifiedIdentity')}</Text>
                </View>
              )}
            </View>

            {/* Share Profile Button */}
            <TouchableOpacity style={styles.shareButton} onPress={handleShareProfile}>
              <Icon name="share" variant="outline" size={20} color="#1D9BF0" />
              <Text style={styles.shareButtonText}>{t('profile.shareProfile')}</Text>
            </TouchableOpacity>

        {/* Identity Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.identityDetails')}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.documentType')}</Text>
            <Text style={styles.value}>{passportData?.documentType || 'Passport'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.documentNumber')}</Text>
            <Text style={styles.value}>{passportData?.personalData?.documentNumber || passportData?.documentNumber || t('profile.notAvailable')}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.dateOfBirth')}</Text>
            <Text style={styles.value}>{passportData?.personalData?.dateOfBirth || passportData?.dateOfBirth || t('profile.notAvailable')}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.nationality')}</Text>
            <Text style={styles.value}>{passportData?.personalData?.nationality || passportData?.nationality || passportData?.issuingCountry || t('profile.notAvailable')}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.issuingState')}</Text>
            <Text style={styles.value}>{passportData?.personalData?.issuingState || passportData?.issuingState || t('profile.notAvailable')}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.registrationDate')}</Text>
            <Text style={styles.value}>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Wallet Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.walletInformation')}</Text>
          
          <TouchableOpacity 
            style={styles.infoRow}
            onPress={() => wallet?.address && copyToClipboard(wallet.address, 'Wallet address')}
          >
            <Text style={styles.label}>{t('profile.address')}</Text>
            <View style={styles.valueRow}>
              <Text style={styles.monoValue}>{formatAddress(wallet?.address || '')}</Text>
              <Text style={{fontSize: 16, color: '#8B98A5'}}>📋</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.balance')}</Text>
            <Text style={styles.value}>{balance} ETH</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.network')}</Text>
            <Text style={styles.value}>Sepolia Testnet</Text>
          </View>
        </View>

        {/* Security Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.security')}</Text>
          
          <TouchableOpacity 
            style={styles.infoRow}
            onPress={() => identityHash && copyToClipboard(identityHash, 'Identity hash')}
          >
            <Text style={styles.label}>{t('profile.identityHash')}</Text>
            <View style={styles.valueRow}>
              <Text style={styles.monoValue}>{formatHash(identityHash)}</Text>
              <Text style={{fontSize: 16, color: '#8B98A5'}}>📋</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.verificationMethod')}</Text>
            <Text style={styles.value}>{passportData ? t('profile.nfcPassport') : t('profile.demoMode')}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.accountStatus')}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{t('profile.active')}</Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
          
          <TouchableOpacity 
            style={styles.settingRow}
            onPress={() => {
              console.log('Navigating to Settings...');
              navigation.navigate('Settings');
            }}
          >
            <View style={styles.settingLeft}>
              <Icon name="settings" size={20} color="#374151" variant="outline" />
              <Text style={styles.settingText}>{t('profile.settings')}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#8B98A5" variant="outline" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Icon name="lock-closed" size={20} color="#374151" variant="outline" />
              <Text style={styles.settingText}>{t('profile.privacySecurity')}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#8B98A5" variant="outline" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Icon name="help-circle" size={20} color="#374151" variant="outline" />
              <Text style={styles.settingText}>{t('profile.helpSupport')}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#8B98A5" variant="outline" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('profile.forumVersion')}</Text>
          <Text style={styles.footerSubtext}>{t('profile.platformDescription')}</Text>
        </View>
          </View>
        )}
        
        {activeTab === 'posts' && (
          <View style={styles.postsContainer}>
            {myPosts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="document" size={48} color="#8B98A5" variant="outline" style={styles.emptyIconStyle} />
                <Text style={styles.emptyTitle}>{t('profile.noProposals')}</Text>
                <Text style={styles.emptySubtitle}>{t('profile.proposalsWillAppear')}</Text>
              </View>
            ) : (
              myPosts.map((post) => (
                <View key={post.id} style={styles.postContainer}>
                  <Text style={styles.postContent}>{post.content}</Text>
                  <Text style={styles.postDate}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </Text>
                  
                  {post.voteData && (
                    <VotingCard
                      postId={post.id}
                      voteData={post.voteData}
                    />
                  )}
                  
                  <View style={styles.postStats}>
                    <Text style={styles.statText}>👍 {post.likes || 0}</Text>
                    <Text style={styles.statText}>{t('profile.reposts', { count: post.reposts || 0 })}</Text>
                    <Text style={styles.statText}>{t('profile.replies', { count: post.replies || 0 })}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        
        {activeTab === 'votes' && (
          <View style={styles.votesContainer}>
            {/* Voting Statistics */}
            {voteStats && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('profile.votingStatistics')}</Text>
                
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{voteStats.totalVotes || 0}</Text>
                    <Text style={styles.statLabel}>{t('profile.totalVotes')}</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{voteStats.optionVotes || 0}</Text>
                    <Text style={styles.statLabel}>{t('profile.proposalVotes')}</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>
                      {voteStats.totalVotes > 0 ? Math.round((voteStats.upVotes / voteStats.totalVotes) * 100) : 0}%
                    </Text>
                    <Text style={styles.statLabel}>{t('profile.positiveRate')}</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>
                      {voteStats.totalVotes > 20 ? t('profile.high') : voteStats.totalVotes > 5 ? t('profile.medium') : t('profile.low')}
                    </Text>
                    <Text style={styles.statLabel}>{t('profile.activity')}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Recent Votes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('profile.recentVotes')}</Text>
              {myVotes.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon name="ballot" size={48} color="#8B98A5" variant="outline" style={styles.emptyIconStyle} />
                  <Text style={styles.emptyTitle}>{t('profile.noVotes')}</Text>
                  <Text style={styles.emptySubtitle}>{t('profile.votingHistoryWillAppear')}</Text>
                </View>
              ) : (
                myVotes.map((vote, index) => {
                  const post = feed.find(p => p.id === vote.postId);
                  const option = post?.voteData?.options?.find(opt => 
                    String(opt.id) === String(vote.voteType || vote.voteOption)
                  );
                  
                  return (
                    <View key={`${vote.postId}-${index}`} style={styles.voteContainer}>
                      <Text style={styles.voteTitle}>
                        {post?.content.split('\n')[0] || vote.postId || 'Unknown Post'}
                      </Text>
                      <Text style={styles.voteChoice}>
                        {t('profile.voted', { option: option?.label || vote.voteOption || vote.voteType })}
                      </Text>
                      <Text style={styles.voteDate}>
                        {new Date(vote.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}
        
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  profileHeader: { 
    alignItems: 'center', 
    padding: 30, 
    backgroundColor: '#000',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1DA1F2',
  },
  name: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginTop: 16,
    color: '#fff',
  },
  verifiedBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8,
    backgroundColor: '#0A1929',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  verifiedText: { 
    marginLeft: 4, 
    color: '#1DA1F2',
    fontSize: 14,
    fontWeight: '500',
  },
  nameContainer: {
    alignItems: 'center',
    gap: 8,
  },
  demoBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 4,
  },
  demoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  section: { 
    backgroundColor: '#0A0A0A', 
    padding: 20, 
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: '700', 
    marginBottom: 20,
    color: '#8B98A5',
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  label: {
    fontSize: 14,
    color: '#8B98A5',
  },
  value: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monoValue: {
    fontSize: 13,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 14,
    color: '#fff',
  },
  logoutButton: { 
    margin: 20, 
    padding: 16, 
    backgroundColor: '#DC2626', 
    borderRadius: 8,
  },
  logoutText: { 
    color: '#FFFFFF', 
    textAlign: 'center', 
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 20,
  },
  footerText: {
    color: '#17559e',
    fontSize: 14,
  },
  footerSubtext: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1DA1F2',
  },
  tabText: {
    fontSize: 14,
    color: '#8B98A5',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1DA1F2',
    fontWeight: '700',
  },
  postsContainer: {
    backgroundColor: '#000',
  },
  postContainer: {
    backgroundColor: '#0A0A0A',
    padding: 20,
    marginTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
    marginBottom: 8,
  },
  postDate: {
    fontSize: 13,
    color: '#8B98A5',
    marginBottom: 12,
  },
  postStats: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  statText: {
    fontSize: 13,
    color: '#8B98A5',
  },
  votesContainer: {
    backgroundColor: '#000',
  },
  voteContainer: {
    backgroundColor: '#0A0A0A',
    padding: 20,
    marginTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  voteTitle: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 8,
    lineHeight: 22,
  },
  voteChoice: {
    fontSize: 14,
    color: '#1DA1F2',
    marginBottom: 4,
  },
  voteDate: {
    fontSize: 13,
    color: '#8B98A5',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#000',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyIconStyle: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8B98A5',
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(29, 155, 240, 0.1)',
    borderColor: '#1D9BF0',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  shareButtonText: {
    color: '#1D9BF0',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1C1C1C',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1DA1F2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8B98A5',
    textAlign: 'center',
  },
});

export default ProfileScreen;