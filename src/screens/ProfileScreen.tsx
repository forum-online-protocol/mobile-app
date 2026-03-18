import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  SafeAreaView,
  Share,
  Linking,
  Alert,
  TextInput,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from "../contexts/NavigationContext";
import { RootState } from "../store";
import { logout } from "../store/authSlice";
import { resetWalletState } from "../store/walletSlice";
import { resetSocialState, toggleReactionAsync } from "../store/socialSlice";
import { WalletService } from "../services/WalletService";
import StorageService from "../services/StorageService";
import AsyncStorageService from "../services/AsyncStorageService";
import ApiService from "../services/ApiService";
import { Post } from "../types";
import PostFeedCard from "../components/PostFeedCard";
import Toast from "../utils/Toast";
import { useLocalization } from "../hooks/useLocalization";
import { useServerFeatureFlags } from "../hooks/useServerFeatureFlags";
import { buildPostShareUrl, buildProfileShareUrl } from "../utils/shareLinks";
import { getPostAuthorPresentation } from "../utils/anonymousPost";
import { getPostDisplayContent } from "../utils/localizedPost";
import { openExternalUrl } from "../utils/openExternalUrl";
import { useTheme } from "../contexts/ThemeContext";
import { monoFontFamily } from "../styles/tokens";

import Icon from "../components/Icon";

type ProfileListItem =
  | { kind: "profile"; id: string }
  | { kind: "post"; id: string; post: Post }
  | { kind: "vote"; id: string; vote: any };

const formatDateTime = (value?: string | number | Date) => {
  if (!value) return "";
  const date =
    typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const truncateMiddle = (
  value?: string,
  left: number = 10,
  right: number = 8,
) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= left + right + 3) return normalized;
  return `${normalized.slice(0, left)}...${normalized.slice(-right)}`;
};

const estimateBase64ByteSize = (value: string): number => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "");
  if (!normalized) return 0;
  const padding = normalized.endsWith("==")
    ? 2
    : normalized.endsWith("=")
      ? 1
      : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
};

const normalizeProfileUsername = (value?: string): string => {
  const normalized = String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (/^[a-z0-9_.]{3,32}$/.test(normalized)) {
    return normalized;
  }

  return "";
};

const buildLocalProfileIdentity = (
  firstName: string,
  lastName: string,
  walletAddress?: string,
): { username: string; displayName: string } => {
  const normalizedFirstName = String(firstName || "").trim();
  const normalizedLastName = String(lastName || "").trim();
  const joinedDisplayName = [normalizedFirstName, normalizedLastName]
    .filter(Boolean)
    .join("_")
    .trim();
  const fallbackUsername =
    normalizeProfileUsername(joinedDisplayName) ||
    (walletAddress
      ? `user_${walletAddress.slice(2, 8).toLowerCase()}`
      : "user");

  return {
    username: fallbackUsername,
    displayName: joinedDisplayName || fallbackUsername,
  };
};

const CURRENT_PROFILE_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const getLaunchImageLibrary = (): ((options: any) => Promise<any>) | null => {
  try {
    const imagePickerModule = require("react-native-image-picker");
    const launchImageLibrary = imagePickerModule?.launchImageLibrary;
    return typeof launchImageLibrary === "function" ? launchImageLibrary : null;
  } catch (error) {
    console.warn("[ProfileScreen] Image picker module unavailable:", error);
    return null;
  }
};

const isInitiativePost = (post: Post | null | undefined): boolean => {
  if (!post) return false;
  return (
    post.type === "proposal" ||
    (post as any).postType === "proposal" ||
    Array.isArray(post.voteData?.options)
  );
};

const ProfileScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t, currentLanguage } = useLocalization();
  const { featureFlags } = useServerFeatureFlags();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { passportData, wallet, isAuthenticated } = useSelector(
    (state: RootState) => state.auth,
  );

  // Check if this is a demo account
  const firstName =
    passportData?.personalData?.firstName || passportData?.firstName || "Guest";
  const lastName =
    passportData?.personalData?.lastName || passportData?.lastName || "User";
  const localProfileIdentity = useMemo(
    () => buildLocalProfileIdentity(firstName, lastName, wallet?.address),
    [firstName, lastName, wallet?.address],
  );
  const isDemoAccount =
    (passportData as any)?.isDemoAccount === true || firstName === "Demo";
  const feed = useSelector((state: RootState) => state.social.feed);
  const derivedMyPosts = useMemo(() => {
    const normalizedWalletAddress = String(wallet?.address || "")
      .trim()
      .toLowerCase();
    if (!normalizedWalletAddress) {
      return [];
    }

    return (Array.isArray(feed) ? feed : []).filter((post) => {
      if (!isInitiativePost(post)) {
        return false;
      }

      const authorAddress = String(
        post.author?.address || post.author?.id || "",
      )
        .trim()
        .toLowerCase();

      return authorAddress === normalizedWalletAddress;
    });
  }, [feed, wallet?.address]);
  const [balance, setBalance] = useState("0");
  const [identityHash, setIdentityHash] = useState("");
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [myVotes, setMyVotes] = useState<any[]>([]);
  const [voteStats, setVoteStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "posts" | "votes">(
    "profile",
  );
  const [refreshing, setRefreshing] = useState(false);
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [profileUsername, setProfileUsername] = useState(
    localProfileIdentity.username,
  );
  const [profileDisplayName, setProfileDisplayName] = useState(
    localProfileIdentity.displayName,
  );
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const walletService = WalletService.getInstance();
  const storageService = StorageService.getInstance();
  const loadRequestIdRef = useRef(0);

  const ensureApiWalletInitialized = async () => {
    const apiService = ApiService.getInstance();
    if (wallet) {
      try {
        await apiService.initialize(wallet);
      } catch (initError) {
        console.warn("[ProfileScreen] ApiService init failed:", initError);
      }
    }
    return apiService;
  };

  useEffect(() => {
    loadUserData();
  }, [wallet]);

  useEffect(() => {
    setMyPosts(derivedMyPosts);
  }, [derivedMyPosts]);

  useEffect(() => {
    setProfileUsername((current) => {
      const normalizedCurrent = normalizeProfileUsername(current);
      return normalizedCurrent || localProfileIdentity.username;
    });
    setProfileDisplayName((current) => {
      const normalizedCurrent = String(current || "").trim();
      return normalizedCurrent || localProfileIdentity.displayName;
    });
  }, [localProfileIdentity.displayName, localProfileIdentity.username]);

  const applyCurrentProfileResponse = (
    profileResponse: {
      success: boolean;
      data?: any;
      fromCache?: boolean;
    },
    requestId: number,
  ): boolean => {
    if (loadRequestIdRef.current !== requestId) {
      return false;
    }

    if (!profileResponse.success || !profileResponse.data?.profile) {
      return false;
    }

    const profile = profileResponse.data.profile;
    const metadata = profile?.metadata || {};
    const effectiveMetadata = metadata.pending || metadata.approved || null;
    const nextUsername = normalizeProfileUsername(
      String(
        effectiveMetadata?.username ||
          profile.username ||
          profile.nickname ||
          "",
      ),
    );
    const nextDisplayName = String(
      effectiveMetadata?.displayName ||
        profile.displayName ||
        profile.nickname ||
        "",
    ).trim();
    const hasResolvedServerIdentity =
      Boolean(effectiveMetadata?.username || effectiveMetadata?.displayName) ||
      profile.source === "blockchain" ||
      (profileResponse.fromCache === true &&
        profile.source === "optimistic-cache" &&
        Boolean(nextUsername || nextDisplayName));

    setVoteStats(profile.voteStats);
    setMyVotes(profile.voteStats?.recentVotes || []);
    if (hasResolvedServerIdentity) {
      if (nextUsername) {
        setProfileUsername(nextUsername);
      }
      if (nextDisplayName) {
        setProfileDisplayName(nextDisplayName);
      }
      setProfileAvatarUrl(
        String(effectiveMetadata?.avatar || profile.avatar || "").trim(),
      );
    } else {
      setProfileUsername(localProfileIdentity.username);
      setProfileDisplayName(localProfileIdentity.displayName);
      setProfileAvatarUrl(String(effectiveMetadata?.avatar || "").trim());
    }

    console.log("[ProfileScreen] Voting history loaded:", {
      totalVotes: profile.voteStats?.totalVotes,
      recentVotes: profile.voteStats?.recentVotes?.length,
      fromCache: profileResponse.fromCache === true,
    });

    return true;
  };

  const loadUserData = async (options?: { forceRefresh?: boolean }) => {
    if (wallet) {
      const requestId = ++loadRequestIdRef.current;
      const forceRefresh = options?.forceRefresh === true;
      try {
        // Get wallet balance
        const walletBalance = await walletService.getBalance();
        if (loadRequestIdRef.current !== requestId) {
          return;
        }
        setBalance(walletBalance);

        // Get identity hash from passport data
        if (passportData) {
          const hash = await walletService.getIdentityHash(passportData);
          if (loadRequestIdRef.current !== requestId) {
            return;
          }
          setIdentityHash(hash);
        }

        // Load my voting history from API
        try {
          const apiService = ApiService.getInstance();
          if (!forceRefresh) {
            const cachedProfileResponse =
              await apiService.getCachedCurrentProfile({
                address: wallet.address,
                maxAgeMs: CURRENT_PROFILE_CACHE_MAX_AGE_MS,
                allowStale: true,
              });

            if (cachedProfileResponse.success) {
              applyCurrentProfileResponse(cachedProfileResponse, requestId);
              if (cachedProfileResponse.isStale !== true) {
                return;
              }
            }
          }

          await ensureApiWalletInitialized();
          const profileResponse =
            await apiService.getMyProfileWithVotingHistory();
          if (applyCurrentProfileResponse(profileResponse, requestId)) {
            return;
          }

          console.log(
            "[ProfileScreen] No voting history available or API failed, using storage fallback",
          );
          // Fallback to storage
          const votes = await storageService.getUserVotes();
          if (loadRequestIdRef.current === requestId) {
            setMyVotes(votes);
          }
        } catch (error) {
          console.error(
            "[ProfileScreen] Failed to load voting history from API, using storage fallback:",
            error,
          );
          // Fallback to storage
          const votes = await storageService.getUserVotes();
          if (loadRequestIdRef.current === requestId) {
            setMyVotes(votes);
          }
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      console.log("🚪 Starting logout process...");
      const apiService = ApiService.getInstance();
      await apiService.clearAuth();

      // Clear wallet data and private keys
      const walletService = WalletService.getInstance();
      await walletService.clearWallet();

      // Clear all user-specific storage data
      const storageService = StorageService.getInstance();
      await storageService.clearAllUserData();

      // Clear stored passport and MRZ data
      await AsyncStorageService.removeItem("passport_data");
      await AsyncStorageService.removeItem("mrz_data");
      await AsyncStorageService.removeItem("registration_intent");
      await AsyncStorageService.removeItem("registration_completed_address");
      console.log("✅ Passport data cleared from storage");

      // Clear all Redux states
      dispatch(resetSocialState());
      dispatch(resetWalletState());
      dispatch(logout());

      console.log("✅ Logout completed - all data cleared");

      // Navigate to Feed screen for guest experience
      navigation.navigate("Feed");
    } catch (error) {
      console.error("❌ Error during logout:", error);
      // Still logout even if cleanup fails
      dispatch(logout());
      // Navigate to Feed screen for guest experience
      navigation.navigate("Feed");
    }
  };

  const handleShareProfile = async () => {
    try {
      const profileUrl = buildProfileShareUrl(wallet?.address || "");
      const displayName = passportData
        ? `${firstName} ${lastName}`
        : "Forum User";

      const result = await Share.share({
        message: t("profile.shareMessage", { displayName, profileUrl }),
        url: profileUrl,
        title: t("profile.shareTitle", { displayName }),
      });

      if (result.action === Share.sharedAction) {
        Toast.success(t("profile.profileShared"));
      }
    } catch (error) {
      console.error("Share error:", error);
      Toast.error(t("profile.shareError"));
    }
  };

  const handlePrivacySecurity = () => {
    openExternalUrl([
      "https://github.com/forum-online-protocol/privacy-policy",
      "https://forum.online",
    ]).catch((err) => {
      console.error("Failed to open privacy policy:", err);
      Alert.alert(t("profile.privacySecurity"), t("profile.privacyInfo"), [
        { text: t("common.ok") },
      ]);
    });
  };

  const handleHelpSupport = () => {
    const supportEmail = "mailto:support@forum.online";
    Linking.openURL(supportEmail).catch((err) => {
      console.error("Failed to open email:", err);
      Alert.alert(t("profile.helpSupport"), t("profile.supportContact"), [
        { text: t("common.ok") },
      ]);
    });
  };

  const formatAddress = (address: string) => {
    if (!address) return t("profile.noWallet");
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatHash = (hash: string) => {
    if (!hash) return t("profile.notAvailable");
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    if (Platform.OS === "web") {
      navigator.clipboard.writeText(text);
      alert(t("profile.copiedToClipboard", { label }));
    } else {
      // For React Native, you'd need to import Clipboard from @react-native-clipboard/clipboard
      alert(t("profile.copyFallback", { label, value: text }));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserData({ forceRefresh: true });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveProfileSettings = async () => {
    if (!wallet?.address) {
      Toast.error(t("profile.noWallet"));
      return;
    }

    const normalizedUsername = profileUsername
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    const normalizedDisplayName = profileDisplayName.trim();

    if (!/^[a-z0-9_.]{3,32}$/.test(normalizedUsername)) {
      Toast.error(t("profile.usernameValidation"));
      return;
    }
    if (!normalizedDisplayName) {
      Toast.error(t("profile.displayNameValidation"));
      return;
    }

    try {
      setIsSavingProfile(true);
      const apiService = await ensureApiWalletInitialized();
      const result = await apiService.updateProfileSettings({
        address: wallet.address,
        username: normalizedUsername,
        displayName: normalizedDisplayName,
        avatar: profileAvatarUrl.trim(),
      });

      if (!result.success) {
        throw new Error(result.error || t("profile.profileUpdateFailed"));
      }

      const savedMetadata = result.data?.profileMetadata;
      if (savedMetadata) {
        setProfileUsername(
          String(savedMetadata.username || normalizedUsername)
            .trim()
            .toLowerCase(),
        );
        setProfileDisplayName(
          String(savedMetadata.displayName || normalizedDisplayName).trim(),
        );
        setProfileAvatarUrl(
          String(savedMetadata.avatar || profileAvatarUrl).trim(),
        );
      }

      await apiService.patchCurrentProfileCache(
        {
          username: String(savedMetadata?.username || normalizedUsername)
            .trim()
            .toLowerCase(),
          nickname: String(savedMetadata?.username || normalizedUsername)
            .trim()
            .toLowerCase(),
          displayName: String(
            savedMetadata?.displayName || normalizedDisplayName,
          ).trim(),
          avatar: String(savedMetadata?.avatar || profileAvatarUrl).trim(),
          source: "optimistic-cache",
        },
        { address: wallet.address },
      );

      Toast.success(t("profile.profileUpdated"));
      setIsEditProfileVisible(false);
      await loadUserData({ forceRefresh: true });
    } catch (saveError) {
      Toast.error(
        saveError instanceof Error
          ? saveError.message
          : t("profile.profileUpdateFailed"),
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUploadAvatar = async () => {
    if (!wallet?.address) {
      Toast.error(t("profile.noWallet"));
      return;
    }
    if (!featureFlags.avatarUploadEnabled) {
      Toast.info(t("profile.avatarUploadUnavailable"));
      return;
    }

    try {
      const launchImageLibrary = getLaunchImageLibrary();
      if (!launchImageLibrary) {
        throw new Error(t("profile.avatarPickerUnavailable"));
      }

      const pickerResult = await launchImageLibrary({
        mediaType: "photo",
        selectionLimit: 1,
        includeBase64: true,
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
      });

      if (pickerResult.didCancel) {
        return;
      }

      const asset = pickerResult.assets?.[0];
      const fileDataBase64 = String(asset?.base64 || "").trim();
      const mimeType = String(asset?.type || "")
        .trim()
        .toLowerCase();
      const fileName = String(asset?.fileName || `avatar_${Date.now()}.jpg`);
      const sizeBytes = estimateBase64ByteSize(fileDataBase64);

      if (!fileDataBase64 || !mimeType || !sizeBytes) {
        throw new Error(t("profile.avatarUploadInvalid"));
      }

      setIsUploadingAvatar(true);
      const apiService = await ensureApiWalletInitialized();
      const result = await apiService.uploadProfileAvatar({
        address: wallet.address,
        fileName,
        mimeType,
        sizeBytes,
        fileDataBase64,
      });

      if (!result.success || !result.data?.avatar?.url) {
        throw new Error(result.error || t("profile.avatarUploadFailed"));
      }

      const uploadedAvatarUrl = String(result.data.avatar.url).trim();
      setProfileAvatarUrl(uploadedAvatarUrl);
      await apiService.patchCurrentProfileCache(
        {
          avatar: uploadedAvatarUrl,
          source: "optimistic-cache",
        },
        { address: wallet.address },
      );
      Toast.success(t("profile.avatarUploaded"));
    } catch (uploadError) {
      Toast.error(
        uploadError instanceof Error
          ? uploadError.message
          : t("profile.avatarUploadFailed"),
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const openPost = (postId?: string) => {
    const normalizedPostId = String(postId || "").trim();
    if (!normalizedPostId) return;
    navigation.navigate("PostDetail", { postId: normalizedPostId });
  };

  const handleSharePost = async (post: Post) => {
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

  const handleLikePost = async (postId: string) => {
    if (!isAuthenticated) {
      Toast.info(t("feed.signInToReact"));
      navigation.navigate("Auth");
      return;
    }

    const target = myPosts.find((post) => post.id === postId);
    const currentValue = !!target?.isLiked;
    const nextValue = !currentValue;

    setMyPosts((prev) =>
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
      const action = await dispatch(
        toggleReactionAsync({
          postId,
          reactionType: "like",
          currentValue,
        }) as any,
      );
      const payload = action?.payload;
      if (payload) {
        setMyPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  likes: payload.likes,
                  isLiked: payload.isLiked,
                  reposts: payload.reposts,
                  isReposted: payload.isReposted,
                }
              : post,
          ),
        );
      }
    } catch {
      setMyPosts((prev) =>
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

  const handleRepostPost = async (postId: string) => {
    if (!isAuthenticated) {
      Toast.info(t("feed.signInToRepost"));
      navigation.navigate("Auth");
      return;
    }

    const target = myPosts.find((post) => post.id === postId);
    const currentValue = !!target?.isReposted;
    const nextValue = !currentValue;

    setMyPosts((prev) =>
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
      const action = await dispatch(
        toggleReactionAsync({
          postId,
          reactionType: "repost",
          currentValue,
        }) as any,
      );
      const payload = action?.payload;
      if (payload) {
        setMyPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  likes: payload.likes,
                  isLiked: payload.isLiked,
                  reposts: payload.reposts,
                  isReposted: payload.isReposted,
                }
              : post,
          ),
        );
      }
      Toast.success(nextValue ? t("feed.reposted") : t("feed.repostRemoved"));
    } catch {
      setMyPosts((prev) =>
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

  const listData: ProfileListItem[] = useMemo(() => {
    if (activeTab === "profile") {
      return [{ kind: "profile", id: "profile-content" }];
    }

    if (activeTab === "posts") {
      return myPosts.map((post) => ({ kind: "post", id: post.id, post }));
    }

    return myVotes.map((vote, index) => ({
      kind: "vote",
      id: `${vote.postId || "unknown"}-${index}`,
      vote,
    }));
  }, [activeTab, myPosts, myVotes]);

  const renderProfileContent = () => (
    <View>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          {profileAvatarUrl ? (
            <Image
              source={{ uri: profileAvatarUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <Icon
              name="person"
              variant="filled"
              size={48}
              color={theme.primary}
            />
          )}
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>
            {profileDisplayName || localProfileIdentity.displayName}
          </Text>
          <Text style={styles.usernameRow}>
            @{profileUsername || localProfileIdentity.username}
          </Text>
          {isDemoAccount && (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>{t("profile.demoBadge")}</Text>
            </View>
          )}
        </View>
        {isAuthenticated && (
          <View style={styles.verifiedBadge}>
            <Text style={{ color: theme.primary }}>✓</Text>
            <Text style={styles.verifiedText}>
              {t("profile.verifiedIdentity")}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShareProfile}
        accessibilityRole="button"
        accessibilityLabel={t("profile.shareProfile")}
      >
        <Icon name="share" variant="outline" size={20} color={theme.primary} />
        <Text style={styles.shareButtonText}>{t("profile.shareProfile")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.editProfileButton}
        onPress={() => setIsEditProfileVisible((prev) => !prev)}
      >
        <Icon name="cog" variant="outline" size={16} color={theme.primary} />
        <Text style={styles.editProfileButtonText}>
          {isEditProfileVisible
            ? t("profile.hideProfileEditor")
            : t("profile.editProfile")}
        </Text>
      </TouchableOpacity>

      {isEditProfileVisible ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.editProfile")}</Text>
          <View style={styles.formField}>
            <Text style={styles.label}>{t("profile.usernameField")}</Text>
            <TextInput
              style={styles.input}
              value={profileUsername}
              onChangeText={setProfileUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("profile.usernamePlaceholder")}
              placeholderTextColor={theme.textTertiary}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>{t("profile.displayNameField")}</Text>
            <TextInput
              style={styles.input}
              value={profileDisplayName}
              onChangeText={setProfileDisplayName}
              placeholder={t("profile.displayNamePlaceholder")}
              placeholderTextColor={theme.textTertiary}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>{t("profile.avatarField")}</Text>
            {featureFlags.avatarUploadEnabled ? (
              <TouchableOpacity
                style={[
                  styles.uploadAvatarButton,
                  isUploadingAvatar && styles.uploadAvatarButtonDisabled,
                ]}
                onPress={handleUploadAvatar}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                ) : (
                  <>
                    <Icon
                      name="cloud-upload"
                      variant="outline"
                      size={16}
                      color={theme.onPrimary}
                    />
                    <Text style={styles.uploadAvatarButtonText}>
                      {t("profile.uploadAvatar")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.helperText}>
                {t("profile.avatarUploadUnavailable")}
              </Text>
            )}
            {profileAvatarUrl ? (
              <Text style={styles.helperText} numberOfLines={2}>
                {profileAvatarUrl}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[
              styles.saveProfileButton,
              isSavingProfile && styles.saveProfileButtonDisabled,
            ]}
            onPress={handleSaveProfileSettings}
            disabled={isSavingProfile}
          >
            {isSavingProfile ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Text style={styles.saveProfileButtonText}>
                {t("profile.saveProfile")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.identityDetails")}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.documentType")}</Text>
          <Text style={styles.value}>
            {passportData?.documentType || t("profile.passport")}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.documentNumber")}</Text>
          <Text style={styles.value}>
            {passportData?.personalData?.documentNumber ||
              passportData?.documentNumber ||
              t("profile.notAvailable")}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.dateOfBirth")}</Text>
          <Text style={styles.value}>
            {passportData?.personalData?.dateOfBirth ||
              passportData?.dateOfBirth ||
              t("profile.notAvailable")}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.nationality")}</Text>
          <Text style={styles.value}>
            {passportData?.personalData?.nationality ||
              passportData?.nationality ||
              passportData?.issuingCountry ||
              t("profile.notAvailable")}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.issuingState")}</Text>
          <Text style={styles.value}>
            {passportData?.personalData?.issuingState ||
              passportData?.issuingState ||
              t("profile.notAvailable")}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.registrationDate")}</Text>
          <Text style={styles.value}>{new Date().toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("profile.walletInformation")}
        </Text>

        <TouchableOpacity
          style={styles.infoRow}
          onPress={() =>
            wallet?.address &&
            copyToClipboard(wallet.address, t("profile.walletAddressLabel"))
          }
          accessibilityRole="button"
          accessibilityLabel={t("profile.address")}
        >
          <Text style={styles.label}>{t("profile.address")}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.monoValue}>
              {formatAddress(wallet?.address || "")}
            </Text>
            <Text style={{ fontSize: 16, color: theme.textTertiary }}>📋</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.balance")}</Text>
          <Text style={styles.value}>{balance} ETH</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.network")}</Text>
          <Text style={styles.value}>{t("profile.sepoliaTestnet")}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.security")}</Text>

        <TouchableOpacity
          style={styles.infoRow}
          onPress={() =>
            identityHash &&
            copyToClipboard(identityHash, t("profile.identityHashLabel"))
          }
          accessibilityRole="button"
          accessibilityLabel={t("profile.identityHash")}
        >
          <Text style={styles.label}>{t("profile.identityHash")}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.monoValue}>{formatHash(identityHash)}</Text>
            <Text style={{ fontSize: 16, color: theme.textTertiary }}>📋</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.verificationMethod")}</Text>
          <Text style={styles.value}>
            {passportData ? t("profile.nfcPassport") : t("profile.demoMode")}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("profile.accountStatus")}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{t("profile.active")}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.settings")}</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => navigation.navigate("Settings")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.settings")}
        >
          <View style={styles.settingLeft}>
            <Icon
              name="settings"
              size={20}
              color={theme.textSecondary}
              variant="outline"
            />
            <Text style={styles.settingText}>{t("profile.settings")}</Text>
          </View>
          <Icon
            name="chevron-right"
            size={20}
            color={theme.textTertiary}
            variant="outline"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={handlePrivacySecurity}
          accessibilityRole="button"
          accessibilityLabel={t("profile.privacySecurity")}
        >
          <View style={styles.settingLeft}>
            <Icon
              name="lock-closed"
              size={20}
              color={theme.textSecondary}
              variant="outline"
            />
            <Text style={styles.settingText}>
              {t("profile.privacySecurity")}
            </Text>
          </View>
          <Icon
            name="chevron-right"
            size={20}
            color={theme.textTertiary}
            variant="outline"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={handleHelpSupport}
          accessibilityRole="button"
          accessibilityLabel={t("profile.helpSupport")}
        >
          <View style={styles.settingLeft}>
            <Icon
              name="help-circle"
              size={20}
              color={theme.textSecondary}
              variant="outline"
            />
            <Text style={styles.settingText}>{t("profile.helpSupport")}</Text>
          </View>
          <Icon
            name="chevron-right"
            size={20}
            color={theme.textTertiary}
            variant="outline"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel={t("profile.signOut")}
      >
        <Text style={styles.logoutText}>{t("profile.signOut")}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t("profile.forumVersion")}</Text>
        <Text style={styles.footerSubtext}>
          {t("profile.platformDescription")}
        </Text>
      </View>
    </View>
  );

  const renderPostItem = (post: Post) => {
    return (
      <PostFeedCard
        post={post}
        lotterySummaryMode="details"
        lotteryVisible={featureFlags.lotteryEnabled}
        commentsVisible={featureFlags.commentsEnabled}
        onPress={() => openPost(post.id)}
        onReply={() => openPost(post.id)}
        onLike={() => handleLikePost(post.id)}
        onRepost={() => handleRepostPost(post.id)}
        onShare={() => handleSharePost(post)}
      />
    );
  };

  const renderVoteItem = (vote: any) => {
    const votePostId = String(vote.postId || vote.proposalId || "").trim();
    const post =
      feed.find((p) => p.id === votePostId) ||
      myPosts.find((p) => p.id === votePostId);
    const option = post?.voteData?.options?.find(
      (opt) => String(opt.id) === String(vote.voteType || vote.voteOption),
    );
    const optionLabel =
      option?.label ||
      vote.voteOption ||
      vote.voteType ||
      t("profile.notAvailable");
    const voteTime = formatDateTime(
      vote.timestamp || vote.votedAt || vote.createdAt || vote.date,
    );
    const postPreviewRaw =
      getPostDisplayContent(
        (post || {
          content: "",
          localization: null,
        }) as Pick<Post, "content" | "localizedContent" | "localization">,
        currentLanguage,
      ) ||
      String(
        vote.postContent ||
          vote.title ||
          votePostId ||
          t("profile.unknownPost"),
      );
    const postPreview =
      postPreviewRaw.length > 110
        ? `${postPreviewRaw.slice(0, 110)}...`
        : postPreviewRaw;
    const canOpenPost = !!votePostId;

    return (
      <TouchableOpacity
        style={styles.voteCard}
        activeOpacity={canOpenPost ? 0.9 : 1}
        disabled={!canOpenPost}
        onPress={() => openPost(votePostId)}
      >
        <View style={styles.voteHeaderRow}>
          <View style={styles.voteTitleWrap}>
            <View style={styles.voteIcon}>
              <Icon
                name="ballot"
                size={13}
                color={theme.primary}
                variant="filled"
              />
            </View>
            <Text style={styles.voteTitle} numberOfLines={2}>
              {postPreview}
            </Text>
          </View>
          <Text style={styles.voteDate}>{voteTime}</Text>
        </View>

        <View style={styles.voteChoicePill}>
          <Icon
            name="checkmark"
            size={12}
            color={theme.primary}
            variant="filled"
          />
          <Text style={styles.voteChoiceText}>
            {t("profile.voted", { option: optionLabel })}
          </Text>
        </View>

        <View style={styles.voteFooterRow}>
          <Text style={styles.votePostId}>
            {truncateMiddle(votePostId || t("profile.unknownPost"), 12, 8)}
          </Text>
          {canOpenPost ? (
            <View style={styles.voteOpenLink}>
              <Text style={styles.voteOpenLinkText}>
                {t("common.readMore")}
              </Text>
              <Icon
                name="chevron-right"
                size={14}
                color={theme.textSecondary}
                variant="outline"
              />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }: { item: ProfileListItem }) => {
    if (item.kind === "profile") return renderProfileContent();
    if (item.kind === "post") return renderPostItem(item.post);
    return renderVoteItem(item.vote);
  };

  const renderVotesHeader = () => {
    if (activeTab !== "votes" || !voteStats) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.votingStatistics")}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{voteStats.totalVotes || 0}</Text>
            <Text style={styles.statLabel}>{t("profile.totalVotes")}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{voteStats.optionVotes || 0}</Text>
            <Text style={styles.statLabel}>{t("profile.proposalVotes")}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {voteStats.totalVotes > 0
                ? Math.round((voteStats.upVotes / voteStats.totalVotes) * 100)
                : 0}
              %
            </Text>
            <Text style={styles.statLabel}>{t("profile.positiveRate")}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {voteStats.totalVotes > 20
                ? t("profile.high")
                : voteStats.totalVotes > 5
                  ? t("profile.medium")
                  : t("profile.low")}
            </Text>
            <Text style={styles.statLabel}>{t("profile.activity")}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderListEmpty = () => {
    if (activeTab === "profile") return null;

    return (
      <View style={styles.emptyContainer}>
        <Icon
          name={activeTab === "posts" ? "document" : "ballot"}
          size={48}
          color={theme.textTertiary}
          variant="outline"
          style={styles.emptyIconStyle}
        />
        <Text style={styles.emptyTitle}>
          {activeTab === "posts"
            ? t("profile.noProposals")
            : t("profile.noVotes")}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === "posts"
            ? t("profile.proposalsWillAppear")
            : t("profile.votingHistoryWillAppear")}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "profile" && styles.activeTab]}
          onPress={() => setActiveTab("profile")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.profile")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "profile" && styles.activeTabText,
            ]}
          >
            {t("profile.profile")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "posts" && styles.activeTab]}
          onPress={() => setActiveTab("posts")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.myProposals", {
            count: myPosts.length,
          })}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "posts" && styles.activeTabText,
            ]}
          >
            {t("profile.myProposals", { count: myPosts.length })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "votes" && styles.activeTab]}
          onPress={() => setActiveTab("votes")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.myVotes", {
            count: voteStats?.totalVotes || myVotes.length,
          })}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "votes" && styles.activeTabText,
            ]}
          >
            {t("profile.myVotes", {
              count: voteStats?.totalVotes || myVotes.length,
            })}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderListItem}
        ListHeaderComponent={renderVotesHeader}
        ListEmptyComponent={renderListEmpty}
        onRefresh={onRefresh}
        refreshing={refreshing}
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
    listContent: {
      paddingBottom: 120,
      flexGrow: 1,
    },
    profileHeader: {
      alignItems: "center",
      padding: 30,
      backgroundColor: theme.background,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.primary,
    },
    avatarImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
    },
    name: {
      fontSize: 24,
      fontWeight: "bold",
      marginTop: 16,
      color: theme.text,
    },
    usernameRow: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    verifiedText: {
      marginLeft: 4,
      color: theme.primary,
      fontSize: 14,
      fontWeight: "500",
    },
    nameContainer: {
      alignItems: "center",
      gap: 8,
    },
    demoBadge: {
      backgroundColor: theme.warning,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      marginTop: 4,
    },
    demoBadgeText: {
      color: theme.onPrimary,
      fontSize: 10,
      fontWeight: "bold",
      textAlign: "center",
    },
    section: {
      backgroundColor: theme.surface,
      padding: 20,
      marginTop: 2,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 20,
      color: theme.textTertiary,
      letterSpacing: 1,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    label: {
      fontSize: 14,
      color: theme.textTertiary,
    },
    value: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "500",
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    monoValue: {
      fontSize: 13,
      color: theme.text,
      fontFamily: monoFontFamily,
    },
    statusBadge: {
      backgroundColor: theme.success,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      color: theme.onPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    settingLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    settingText: {
      fontSize: 14,
      color: theme.text,
    },
    logoutButton: {
      margin: 20,
      padding: 16,
      backgroundColor: theme.error,
      borderRadius: 8,
    },
    logoutText: {
      color: theme.onPrimary,
      textAlign: "center",
      fontWeight: "600",
      fontSize: 16,
    },
    footer: {
      alignItems: "center",
      padding: 20,
      marginBottom: 20,
    },
    footerText: {
      color: theme.primaryDark,
      fontSize: 14,
    },
    footerSubtext: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    tabsContainer: {
      flexDirection: "row",
      backgroundColor: theme.surface,
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
      fontSize: 14,
      color: theme.textTertiary,
      fontWeight: "500",
    },
    activeTabText: {
      color: theme.primary,
      fontWeight: "700",
    },
    voteCard: {
      marginHorizontal: 16,
      marginTop: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 10,
    },
    voteHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
    },
    voteTitleWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    voteIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(29, 155, 240, 0.12)",
      marginTop: 2,
    },
    voteTitle: {
      fontSize: 15,
      color: theme.text,
      lineHeight: 22,
      flex: 1,
    },
    voteChoicePill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      backgroundColor: "rgba(29, 155, 240, 0.10)",
      borderWidth: 1,
      borderColor: "rgba(29, 155, 240, 0.22)",
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    voteChoiceText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: "600",
    },
    voteFooterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    votePostId: {
      fontSize: 12,
      color: theme.textTertiary,
      fontFamily: monoFontFamily,
      flex: 1,
    },
    voteOpenLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    voteOpenLinkText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    voteDate: {
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: 2,
    },
    emptyContainer: {
      alignItems: "center",
      padding: 40,
      backgroundColor: theme.background,
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
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textTertiary,
      textAlign: "center",
    },
    shareButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(29, 155, 240, 0.1)",
      borderColor: theme.primary,
      borderWidth: 1,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginHorizontal: 20,
      marginVertical: 16,
    },
    shareButtonText: {
      color: theme.primary,
      fontWeight: "600",
      fontSize: 14,
      marginLeft: 8,
    },
    editProfileButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    editProfileButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primary,
    },
    formField: {
      marginBottom: 12,
    },
    input: {
      marginTop: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      backgroundColor: theme.background,
      fontSize: 14,
    },
    helperText: {
      marginTop: 8,
      fontSize: 12,
      color: theme.textSecondary,
    },
    uploadAvatarButton: {
      marginTop: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    uploadAvatarButtonDisabled: {
      opacity: 0.7,
    },
    uploadAvatarButtonText: {
      color: theme.onPrimary,
      fontWeight: "600",
      fontSize: 14,
    },
    saveProfileButton: {
      marginTop: 4,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
    },
    saveProfileButtonDisabled: {
      opacity: 0.65,
    },
    saveProfileButtonText: {
      color: theme.onPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 12,
    },
    statCard: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 16,
      flex: 1,
      minWidth: "45%",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    statNumber: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textTertiary,
      textAlign: "center",
    },
  });

export default ProfileScreen;
