import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  GestureResponderEvent,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { fetchFeed, toggleReactionAsync } from "../store/socialSlice";
import ApiService from "../services/ApiService";
import { WalletService } from "../services/WalletService";
import { useNavigation } from "../contexts/NavigationContext";
import Layout from "../components/Layout";
import Logo from "../components/Logo";
import Icon from "../components/Icon";
import PostFeedCard from "../components/PostFeedCard";
import Toast from "../utils/Toast";
import { useLocalization } from "../hooks/useLocalization";
import { useServerFeatureFlags } from "../hooks/useServerFeatureFlags";
import { buildPostShareUrl } from "../utils/shareLinks";
import { getPostDisplayContent } from "../utils/localizedPost";
import { getPostAuthorPresentation } from "../utils/anonymousPost";
import { Post } from "../types";
import { useTheme } from "../contexts/ThemeContext";
import {
  hairlineWidth,
  hitSlop10,
  radii,
  spacing,
  typography,
} from "../styles/tokens";
import ScreenState from "../components/ui/ScreenState";

type FeedTab = "proposals" | "trending";
const POST_MENU_WIDTH = 220;
const POST_MENU_OFFSET = 8;

const FeedScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t, currentLanguage } = useLocalization();
  const { featureFlags } = useServerFeatureFlags();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const windowDimensions = useWindowDimensions();

  const feed = useSelector((state: RootState) => state.social.feed);
  const isLoading = useSelector((state: RootState) => state.social.isLoading);
  const error = useSelector((state: RootState) => state.social.error);
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  const sessionType = useSelector((state: RootState) => state.auth.sessionType);
  const wallet = useSelector((state: RootState) => state.auth.wallet);

  const isGuestSession = sessionType === "guest";
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const screenOpacity = useRef(new Animated.Value(0)).current;

  const lastInitWalletRef = useRef<string | null>("__uninitialized__");
  const hasFetchedInitialRef = useRef(false);
  const hasFetchedAfterLoginRef = useRef(false);

  const safeFeed = Array.isArray(feed) ? feed : [];

  const isPendingModerationPost = useCallback((post: Post) => {
    return !!(
      post?.isPendingModeration ||
      post?.isPending ||
      post?.status === "pending_review" ||
      post?.moderationStatus?.status === "pending_moderation" ||
      post?.moderationStatus?.status === "pending_review"
    );
  }, []);

  const filteredFeed = useMemo(() => {
    const publicFeed = safeFeed.filter(
      (post) => !isPendingModerationPost(post),
    );

    if (activeTab === "proposals") {
      // "New" must show all posts, including regular non-voting posts.
      return publicFeed;
    }
    return publicFeed;
  }, [activeTab, safeFeed, isPendingModerationPost]);

  const loadFeed = useCallback(
    async (isPullToRefresh = false) => {
      if (isPullToRefresh) {
        setRefreshing(true);
      }

      try {
        const sort = activeTab === "trending" ? "votes" : "timestamp";
        await dispatch(fetchFeed({ sort } as any) as any);
      } finally {
        if (isPullToRefresh) {
          setRefreshing(false);
        }
      }
    },
    [activeTab, dispatch],
  );

  useEffect(() => {
    const init = async () => {
      try {
        const walletService = WalletService.getInstance();
        const currentWallet = walletService.getCurrentWallet();
        const addr = (wallet?.address || currentWallet?.address) ?? null;

        if (lastInitWalletRef.current === addr) {
          return;
        }

        lastInitWalletRef.current = addr;

        if (addr && Platform.OS !== "web" && currentWallet) {
          await ApiService.getInstance().initialize(currentWallet);
        } else {
          await ApiService.getInstance().initialize(null);
        }
      } catch (initError) {
        console.warn("[FeedScreen] ApiService init failed:", initError);
      }
    };

    init();
  }, [wallet]);

  useEffect(() => {
    if (hasFetchedInitialRef.current) return;
    hasFetchedInitialRef.current = true;
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!hasFetchedInitialRef.current) return;
    loadFeed();
  }, [activeTab, loadFeed]);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  useEffect(() => {
    if (
      navigation.currentScreen === "Feed" &&
      isAuthenticated &&
      sessionType !== "guest" &&
      !hasFetchedAfterLoginRef.current
    ) {
      hasFetchedAfterLoginRef.current = true;
      loadFeed();
    }
  }, [navigation.currentScreen, isAuthenticated, sessionType, loadFeed]);

  const openUserProfile = (author: Post["author"]) => {
    if (!author) {
      return;
    }

    const authorAddress = author.address || author.id;

    navigation.navigate("UserProfile", {
      userId: author.id,
      userAddress: authorAddress,
      username: author.username || author.displayName || "",
      displayName: author.displayName || author.username || "",
      avatar: author.avatar,
      isVerified: author.isVerified,
    });
  };

  const openPost = (post: Post) => {
    navigation.navigate("PostDetail", { postId: post.id });
  };

  const openPostMenu = (post: Post, event?: GestureResponderEvent) => {
    const pageX = Number(event?.nativeEvent?.pageX || 0);
    const pageY = Number(event?.nativeEvent?.pageY || 0);
    setMenuPost(post);
    setMenuAnchor(
      pageX > 0 && pageY > 0
        ? {
            x: pageX,
            y: pageY,
          }
        : null,
    );
    setShowPostMenu(true);
  };

  const closePostMenu = () => {
    setShowPostMenu(false);
    setMenuPost(null);
    setMenuAnchor(null);
  };

  const menuPosition = useMemo(() => {
    const horizontalPadding = spacing.s;
    const topFallback = Platform.OS === "ios" ? 64 : 54;
    const preferredLeft =
      (menuAnchor?.x || windowDimensions.width - horizontalPadding) -
      POST_MENU_WIDTH +
      24;
    const boundedLeft = Math.max(
      horizontalPadding,
      Math.min(
        preferredLeft,
        windowDimensions.width - POST_MENU_WIDTH - horizontalPadding,
      ),
    );

    return {
      top: Math.max(
        topFallback,
        (menuAnchor?.y || topFallback) + POST_MENU_OFFSET,
      ),
      left: boundedLeft,
    };
  }, [menuAnchor, windowDimensions.width]);

  const handleLike = (postId: string) => {
    if (isGuestSession) {
      Toast.info(t("feed.signInToReact"));
      navigation.navigate("Auth");
      return;
    }

    const target = safeFeed.find((post) => post.id === postId);
    dispatch(
      toggleReactionAsync({
        postId,
        reactionType: "like",
        currentValue: !!target?.isLiked,
      }) as any,
    );
  };

  const handleRepost = (postId: string) => {
    if (isGuestSession) {
      Toast.info(t("feed.signInToRepost"));
      navigation.navigate("Auth");
      return;
    }

    const target = safeFeed.find((post) => post.id === postId);
    const nextValue = !target?.isReposted;
    dispatch(
      toggleReactionAsync({
        postId,
        reactionType: "repost",
        currentValue: !!target?.isReposted,
      }) as any,
    );
    Toast.success(nextValue ? t("feed.reposted") : t("feed.repostRemoved"));
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
    } catch (shareError) {
      console.error("Share error:", shareError);
      Toast.error(t("postDetail.shareFailed"));
    }
  };

  const renderPostItem = ({ item }: { item: Post }) => {
    return (
      <PostFeedCard
        post={item}
        lotterySummaryMode="details"
        lotteryVisible={featureFlags.lotteryEnabled}
        commentsVisible={featureFlags.commentsEnabled}
        onPress={() => openPost(item)}
        onAuthorPress={() => openUserProfile(item.author)}
        onMenuPress={(event) => openPostMenu(item, event)}
        onLotteryPress={() => openPost(item)}
        onReply={() => openPost(item)}
        onRepost={() => handleRepost(item.id)}
        onLike={() => handleLike(item.id)}
        onShare={() => handleShare(item)}
      />
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return <ScreenState type="loading" title={t("feed.loadingPosts")} />;
    }

    if (error) {
      return (
        <ScreenState
          type="error"
          title={t("feed.failedToLoad")}
          subtitle={t("feed.unableToRefresh")}
        />
      );
    }

    return (
      <ScreenState
        type="empty"
        title={
          activeTab === "trending"
            ? t("feed.noTrendingYet")
            : t("feed.noProposalsYet")
        }
        subtitle={t("feed.postsAppearSoon")}
      />
    );
  };

  const content = (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {Platform.OS !== "web" ? (
        <View style={styles.mobileHeader}>
          <Logo size="small" color="primary" />
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => navigation.navigate("Settings")}
            hitSlop={hitSlop10}
          >
            <Icon
              name="settings-outline"
              size={22}
              color={theme.primary}
              variant="outline"
            />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.feedTabsContainer}>
        <TouchableOpacity
          style={[
            styles.feedTab,
            activeTab === "proposals" && styles.feedTabActive,
          ]}
          onPress={() => setActiveTab("proposals")}
          accessibilityRole="tab"
          accessibilityLabel={t("feed.new")}
          accessibilityState={{ selected: activeTab === "proposals" }}
        >
          <Text
            style={[
              styles.feedTabText,
              activeTab === "proposals" && styles.feedTabTextActive,
            ]}
          >
            {t("feed.new")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.feedTab,
            activeTab === "trending" && styles.feedTabActive,
          ]}
          onPress={() => setActiveTab("trending")}
          accessibilityRole="tab"
          accessibilityLabel={t("feed.trending")}
          accessibilityState={{ selected: activeTab === "trending" }}
        >
          <Text
            style={[
              styles.feedTabText,
              activeTab === "trending" && styles.feedTabTextActive,
            ]}
          >
            {t("feed.trending")}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.feedList}
        data={filteredFeed}
        keyExtractor={(item) => item.id}
        renderItem={renderPostItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadFeed(true)}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={
          filteredFeed.length === 0
            ? styles.emptyListContainer
            : styles.listContainer
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
      />

      <Modal
        visible={showPostMenu}
        transparent
        animationType="fade"
        onRequestClose={closePostMenu}
      >
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closePostMenu}
          />
          <View
            style={[
              styles.menuCard,
              {
                top: menuPosition.top,
                left: menuPosition.left,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                const target = menuPost;
                closePostMenu();
                if (target) {
                  openPost(target);
                }
              }}
            >
              <Icon
                name="chevron-forward"
                size={16}
                color={theme.text}
                variant="outline"
              />
              <Text style={styles.menuItemText}>{t("common.readMore")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                const target = menuPost;
                closePostMenu();
                if (target) {
                  handleShare(target);
                }
              }}
            >
              <Icon
                name="share"
                size={16}
                color={theme.text}
                variant="outline"
              />
              <Text style={styles.menuItemText}>
                {t("postDetail.menuShare")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={closePostMenu}>
              <Icon
                name="close"
                size={16}
                color={theme.textSecondary}
                variant="outline"
              />
              <Text style={styles.menuItemText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {Platform.OS !== "web" && !isGuestSession ? (
        <TouchableOpacity
          style={styles.composeFab}
          onPress={() => navigation.navigate("PostCreate")}
          hitSlop={hitSlop10}
          accessibilityRole="button"
          accessibilityLabel={t("feed.createPostA11y")}
        >
          <Icon name="add" variant="filled" size={24} color={theme.onPrimary} />
        </TouchableOpacity>
      ) : null}

      {Platform.OS !== "web" && isGuestSession ? (
        <TouchableOpacity
          style={styles.guestFab}
          onPress={() => navigation.navigate("Auth")}
          hitSlop={hitSlop10}
          accessibilityRole="button"
          accessibilityLabel={t("auth.signIn")}
        >
          <Icon
            name="person"
            variant="filled"
            size={18}
            color={theme.onPrimary}
          />
          <Text style={styles.guestFabText}>{t("auth.signIn")}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );

  if (Platform.OS === "web") {
    return (
      <Layout navigation={navigation} currentScreen="Feed">
        {content}
      </Layout>
    );
  }

  return <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>;
};

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    mobileHeader: {
      backgroundColor: theme.headerBackground,
      borderBottomColor: theme.border,
      borderBottomWidth: hairlineWidth,
      paddingHorizontal: spacing.l,
      paddingVertical: spacing.m,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerIconButton: {
      height: 36,
      width: 36,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    feedTabsContainer: {
      flexDirection: "row",
      backgroundColor: theme.headerBackground,
      borderBottomColor: theme.border,
      borderBottomWidth: hairlineWidth,
    },
    feedTab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.m,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    feedTabActive: {
      borderBottomColor: theme.primary,
    },
    feedTabText: {
      ...typography.body,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    feedTabTextActive: {
      color: theme.text,
      fontWeight: "700",
    },
    feedList: {
      flex: 1,
      backgroundColor: theme.background,
    },
    listContainer: {
      paddingBottom: 112,
    },
    emptyListContainer: {
      flexGrow: 1,
      paddingBottom: 112,
    },
    postCard: {
      flexDirection: "row",
      paddingHorizontal: spacing.l,
      paddingVertical: 10,
      borderBottomWidth: hairlineWidth,
      borderBottomColor: theme.divider,
      backgroundColor: theme.background,
    },
    avatarColumn: {
      marginRight: spacing.s,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surface,
    },
    avatarFallback: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarFallbackText: {
      ...typography.bodyStrong,
      color: theme.textSecondary,
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
      paddingRight: spacing.s,
    },
    displayName: {
      ...typography.bodyStrong,
      color: theme.text,
      maxWidth: 140,
    },
    verifiedBadge: {
      marginHorizontal: spacing.xs,
    },
    usernameButton: {
      marginLeft: spacing.xs,
    },
    username: {
      ...typography.body,
      color: theme.textSecondary,
    },
    timestamp: {
      ...typography.body,
      color: theme.textSecondary,
      marginLeft: spacing.xs,
    },
    pendingPill: {
      marginLeft: spacing.s,
      paddingHorizontal: spacing.s,
      paddingVertical: 2,
      borderRadius: radii.pill,
      backgroundColor: "rgba(255, 193, 7, 0.18)",
    },
    pendingPillText: {
      ...typography.small,
      color: theme.warning || "#A56A00",
      fontWeight: "700",
      textTransform: "uppercase",
    },
    moreButton: {
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    postContent: {
      ...typography.body,
      color: theme.text,
      marginTop: 2,
      marginBottom: spacing.s,
    },
    votingWrap: {
      marginBottom: spacing.s,
    },
    lotteryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      borderRadius: radii.s,
      backgroundColor: theme.surface,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.xs,
      marginBottom: spacing.s,
    },
    lotteryText: {
      ...typography.caption,
      color: theme.textSecondary,
      flex: 1,
    },
    composeFab: {
      position: "absolute",
      right: spacing.l,
      bottom: spacing.l,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.text,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    guestFab: {
      position: "absolute",
      right: spacing.l,
      bottom: spacing.l,
      borderRadius: radii.pill,
      backgroundColor: theme.primary,
      paddingHorizontal: spacing.l,
      paddingVertical: spacing.s,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: theme.text,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    guestFabText: {
      ...typography.caption,
      color: theme.onPrimary,
      marginLeft: spacing.xs,
      fontWeight: "700",
    },
    menuOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    menuCard: {
      position: "absolute",
      width: POST_MENU_WIDTH,
      backgroundColor: theme.card,
      borderRadius: radii.m,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      paddingVertical: spacing.xs,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
    },
    menuItemText: {
      ...typography.body,
      color: theme.text,
    },
  });

export default FeedScreen;
