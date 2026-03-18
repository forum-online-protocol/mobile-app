import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Share,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { Post, UserProfile } from "../types";
import ApiService from "../services/ApiService";
import { useNavigation } from "../contexts/NavigationContext";
import VotingCard from "../components/VotingCard";
import Icon from "../components/Icon";
import PostActionBar from "../components/PostActionBar";
import Toast from "../utils/Toast";
import {
  followUser as followUserAction,
  unfollowUser as unfollowUserAction,
  toggleReactionAsync,
} from "../store/socialSlice";
import { useTheme } from "../contexts/ThemeContext";
import { useLocalization } from "../hooks/useLocalization";
import { useServerFeatureFlags } from "../hooks/useServerFeatureFlags";
import { buildPostShareUrl } from "../utils/shareLinks";
import { getPostAuthorPresentation } from "../utils/anonymousPost";
import { getPostDisplayContent } from "../utils/localizedPost";
import { monoFontFamily } from "../styles/tokens";

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

interface UserFeedIdentity {
  id?: string;
  address?: string;
  username?: string;
  displayName?: string;
}

type VoteLookupMap = Map<string, string | number>;

const normalizeIdentityValue = (value?: string): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const formatTimestamp = (timestamp?: string | number | Date): string => {
  if (!timestamp) return "";

  const date =
    typeof timestamp === "string"
      ? new Date(timestamp)
      : typeof timestamp === "number"
        ? new Date(timestamp)
        : timestamp;

  if (Number.isNaN(date.getTime())) return "";

  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek}w`;

  return date.toLocaleDateString();
};

const truncateAddress = (value?: string): string => {
  if (!value) return "";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const matchesUserFeedIdentity = (
  post: Post,
  identity: UserFeedIdentity,
): boolean => {
  const targetAddress = normalizeIdentityValue(identity.address);
  const targetId = normalizeIdentityValue(identity.id);
  const targetUsername = normalizeIdentityValue(identity.username);
  const targetDisplayName = normalizeIdentityValue(identity.displayName);
  const author = post.author || ({} as Post["author"]);

  const authorAddress = normalizeIdentityValue(author.address);
  const authorId = normalizeIdentityValue(author.id);
  const authorUsername = normalizeIdentityValue(author.username);
  const authorDisplayName = normalizeIdentityValue(author.displayName);

  if (
    targetAddress &&
    (authorAddress === targetAddress || authorId === targetAddress)
  ) {
    return true;
  }
  if (targetId && (authorId === targetId || authorAddress === targetId)) {
    return true;
  }
  if (targetUsername && authorUsername === targetUsername) {
    return true;
  }
  if (targetDisplayName && authorDisplayName === targetDisplayName) {
    return true;
  }

  return false;
};

const mergePostWithLocalState = (post: Post, localPost?: Post): Post => {
  if (!localPost) return post;

  const mergedVoteData =
    post.voteData || localPost.voteData
      ? {
          ...(post.voteData || {}),
          ...(localPost.voteData || {}),
          options: localPost.voteData?.options || post.voteData?.options || [],
        }
      : post.voteData;

  return {
    ...post,
    likes: typeof localPost.likes === "number" ? localPost.likes : post.likes,
    reposts:
      typeof localPost.reposts === "number" ? localPost.reposts : post.reposts,
    isLiked: localPost.isLiked ?? post.isLiked,
    isReposted: localPost.isReposted ?? post.isReposted,
    hasVoted: localPost.hasVoted ?? post.hasVoted,
    userVoteOption: localPost.userVoteOption ?? post.userVoteOption,
    voteData: mergedVoteData,
  };
};

const UserProfileScreen: React.FC<UserProfileScreenProps> = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t, currentLanguage } = useLocalization();
  const { theme } = useTheme();
  const { featureFlags } = useServerFeatureFlags();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Get user data from navigation params
  const { userId, userAddress, username, displayName, avatar, isVerified } =
    navigation.params || ({} as RouteParams);

  const feed = useSelector((state: RootState) => state.social.feed);
  const following = useSelector((state: RootState) => state.social.following);
  const currentUser = useSelector((state: RootState) => state.auth.wallet);
  const sessionType = useSelector((state: RootState) => state.auth.sessionType);
  const isGuestSession = sessionType === "guest";

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowUpdating, setIsFollowUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts">("posts");
  const [avatarFailures, setAvatarFailures] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    loadUserData();
  }, [userId, userAddress, username]);

  const buildMyVoteLookup = async (
    apiService: ApiService,
  ): Promise<VoteLookupMap> => {
    const voteLookup: VoteLookupMap = new Map();
    if (!currentUser?.address || isGuestSession) {
      return voteLookup;
    }

    try {
      const profileResponse = await apiService.getMyProfileWithVotingHistory();
      if (!profileResponse.success) {
        return voteLookup;
      }

      const recentVotes =
        profileResponse.data?.profile?.voteStats?.recentVotes ||
        profileResponse.data?.voteStats?.recentVotes ||
        [];
      if (!Array.isArray(recentVotes)) {
        return voteLookup;
      }

      recentVotes.forEach((vote: any) => {
        const targetPostId = String(
          vote?.postId || vote?.proposalId || "",
        ).trim();
        if (!targetPostId) return;
        const selectedOption =
          vote?.voteOption ?? vote?.voteType ?? "__voted__";
        voteLookup.set(targetPostId, selectedOption);
      });
    } catch (error) {
      console.warn("[UserProfileScreen] Failed to fetch my vote lookup", error);
    }

    return voteLookup;
  };

  const resolveUserPosts = async (
    apiService: ApiService,
    identity: UserFeedIdentity,
    voteLookup: VoteLookupMap,
  ): Promise<Post[]> => {
    const localById = new Map(feed.map((post) => [post.id, post]));
    const applyVoteLookup = (post: Post): Post => {
      const selectedOption = voteLookup.get(post.id);
      if (selectedOption === undefined) {
        return post;
      }

      return {
        ...post,
        hasVoted: true,
        userVoteOption: post.userVoteOption ?? selectedOption,
      };
    };

    try {
      const feedResult = await apiService.getPublicFeed(1, 100, "timestamp");
      if (feedResult.success && Array.isArray(feedResult.data)) {
        return feedResult.data
          .filter((post) => matchesUserFeedIdentity(post, identity))
          .map((post) => mergePostWithLocalState(post, localById.get(post.id)))
          .map((post) => applyVoteLookup(post));
      }
    } catch (error) {
      console.warn(
        "[UserProfileScreen] Failed to load dedicated user feed, fallback to store feed",
        error,
      );
    }

    return feed
      .filter((post) => matchesUserFeedIdentity(post, identity))
      .map((post) => mergePostWithLocalState(post, localById.get(post.id)))
      .map((post) => applyVoteLookup(post));
  };

  const loadUserData = async () => {
    console.log("[UserProfileScreen] Loading user data with params:", {
      userId,
      userAddress,
      username,
      displayName,
      avatar,
      isVerified,
    });
    setLoading(true);
    setUserProfile(null);
    setUserPosts([]);
    try {
      const apiService = ApiService.getInstance();
      const myVoteLookup = await buildMyVoteLookup(apiService);

      // Always load real user data from API when viewing other users' profiles
      // Demo mode only affects the current user's actions, not viewing other profiles
      if (userAddress) {
        console.log("Loading profile for address:", userAddress);
        const profileResult = await apiService.getUserProfile(userAddress);

        if (profileResult.success && profileResult.data) {
          console.log("Profile loaded from API:", profileResult.data);
          setUserProfile(profileResult.data);

          const posts = await resolveUserPosts(
            apiService,
            {
              id: userId,
              address: userAddress,
              username: username || profileResult.data.nickname,
              displayName: displayName || profileResult.data.nickname,
            },
            myVoteLookup,
          );
          setUserPosts(posts);

          // Check if following
          setIsFollowing(following.includes(userAddress));
          return;
        } else {
          console.log("API profile failed, falling back to feed data");
        }
      }

      // Fallback 1: Use passed navigation params
      if (userAddress || userId || username) {
        const profileData: UserProfile = {
          address: userAddress || "",
          nickname: displayName || username || t("userProfile.unknownUser"),
          isVerified: isVerified || false,
          avatar: avatar,
          bio: "",
          source: "params" as any,
          socialStats: {
            totalPosts: feed.filter((p) => p.author.address === userAddress)
              .length,
            totalFollowers: 0,
            totalFollowing: 0,
          },
        };

        setUserProfile(profileData);

        const posts = await resolveUserPosts(
          apiService,
          {
            id: userId,
            address: userAddress,
            username,
            displayName,
          },
          myVoteLookup,
        );
        setUserPosts(posts);

        // Check if following
        setIsFollowing(
          following.includes(userId || "") ||
            following.includes(userAddress || "") ||
            following.includes(username || ""),
        );
        return;
      }

      // Fallback 2: Find user profile from posts in feed
      const userFromPosts = feed.find(
        (post) =>
          post.author.id === userId ||
          post.author.address === userAddress ||
          post.author.username === username,
      )?.author;

      if (userFromPosts) {
        // Convert User to UserProfile format
        const profileData: UserProfile = {
          address: userFromPosts.address || "",
          nickname: userFromPosts.displayName || userFromPosts.username || "",
          isVerified: userFromPosts.isVerified || false,
          avatar: userFromPosts.avatar,
          bio: "",
          source: "feed" as any,
          socialStats: {
            totalPosts: feed.filter(
              (p) => p.author.address === userFromPosts.address,
            ).length,
            totalFollowers: 0,
            totalFollowing: 0,
          },
        };

        setUserProfile(profileData);

        const posts = await resolveUserPosts(
          apiService,
          {
            id: userFromPosts.id,
            address: userFromPosts.address,
            username: userFromPosts.username,
            displayName: userFromPosts.displayName,
          },
          myVoteLookup,
        );
        setUserPosts(posts);

        // Check if following
        setIsFollowing(
          following.includes(userFromPosts.id || "") ||
            following.includes(userFromPosts.username || ""),
        );
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleFollow = async () => {
    if (!userProfile?.address) {
      Toast.error(t("userProfile.userAddressNotFound"));
      return;
    }

    if (!currentUser?.address) {
      Toast.error(t("userProfile.connectWallet"));
      return;
    }

    if (
      currentUser.address.toLowerCase() === userProfile.address.toLowerCase()
    ) {
      Toast.info(t("userProfile.cannotFollowSelf"));
      return;
    }

    const nextIsFollowing = !isFollowing;
    setIsFollowUpdating(true);
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.followUser(
        userProfile.address,
        nextIsFollowing,
      );
      if (!result.success) {
        throw new Error(result.error || t("userProfile.followFailed"));
      }

      setIsFollowing(nextIsFollowing);
      if (nextIsFollowing) {
        dispatch(followUserAction(userProfile.address));
      } else {
        dispatch(unfollowUserAction(userProfile.address));
      }
      Toast.success(
        nextIsFollowing
          ? t("userProfile.followed")
          : t("userProfile.unfollowed"),
      );
    } catch (error: any) {
      Toast.error(error.message || t("userProfile.followFailed"));
    } finally {
      setIsFollowUpdating(false);
    }
  };

  const handleBack = () => {
    navigation.navigate("Feed");
  };

  const openPost = (post: Post) => {
    navigation.navigate("PostDetail", { postId: post.id });
  };

  const handleLike = async (postId: string) => {
    if (isGuestSession) {
      Toast.info(t("feed.signInToReact"));
      navigation.navigate("Auth");
      return;
    }

    const target = userPosts.find((post) => post.id === postId);
    const currentValue = !!target?.isLiked;
    const nextValue = !currentValue;

    setUserPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: nextValue,
              likes: Math.max(
                0,
                Number(post.likes || 0) + (nextValue ? 1 : -1),
              ),
            }
          : post,
      ),
    );

    try {
      const payload = await dispatch(
        toggleReactionAsync({
          postId,
          reactionType: "like",
          currentValue,
        }) as any,
      ).unwrap();

      setUserPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: payload.likes,
                reposts: payload.reposts,
                isLiked: payload.isLiked,
                isReposted: payload.isReposted,
              }
            : post,
        ),
      );
    } catch {
      setUserPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: currentValue,
                likes: Math.max(
                  0,
                  Number(post.likes || 0) + (currentValue ? 1 : -1),
                ),
              }
            : post,
        ),
      );
      Toast.error(t("postDetail.likeFailed"));
    }
  };

  const handleRepost = async (postId: string) => {
    if (isGuestSession) {
      Toast.info(t("feed.signInToRepost"));
      navigation.navigate("Auth");
      return;
    }

    const target = userPosts.find((post) => post.id === postId);
    const currentValue = !!target?.isReposted;
    const nextValue = !currentValue;

    setUserPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              isReposted: nextValue,
              reposts: Math.max(
                0,
                Number(post.reposts || 0) + (nextValue ? 1 : -1),
              ),
            }
          : post,
      ),
    );

    try {
      const payload = await dispatch(
        toggleReactionAsync({
          postId,
          reactionType: "repost",
          currentValue,
        }) as any,
      ).unwrap();

      setUserPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: payload.likes,
                reposts: payload.reposts,
                isLiked: payload.isLiked,
                isReposted: payload.isReposted,
              }
            : post,
        ),
      );
      Toast.success(nextValue ? t("feed.reposted") : t("feed.repostRemoved"));
    } catch {
      setUserPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isReposted: currentValue,
                reposts: Math.max(
                  0,
                  Number(post.reposts || 0) + (currentValue ? 1 : -1),
                ),
              }
            : post,
        ),
      );
      Toast.error(t("postDetail.repostFailed"));
    }
  };

  const handleShare = async (post: Post) => {
    try {
      const shareUrl = buildPostShareUrl(post.id);
      const displayContent = getPostDisplayContent(post, currentLanguage);
      const shortContent =
        displayContent.length > 120
          ? `${displayContent.slice(0, 120)}...`
          : displayContent;
      const authorLabel = getPostAuthorPresentation(post, t).displayName;

      const result = await Share.share({
        message: `${authorLabel}: "${shortContent}" ${shareUrl}`,
        url: shareUrl,
        title: t("postDetail.shareTitle"),
      });

      if (result.action === Share.sharedAction) {
        Toast.success(t("postDetail.shared"));
      }
    } catch {
      Toast.error(t("postDetail.shareFailed"));
    }
  };

  const renderPostAvatar = (post: Post) => {
    const key = post.id;
    const hasFailed = !!avatarFailures[key];
    const authorPresentation = getPostAuthorPresentation(post, t);
    const avatarUri = authorPresentation.avatar;

    if (avatarUri && !hasFailed) {
      return (
        <Image
          source={{ uri: avatarUri }}
          style={styles.postAvatar}
          onError={() => {
            setAvatarFailures((prev) => ({ ...prev, [key]: true }));
          }}
        />
      );
    }

    const fallbackText = (authorPresentation.displayName || "U")
      .charAt(0)
      .toUpperCase();
    return (
      <View style={styles.postAvatarFallback}>
        <Text style={styles.postAvatarFallbackText}>{fallbackText}</Text>
      </View>
    );
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
              <Icon
                name="person"
                size={40}
                color={theme.textSecondary}
                variant="filled"
              />
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
              {userProfile.address.slice(0, 6)}...
              {userProfile.address.slice(-4)}
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
            <Text style={styles.statLabel}>{t("userProfile.posts")}</Text>
          </View>
        </View>

        {currentUser?.address &&
          currentUser.address.toLowerCase() !==
            userProfile.address.toLowerCase() && (
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followingButton,
              ]}
              onPress={handleFollow}
              disabled={isFollowUpdating}
            >
              {isFollowUpdating ? (
                <ActivityIndicator
                  size="small"
                  color={isFollowing ? theme.text : theme.background}
                />
              ) : (
                <Text
                  style={[
                    styles.followButtonText,
                    isFollowing && styles.followingButtonText,
                  ]}
                >
                  {isFollowing
                    ? t("userProfile.following")
                    : t("userProfile.follow")}
                </Text>
              )}
            </TouchableOpacity>
          )}
      </View>
    );
  };

  const renderTabs = () => {
    return (
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "posts" && styles.activeTab]}
          onPress={() => setActiveTab("posts")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "posts" && styles.activeTabText,
            ]}
          >
            {t("userProfile.posts")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPost = ({ item: post }: { item: Post }) => {
    const authorPresentation = getPostAuthorPresentation(post, t);
    const displayContent = getPostDisplayContent(post, currentLanguage);
    const timestamp = formatTimestamp(post.timestamp || post.createdAt);
    const resolvedReplies = (() => {
      const repliesValue = Number((post as any)?.replies);
      if (Number.isFinite(repliesValue) && repliesValue >= 0) {
        return repliesValue;
      }
      const commentsValue = Number((post as any)?.comments);
      if (Number.isFinite(commentsValue) && commentsValue >= 0) {
        return commentsValue;
      }
      return 0;
    })();
    const hasVotingOptions =
      Array.isArray(post.voteData?.options) && post.voteData.options.length > 0;
    const lotteryConfig = post.lottery || (post.voteData as any)?.lottery;
    const lotteryContractAddress = (
      post.lotteryAddress ||
      lotteryConfig?.contractAddress ||
      ""
    )
      .toString()
      .trim();
    const hasLotteryInfo =
      featureFlags.lotteryEnabled &&
      Boolean(lotteryConfig?.enabled || lotteryContractAddress);
    const isPendingModeration =
      post.isPendingModeration ||
      post.isPending ||
      post.status === "pending_review" ||
      post.moderationStatus?.status === "pending_moderation" ||
      post.moderationStatus?.status === "pending_review";

    return (
      <TouchableOpacity
        style={styles.postCard}
        activeOpacity={0.94}
        onPress={() => openPost(post)}
      >
        <View style={styles.postAvatarColumn}>{renderPostAvatar(post)}</View>
        <View style={styles.postBody}>
          <View style={styles.postHeaderRow}>
            <View style={styles.postIdentityRow}>
              <Text style={styles.postDisplayName} numberOfLines={1}>
                {authorPresentation.displayName}
              </Text>
              {authorPresentation.showVerified && (
                <Icon
                  name="checkmark"
                  variant="filled"
                  size={14}
                  color={theme.primary}
                  style={styles.postVerifiedBadge}
                />
              )}
              {authorPresentation.username ? (
                <Text style={styles.postUsername} numberOfLines={1}>
                  @{authorPresentation.username}
                </Text>
              ) : null}
              {timestamp ? (
                <Text style={styles.postTimestamp}>· {timestamp}</Text>
              ) : null}
              {isPendingModeration ? (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingPillText}>
                    {t("profile.pendingModeration")}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={styles.postText}>{displayContent}</Text>

          {hasVotingOptions ? (
            <View style={styles.votingWrap}>
              <VotingCard
                postId={post.id}
                voteData={post.voteData}
                allowedCountries={post.allowedCountries}
                minAgeRange={post.minAgeRange}
                requiresVerification={post.requiresVerification}
                eligibilityRoot={post.eligibilityRoot}
                hasVoted={post.hasVoted}
                userVote={post.userVoteOption}
                disabled={isPendingModeration}
                guestMessage={
                  isPendingModeration
                    ? "Voting opens after moderation approval"
                    : undefined
                }
                proposalContent={displayContent}
              />
            </View>
          ) : null}

          {hasLotteryInfo ? (
            <TouchableOpacity
              style={styles.lotteryRow}
              onPress={() => openPost(post)}
              activeOpacity={0.85}
            >
              <Icon
                name="sparkles"
                size={14}
                color={theme.primary}
                variant="filled"
              />
              <Text style={styles.lotteryText} numberOfLines={1}>
                {t("postDetail.lottery")} •{" "}
                {lotteryContractAddress
                  ? `${t("postDetail.contract")}: ${truncateAddress(lotteryContractAddress)}`
                  : t("postDetail.pendingDeploy")}
              </Text>
              <Icon
                name="chevron-right"
                size={12}
                color={theme.textSecondary}
                variant="outline"
              />
            </TouchableOpacity>
          ) : null}

          <PostActionBar
            replies={resolvedReplies}
            reposts={post.reposts}
            likes={post.likes}
            isLiked={post.isLiked}
            isReposted={post.isReposted}
            showReply={featureFlags.commentsEnabled}
            disabled={isPendingModeration}
            onReply={() => openPost(post)}
            onRepost={() => handleRepost(post.id)}
            onLike={() => handleLike(post.id)}
            onShare={() => handleShare(post)}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const listData =
    activeTab === "posts"
      ? userPosts
      : userPosts.filter((post) => !!post.voteData);
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>
        {activeTab === "posts" ? "📝" : "🗳️"}
      </Text>
      <Text style={styles.emptyTitle}>
        {activeTab === "posts"
          ? t("userProfile.noPosts")
          : t("userProfile.noVotingActivity")}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "posts"
          ? t("userProfile.noPostsSubtitle")
          : t("userProfile.noVotingSubtitle")}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t("userProfile.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{t("userProfile.notFound")}</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>{t("userProfile.goBack")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon
            name="arrow-back"
            variant="outline"
            size={24}
            color={theme.text}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userProfile.nickname}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        style={styles.scrollView}
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={
          <>
            {renderUserHeader()}
            {renderTabs()}
          </>
        }
        ListEmptyComponent={renderEmptyState}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      textAlign: "center",
      marginRight: 40, // Account for back button
    },
    headerSpacer: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 120,
      flexGrow: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 16,
      fontSize: 14,
      color: theme.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 16,
    },
    backButtonText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "600",
    },
    headerContainer: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    profileHeader: {
      flexDirection: "row",
      marginBottom: 16,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginRight: 16,
      backgroundColor: theme.border,
    },
    avatarPlaceholder: {
      justifyContent: "center",
      alignItems: "center",
    },
    profileInfo: {
      flex: 1,
      justifyContent: "center",
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    displayName: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    verifiedIcon: {
      fontSize: 18,
      color: theme.primary,
      marginLeft: 4,
    },
    username: {
      fontSize: 15,
      color: theme.textSecondary,
      marginTop: 2,
    },
    address: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
      fontFamily: monoFontFamily,
    },
    bio: {
      fontSize: 15,
      color: theme.text,
      marginTop: 8,
      lineHeight: 20,
    },
    location: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
    },
    statsContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 16,
    },
    stat: {
      alignItems: "center",
    },
    statValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    statLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    followButton: {
      backgroundColor: theme.primary,
      borderRadius: 9999,
      paddingVertical: 8,
      paddingHorizontal: 24,
      alignSelf: "center",
    },
    followingButton: {
      backgroundColor: theme.border,
      borderWidth: 1,
      borderColor: theme.border,
    },
    followButtonText: {
      color: theme.onPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    followingButtonText: {
      color: theme.text,
    },
    tabsContainer: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    activeTab: {
      borderBottomColor: theme.primary,
    },
    tabText: {
      fontSize: 15,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    activeTabText: {
      color: theme.text,
      fontWeight: "700",
    },
    postCard: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    postAvatarColumn: {
      marginRight: 12,
    },
    postAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surface,
    },
    postAvatarFallback: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    postAvatarFallbackText: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: "700",
    },
    postBody: {
      flex: 1,
    },
    postHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    postIdentityRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      paddingRight: 8,
    },
    postDisplayName: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
      maxWidth: 160,
    },
    postVerifiedBadge: {
      marginHorizontal: 4,
    },
    postUsername: {
      fontSize: 15,
      color: theme.textSecondary,
      marginLeft: 4,
    },
    postTimestamp: {
      fontSize: 15,
      color: theme.textSecondary,
      marginLeft: 4,
    },
    pendingPill: {
      marginLeft: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 9999,
      backgroundColor: "rgba(255, 193, 7, 0.18)",
    },
    pendingPillText: {
      fontSize: 11,
      color: theme.warning || "#A56A00",
      fontWeight: "700",
      textTransform: "uppercase",
    },
    postText: {
      fontSize: 15,
      lineHeight: 20,
      color: theme.text,
      marginTop: 2,
      marginBottom: 8,
    },
    votingWrap: {
      marginBottom: 8,
    },
    lotteryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      backgroundColor: theme.surface,
      paddingHorizontal: 8,
      paddingVertical: 6,
      marginBottom: 8,
    },
    lotteryText: {
      fontSize: 12,
      color: theme.textSecondary,
      flex: 1,
    },
    emptyContainer: {
      alignItems: "center",
      padding: 40,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
    },
  });

export default UserProfileScreen;
