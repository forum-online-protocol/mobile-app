import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  LayoutChangeEvent,
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ethers } from "ethers";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { toggleReactionAsync } from "../store/socialSlice";
import { useNavigation } from "../contexts/NavigationContext";
import { Post } from "../types";
import ApiService from "../services/ApiService";
import Icon from "../components/Icon";
import PostFeedCard from "../components/PostFeedCard";
import Toast from "../utils/Toast";
import { buildPostShareUrl } from "../utils/shareLinks";
import {
  getPostAuthorPresentation,
  isAnonymousPost,
} from "../utils/anonymousPost";
import { getPostDisplayContent } from "../utils/localizedPost";
import { useLocalization } from "../hooks/useLocalization";
import { useServerFeatureFlags } from "../hooks/useServerFeatureFlags";
import { useTheme } from "../contexts/ThemeContext";
import {
  hairlineWidth,
  hitSlop10,
  monoFontFamily,
  radii,
  spacing,
  typography,
} from "../styles/tokens";
import ScreenState from "../components/ui/ScreenState";

interface PostDetailScreenProps {
  route?: {
    params: {
      postId: string;
    };
  };
}

const formatDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const formatWeiToEth = (value?: string) => {
  try {
    if (!value) return "0 ETH";
    const amount = Number(ethers.formatEther(value));
    if (!Number.isFinite(amount)) return "0 ETH";
    return `${amount.toFixed(6)} ETH`;
  } catch {
    return "0 ETH";
  }
};

const truncateMiddle = (
  value: string,
  left: number = 10,
  right: number = 8,
) => {
  if (!value || value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
};

type BlockchainDetailItem = {
  key: string;
  label: string;
  value: string;
  shortValue: string;
};

type PostComment = {
  id: string;
  postId: string;
  parentPostId?: string;
  content: string;
  createdAt: string;
  status?: "approved" | "pending_review" | "rejected" | string;
  isPendingModeration?: boolean;
  author: {
    id: string;
    address?: string | null;
    username: string;
    displayName: string;
    avatar?: string;
    isVerified: boolean;
  };
};

type VoteReceipt = {
  nullifier: string;
  status: string;
  proofHash?: string;
  txHash?: string;
  publisherAddress?: string;
  paymasterAddress?: string;
};

const PostDetailScreen: React.FC<PostDetailScreenProps> = ({ route }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t, currentLanguage } = useLocalization();
  const { featureFlags } = useServerFeatureFlags();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const feed = useSelector((state: RootState) => state.social.feed);
  const sessionType = useSelector((state: RootState) => state.auth.sessionType);
  const isGuestSession = sessionType === "guest";

  const [post, setPost] = useState<Post | null>(null);
  const [lottery, setLottery] = useState<any | null>(null);
  const [lotteryParticipant, setLotteryParticipant] = useState<any | null>(
    null,
  );
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBlockchainDetails, setShowBlockchainDetails] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLotteryContractModal, setShowLotteryContractModal] =
    useState(false);
  const [selectedLotteryContract, setSelectedLotteryContract] = useState("");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [voteReceipt, setVoteReceipt] = useState<VoteReceipt | null>(null);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [reportingComment, setReportingComment] = useState<PostComment | null>(
    null,
  );
  const [showCommentReportModal, setShowCommentReportModal] = useState(false);
  const [isSubmittingCommentReport, setIsSubmittingCommentReport] =
    useState(false);
  const [screenOpacity] = useState(() => new Animated.Value(0));
  const commentInputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [blockchainSectionY, setBlockchainSectionY] = useState(0);

  const postId = route?.params?.postId;
  const isPendingModeration = !!(
    post?.isPendingModeration ||
    post?.isPending ||
    post?.status === "pending_review" ||
    post?.moderationStatus?.status === "pending_moderation" ||
    post?.moderationStatus?.status === "pending_review"
  );
  const isLegacyArchived = post?.isReadOnlyLegacy === true;

  const blockchainDetails = useMemo<BlockchainDetailItem[]>(() => {
    if (!post) return [];

    const items: BlockchainDetailItem[] = [];
    const pushItem = (
      key: string,
      label: string,
      rawValue?: string | null,
      truncateValue = true,
    ) => {
      const value = (rawValue || "").toString().trim();
      if (!value) return;
      items.push({
        key,
        label,
        value,
        shortValue: truncateValue ? truncateMiddle(value) : value,
      });
    };

    const contentHash =
      post.content && post.content.trim().length > 0
        ? ethers.keccak256(ethers.toUtf8Bytes(post.content))
        : "";

    pushItem(
      "voteReceiptStatus",
      t("voting.voteReceiptStatusLabel"),
      voteReceipt?.status,
      false,
    );
    pushItem(
      "voteReceiptNullifier",
      t("voting.voteReceiptNullifierLabel"),
      voteReceipt?.nullifier,
    );
    pushItem(
      "voteReceiptProofHash",
      t("voting.voteReceiptProofHashLabel"),
      voteReceipt?.proofHash,
    );
    pushItem(
      "voteReceiptTxHash",
      t("voting.voteReceiptTxHashLabel"),
      voteReceipt?.txHash,
    );
    pushItem(
      "voteReceiptPublisher",
      t("voting.voteReceiptPublisherLabel"),
      voteReceipt?.publisherAddress,
    );
    pushItem(
      "voteReceiptPaymaster",
      t("voting.voteReceiptPaymasterLabel"),
      voteReceipt?.paymasterAddress,
    );

    pushItem("postId", t("postDetail.blockchainPostId"), post.id, false);
    pushItem(
      "authorAddress",
      t("postDetail.blockchainAuthorAddress"),
      post.author?.address,
    );
    pushItem("contentHash", t("postDetail.blockchainContentHash"), contentHash);
    pushItem(
      "publishTx",
      t("postDetail.blockchainPublishTx"),
      post.transactionHash,
    );
    pushItem(
      "lotteryContract",
      t("postDetail.blockchainLotteryContract"),
      post.lotteryAddress || post.lottery?.contractAddress,
    );
    pushItem(
      "lotteryDeployTx",
      t("postDetail.blockchainLotteryDeployTx"),
      post.lottery?.deploymentTxHash,
    );
    pushItem(
      "batchPublisher",
      t("postDetail.blockchainBatchPublisher"),
      post.batchPublisherAddress,
    );
    pushItem(
      "batchPaymaster",
      t("postDetail.blockchainBatchPaymaster"),
      post.batchPaymasterAddress,
    );
    pushItem(
      "eligibilityRoot",
      t("postDetail.blockchainEligibilityRoot"),
      post.eligibilityRoot,
    );
    pushItem(
      "ipfsHash",
      t("postDetail.blockchainIpfsHash"),
      post.ipfsHash || "",
    );

    return items;
  }, [post, voteReceipt, t]);

  const commentReportReasons = useMemo(
    () => [
      { id: "spam", label: t("postItem.reasons.spam") },
      { id: "harassment", label: t("postItem.reasons.harassment") },
      { id: "hate", label: t("postItem.reasons.hate") },
      { id: "violence", label: t("postItem.reasons.violence") },
      { id: "csae", label: t("postItem.reasons.csae") },
      { id: "nudity", label: t("postItem.reasons.nudity") },
      { id: "false", label: t("postItem.reasons.false") },
      { id: "other", label: t("postItem.reasons.other") },
    ],
    [t],
  );

  useEffect(() => {
    loadPost();
  }, [postId]);

  useEffect(() => {
    setShowBlockchainDetails(false);
    setShowMoreMenu(false);
    setShowLotteryContractModal(false);
    setShowCommentReportModal(false);
    setReportingComment(null);
    setSelectedLotteryContract("");
    setCommentInput("");
    setVoteReceipt(null);
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const syncedPost = feed.find((item) => item.id === postId);
    if (syncedPost) {
      setPost(syncedPost);
    }
  }, [feed, postId]);

  useEffect(() => {
    if (!postId) return;
    if (!featureFlags.commentsEnabled || post?.isReadOnlyLegacy) {
      setComments([]);
      return;
    }
    loadComments(postId);
  }, [postId, featureFlags.commentsEnabled, post?.isReadOnlyLegacy]);

  useEffect(() => {
    if (!postId) return;
    loadVoteReceipt(postId);
  }, [postId]);

  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  const loadPost = async () => {
    if (!postId) {
      setError(t("postDetail.postIdMissing"));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const cachedPost = feed.find((item) => item.id === postId);
      if (cachedPost) {
        setPost(cachedPost);
        await Promise.all([
          loadLottery(postId),
          ...(featureFlags.commentsEnabled && !cachedPost.isReadOnlyLegacy
            ? [loadComments(postId)]
            : []),
          loadVoteReceipt(postId),
        ]);
        return;
      }

      const apiService = ApiService.getInstance();
      const response = await apiService.getPost(postId);

      if (response.success && response.data) {
        setPost(response.data);
        await Promise.all([
          loadLottery(postId),
          ...(featureFlags.commentsEnabled && !response.data.isReadOnlyLegacy
            ? [loadComments(postId)]
            : []),
          loadVoteReceipt(postId),
        ]);
      } else {
        throw new Error(response.error || t("postDetail.postNotFound"));
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("postDetail.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadLottery = async (id: string) => {
    try {
      const apiService = ApiService.getInstance();
      const response = await apiService.getPostLottery(id);
      if (response.success) {
        setLottery(response.data);
        const participant = await apiService.getPostLotteryParticipant(id);
        setLotteryParticipant(
          participant.success ? participant.data?.participant || null : null,
        );
      } else {
        setLottery(null);
        setLotteryParticipant(null);
      }
    } catch {
      setLottery(null);
      setLotteryParticipant(null);
    }
  };

  const loadComments = async (id: string) => {
    if (!featureFlags.commentsEnabled) {
      setComments([]);
      setIsCommentsLoading(false);
      return;
    }
    try {
      setIsCommentsLoading(true);
      const apiService = ApiService.getInstance();
      const response = await apiService.getPostComments(id);
      if (response.success) {
        setComments(response.data?.comments || []);
        setPost((prev) =>
          prev
            ? {
                ...prev,
                replies: Number(response.data?.total || 0),
                comments: Number(response.data?.total || 0),
              }
            : prev,
        );
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    } finally {
      setIsCommentsLoading(false);
    }
  };

  const loadVoteReceipt = async (id: string) => {
    try {
      const stored = await AsyncStorage.getItem(`vote_receipt_latest:${id}`);
      if (!stored) {
        setVoteReceipt(null);
        return;
      }

      const parsed = JSON.parse(stored);
      if (!parsed?.nullifier) {
        setVoteReceipt(null);
        return;
      }

      const draftReceipt: VoteReceipt = {
        nullifier: parsed.nullifier,
        status: parsed.status || "queued",
        proofHash: parsed.proofHash,
        txHash: parsed.txHash,
        publisherAddress: parsed.publisherAddress,
        paymasterAddress: parsed.paymasterAddress,
      };
      setVoteReceipt(draftReceipt);

      const apiService = ApiService.getInstance();
      const result = await apiService.getVoteReceipt(
        id,
        draftReceipt.nullifier,
      );
      if (!result.success) {
        return;
      }

      const onChain = result.data?.onChain?.onChain === true;
      const remoteReceipt = result.data?.receipt;
      const onChainData = result.data?.onChain;
      const updatedReceipt: VoteReceipt = {
        nullifier: draftReceipt.nullifier,
        status: onChain
          ? "published"
          : remoteReceipt?.status || draftReceipt.status,
        proofHash: remoteReceipt?.proofHash || draftReceipt.proofHash,
        txHash:
          onChainData?.txHash || remoteReceipt?.txHash || draftReceipt.txHash,
        publisherAddress:
          onChainData?.publisherAddress ||
          remoteReceipt?.publisherAddress ||
          draftReceipt.publisherAddress,
        paymasterAddress:
          onChainData?.paymasterAddress ||
          remoteReceipt?.paymasterAddress ||
          draftReceipt.paymasterAddress,
      };

      setVoteReceipt(updatedReceipt);
      await AsyncStorage.setItem(
        `vote_receipt_latest:${id}`,
        JSON.stringify(updatedReceipt),
      );
    } catch {
      setVoteReceipt(null);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Feed");
  };

  const handleShare = async () => {
    if (!post) return;

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

  const handleOpenMoreMenu = () => {
    setShowMoreMenu(true);
  };

  const handleCloseMoreMenu = () => {
    setShowMoreMenu(false);
  };

  const handleLike = async () => {
    if (!post) return;
    if (isGuestSession) {
      Toast.info(t("postDetail.signInReact"));
      navigation.navigate("Auth");
      return;
    }

    const currentValue = !!post.isLiked;
    const nextValue = !currentValue;
    setPost((prev) =>
      prev
        ? {
            ...prev,
            isLiked: nextValue,
            likes: Math.max(0, Number(prev.likes || 0) + (nextValue ? 1 : -1)),
          }
        : prev,
    );

    try {
      const payload = await dispatch(
        toggleReactionAsync({
          postId: post.id,
          reactionType: "like",
          currentValue,
        }) as any,
      ).unwrap();

      setPost((prev) =>
        prev
          ? {
              ...prev,
              likes: payload.likes,
              reposts: payload.reposts,
              isLiked: payload.isLiked,
              isReposted: payload.isReposted,
            }
          : prev,
      );
    } catch (reactionError) {
      setPost((prev) =>
        prev
          ? {
              ...prev,
              isLiked: currentValue,
              likes: Math.max(
                0,
                Number(prev.likes || 0) + (currentValue ? 1 : -1),
              ),
            }
          : prev,
      );
      Toast.error(t("postDetail.likeFailed"));
    }
  };

  const handleRepost = async () => {
    if (!post) return;
    if (isGuestSession) {
      Toast.info(t("postDetail.signInRepost"));
      navigation.navigate("Auth");
      return;
    }

    const currentValue = !!post.isReposted;
    const nextValue = !currentValue;
    setPost((prev) =>
      prev
        ? {
            ...prev,
            isReposted: nextValue,
            reposts: Math.max(
              0,
              Number(prev.reposts || 0) + (nextValue ? 1 : -1),
            ),
          }
        : prev,
    );

    try {
      const payload = await dispatch(
        toggleReactionAsync({
          postId: post.id,
          reactionType: "repost",
          currentValue,
        }) as any,
      ).unwrap();

      setPost((prev) =>
        prev
          ? {
              ...prev,
              likes: payload.likes,
              reposts: payload.reposts,
              isLiked: payload.isLiked,
              isReposted: payload.isReposted,
            }
          : prev,
      );
      Toast.success(
        nextValue ? t("postDetail.reposted") : t("postDetail.repostRemoved"),
      );
    } catch (reactionError) {
      setPost((prev) =>
        prev
          ? {
              ...prev,
              isReposted: currentValue,
              reposts: Math.max(
                0,
                Number(prev.reposts || 0) + (currentValue ? 1 : -1),
              ),
            }
          : prev,
      );
      Toast.error(t("postDetail.repostFailed"));
    }
  };

  const openAuthorProfile = () => {
    if (!post?.author) return;
    if (isAnonymousPost(post)) return;

    navigation.navigate("UserProfile", {
      userId: post.author.id,
      userAddress: post.author.address,
      username: post.author.username,
      displayName: post.author.displayName,
      avatar: post.author.avatar,
      isVerified: post.author.isVerified,
    });
  };

  const handleOpenLotteryContractDialog = () => {
    if (!post) return;

    const contractAddress = (
      lottery?.lottery?.contractAddress ||
      post.lotteryAddress ||
      post.lottery?.contractAddress ||
      ""
    )
      .toString()
      .trim();

    if (!contractAddress) {
      Toast.info(t("postDetail.pendingDeploy"));
      return;
    }

    setSelectedLotteryContract(contractAddress);
    setShowLotteryContractModal(true);
  };

  const handleCloseLotteryContractDialog = () => {
    setShowLotteryContractModal(false);
  };

  const handleClaim = async () => {
    if (!post) return;

    try {
      setIsClaiming(true);
      const apiService = ApiService.getInstance();
      const result = await apiService.claimPostLotteryReward(post.id);
      if (!result.success) {
        throw new Error(result.error || t("postDetail.claimFailed"));
      }

      Toast.success(t("postDetail.claimed"));
      await loadLottery(post.id);
    } catch (claimError) {
      Toast.error(
        claimError instanceof Error
          ? claimError.message
          : t("postDetail.claimFailed"),
      );
    } finally {
      setIsClaiming(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!post) return;
    if (post.isReadOnlyLegacy) {
      Toast.info(t("voting.legacyArchived"));
      return;
    }
    if (!featureFlags.commentsEnabled) {
      Toast.info(t("postDetail.commentsDisabled"));
      return;
    }
    const content = commentInput.trim();
    if (!content) {
      Toast.info(t("postDetail.commentEmpty"));
      return;
    }
    if (isGuestSession) {
      Toast.info(t("postDetail.commentSignInRequired"));
      navigation.navigate("Auth");
      return;
    }

    try {
      setIsSubmittingComment(true);
      const apiService = ApiService.getInstance();
      const result = await apiService.createPostComment(post.id, content);
      if (!result.success) {
        throw new Error(result.error || t("postDetail.commentCreateFailed"));
      }
      setCommentInput("");
      await loadComments(post.id);
      Toast.success(t("postDetail.commentPosted"));
    } catch (commentError) {
      Toast.error(
        commentError instanceof Error
          ? commentError.message
          : t("postDetail.commentCreateFailed"),
      );
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleOpenCommentReportDialog = (comment: PostComment) => {
    if (isGuestSession) {
      Toast.info(t("postDetail.commentReportSignInRequired"));
      navigation.navigate("Auth");
      return;
    }

    setReportingComment(comment);
    setShowCommentReportModal(true);
  };

  const handleCloseCommentReportDialog = () => {
    setShowCommentReportModal(false);
    setReportingComment(null);
  };

  const handleSubmitCommentReport = async (reason: string) => {
    if (!reportingComment) {
      return;
    }

    try {
      setIsSubmittingCommentReport(true);
      const apiService = ApiService.getInstance();
      const result = await apiService.reportComment(
        reportingComment.id,
        reason,
      );

      if (!result.success) {
        throw new Error(
          result.error || t("postDetail.commentReportSubmitFailed"),
        );
      }

      handleCloseCommentReportDialog();
      Toast.success(
        result.data?.duplicate
          ? t("postDetail.commentReportAlreadySubmitted")
          : t("postDetail.commentReportSubmitted"),
      );
    } catch (error: any) {
      Toast.error(error?.message || t("postDetail.commentReportSubmitFailed"));
    } finally {
      setIsSubmittingCommentReport(false);
    }
  };

  const handleCopyBlockchainValue = async (label: string, value: string) => {
    try {
      await Clipboard.setString(value);
      Toast.success(t("postDetail.blockchainCopied", { label }));
    } catch {
      Toast.error(t("postDetail.blockchainCopyFailed"));
    }
  };

  const scrollToBlockchainDetails = () => {
    const targetY = Math.max(blockchainSectionY - spacing.l, 0);
    scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
  };

  const handleOpenVotingDetails = () => {
    setShowBlockchainDetails(true);
    setTimeout(() => {
      scrollToBlockchainDetails();
    }, 80);
  };

  const handleBlockchainSectionLayout = (event: LayoutChangeEvent) => {
    setBlockchainSectionY(event.nativeEvent.layout.y);
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.stateWrap}>
          <ScreenState type="loading" title={t("postDetail.loading")} />
        </View>
      );
    }

    if (error || !post) {
      return (
        <View style={styles.stateWrap}>
          <ScreenState
            type="error"
            title={t("postDetail.unableToOpen")}
            subtitle={error || t("postDetail.unavailable")}
            actionLabel={t("common.tryAgain")}
            onActionPress={loadPost}
          />
        </View>
      );
    }

    return (
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <PostFeedCard
          post={post}
          fullBleed
          lotteryVisible={featureFlags.lotteryEnabled}
          commentsVisible={featureFlags.commentsEnabled && !isLegacyArchived}
          onAuthorPress={openAuthorProfile}
          onReply={
            featureFlags.commentsEnabled && !isLegacyArchived
              ? () => commentInputRef.current?.focus()
              : undefined
          }
          onRepost={handleRepost}
          onLike={handleLike}
          onShare={handleShare}
          onLotteryPress={handleOpenLotteryContractDialog}
          compactReceipt
          onOpenVotingDetails={handleOpenVotingDetails}
        />

        {featureFlags.lotteryEnabled &&
          (post.lottery?.enabled || lottery?.lottery?.enabled) &&
          (() => {
            const lotteryConfig = lottery?.lottery || post.lottery || null;
            const lotteryContractAddress = (
              lotteryConfig?.contractAddress ||
              post.lotteryAddress ||
              post.lottery?.contractAddress ||
              ""
            )
              .toString()
              .trim();
            const oddsNumerator = Number(lotteryConfig?.oddsNumerator || 1);
            const oddsDenominator = Number(
              lotteryConfig?.oddsDenominator || 1000,
            );
            const payoutMode = lotteryConfig?.payoutMode || "fixed";
            const asset = lotteryConfig?.asset || "ETH";
            const fixedAmountEth = (lotteryConfig?.fixedAmountEth || "")
              .toString()
              .trim();
            const shareBps = Number(lotteryConfig?.shareBps || 0);

            const payoutSummary =
              payoutMode === "fixed"
                ? fixedAmountEth
                  ? `${fixedAmountEth} ${asset}`
                  : t("postDetail.notAvailableShort")
                : shareBps > 0
                  ? `${(shareBps / 100).toFixed(2).replace(/\.00$/, "")}%`
                  : t("postDetail.notAvailableShort");

            return (
              <View style={styles.lotteryCard}>
                <View style={styles.lotteryTitleRow}>
                  <View style={styles.lotteryTitleIcon}>
                    <Icon
                      name="sparkles"
                      size={14}
                      color={theme.primary}
                      variant="filled"
                    />
                  </View>
                  <Text style={styles.lotteryTitle}>
                    {t("postDetail.lottery")}
                  </Text>
                </View>
                <View style={styles.lotteryHighlights}>
                  <View style={styles.lotteryStatChip}>
                    <Text style={styles.lotteryStatLabel}>
                      {t("postDetail.odds")}
                    </Text>
                    <Text style={styles.lotteryStatValue}>
                      {oddsNumerator}/{oddsDenominator}
                    </Text>
                  </View>
                  <View style={styles.lotteryStatChip}>
                    <Text style={styles.lotteryStatLabel}>
                      {t("postDetail.payout")}
                    </Text>
                    <Text style={styles.lotteryStatValue}>{payoutSummary}</Text>
                  </View>
                </View>
                <Text style={styles.lotteryMetaLine}>
                  {t("postDetail.asset")}: {asset}
                </Text>

                {lotteryContractAddress ? (
                  <TouchableOpacity
                    style={styles.lotteryContractRow}
                    onPress={handleOpenLotteryContractDialog}
                    activeOpacity={0.85}
                  >
                    <View style={styles.lotteryContractMeta}>
                      <Text style={styles.lotteryContractLabel}>
                        {t("postDetail.contract")}
                      </Text>
                      <Text style={styles.lotteryContractValue}>
                        {truncateMiddle(lotteryContractAddress, 12, 10)}
                      </Text>
                    </View>
                    <Icon
                      name="copy"
                      size={14}
                      color={theme.textSecondary}
                      variant="outline"
                    />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.lotteryAddress}>
                    {t("postDetail.contract")}: {t("postDetail.pendingDeploy")}
                  </Text>
                )}
                {lotteryContractAddress ? (
                  <Text style={styles.lotteryContractHint}>
                    {t("postDetail.blockchainDetailsHint")}
                  </Text>
                ) : null}
                {lotteryParticipant ? (
                  <View style={styles.lotteryStatusBox}>
                    <Text style={styles.lotteryText}>
                      {t("postDetail.entries")}:{" "}
                      {lotteryParticipant.entriesCount || 0}
                    </Text>
                    <Text style={styles.lotteryText}>
                      {t("postDetail.winner")}:{" "}
                      {lotteryParticipant.isWinner
                        ? t("postDetail.yes")
                        : t("postDetail.no")}
                    </Text>
                    <Text style={styles.lotteryText}>
                      {t("postDetail.pendingReward")}:{" "}
                      {formatWeiToEth(lotteryParticipant.pendingRewardWei)}
                    </Text>
                    <Text style={styles.lotteryStatusText}>
                      {t("postDetail.claimDeadline")}:{" "}
                      {lotteryParticipant.claimDeadline
                        ? formatDateTime(
                            new Date(
                              lotteryParticipant.claimDeadline * 1000,
                            ).toISOString(),
                          )
                        : t("postDetail.notAvailableShort")}
                    </Text>
                  </View>
                ) : null}

                {lotteryContractAddress && (
                  <View style={styles.lotteryActions}>
                    <TouchableOpacity
                      style={styles.donateButton}
                      onPress={handleOpenLotteryContractDialog}
                    >
                      <Text style={styles.donateButtonText}>
                        {t("postDetail.fundLottery")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.claimButton,
                        (!lotteryParticipant?.canClaimNow || isClaiming) &&
                          styles.claimButtonDisabled,
                      ]}
                      onPress={handleClaim}
                      disabled={!lotteryParticipant?.canClaimNow || isClaiming}
                    >
                      {isClaiming ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.onPrimary}
                        />
                      ) : (
                        <Text style={styles.claimButtonText}>
                          {lotteryParticipant?.canClaimNow
                            ? t("postDetail.claimReward")
                            : t("postDetail.noReward")}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })()}

        {featureFlags.commentsEnabled && !isLegacyArchived ? (
          <View style={styles.commentsCard}>
            <Text style={styles.commentsTitle}>
              {t("postDetail.commentsTitle", { count: comments.length })}
            </Text>

            <View style={styles.commentComposerRow}>
              <TextInput
                ref={commentInputRef}
                style={styles.commentInput}
                placeholder={t("postDetail.commentPlaceholder")}
                placeholderTextColor={theme.textTertiary}
                value={commentInput}
                onChangeText={setCommentInput}
                multiline
                editable={!isSubmittingComment && !isPendingModeration}
              />
              <TouchableOpacity
                style={[
                  styles.commentSendButton,
                  (isSubmittingComment || isPendingModeration) &&
                    styles.commentSendButtonDisabled,
                ]}
                onPress={handleSubmitComment}
                disabled={isSubmittingComment || isPendingModeration}
              >
                {isSubmittingComment ? (
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                ) : (
                  <Icon
                    name="send"
                    size={14}
                    color={theme.onPrimary}
                    variant="filled"
                  />
                )}
              </TouchableOpacity>
            </View>

            {isGuestSession ? (
              <TouchableOpacity
                style={styles.commentSignInHint}
                onPress={() => navigation.navigate("Auth")}
              >
                <Text style={styles.commentSignInText}>
                  {t("postDetail.commentSignInRequired")}
                </Text>
              </TouchableOpacity>
            ) : null}

            {isCommentsLoading ? (
              <View style={styles.commentsLoading}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : comments.length === 0 ? (
              <Text style={styles.commentsEmpty}>
                {t("postDetail.commentsEmpty")}
              </Text>
            ) : (
              <View style={styles.commentsList}>
                {comments.map((comment) => {
                  const isPendingComment =
                    comment.isPendingModeration ||
                    comment.status === "pending_review" ||
                    comment.status === "pending";

                  return (
                    <View key={comment.id} style={styles.commentItem}>
                      <View style={styles.commentMetaRow}>
                        <Text style={styles.commentMeta}>
                          {comment.author.displayName} @
                          {comment.author.username} ·{" "}
                          {formatDateTime(comment.createdAt)}
                        </Text>
                        <View style={styles.commentMetaActions}>
                          {isPendingComment ? (
                            <View style={styles.commentPendingPill}>
                              <Text style={styles.commentPendingPillText}>
                                {t("profile.pendingModeration")}
                              </Text>
                            </View>
                          ) : null}
                          {!isPendingComment ? (
                            <TouchableOpacity
                              style={styles.commentReportButton}
                              onPress={() =>
                                handleOpenCommentReportDialog(comment)
                              }
                              disabled={isSubmittingCommentReport}
                            >
                              <Text style={styles.commentReportButtonText}>
                                {t("postDetail.commentReportAction")}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                      <Text style={styles.commentContent}>
                        {comment.content}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {blockchainDetails.length > 0 ? (
          <View
            style={styles.blockchainCard}
            onLayout={handleBlockchainSectionLayout}
          >
            <TouchableOpacity
              style={styles.blockchainHeader}
              onPress={() => setShowBlockchainDetails((prev) => !prev)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                showBlockchainDetails
                  ? t("common.showLess")
                  : t("common.readMore")
              }
            >
              <View style={styles.blockchainHeaderLeft}>
                <Icon
                  name="shield-checkmark"
                  size={15}
                  color={theme.primary}
                  variant="filled"
                />
                <Text style={styles.blockchainTitle}>
                  {t("postDetail.blockchainDetails")}
                </Text>
              </View>
              <View style={styles.blockchainToggleButton}>
                <Icon
                  name={
                    showBlockchainDetails ? "chevron-down" : "chevron-right"
                  }
                  size={14}
                  color={theme.textSecondary}
                  variant="outline"
                />
              </View>
            </TouchableOpacity>
            {showBlockchainDetails ? (
              <View style={styles.blockchainBody}>
                <Text style={styles.blockchainHint}>
                  {t("postDetail.blockchainDetailsHint")}
                </Text>
                {blockchainDetails.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.blockchainRow}
                    onPress={() =>
                      handleCopyBlockchainValue(item.label, item.value)
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.blockchainMeta}>
                      <Text style={styles.blockchainLabel}>{item.label}</Text>
                      <Text style={styles.blockchainValue}>
                        {item.shortValue}
                      </Text>
                    </View>
                    <Icon
                      name="copy"
                      size={14}
                      color={theme.textSecondary}
                      variant="outline"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.headerButton}
          hitSlop={hitSlop10}
        >
          <Icon
            name="arrow-back"
            size={22}
            color={theme.text}
            variant="outline"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("postDetail.title")}</Text>
        <TouchableOpacity
          onPress={handleOpenMoreMenu}
          style={styles.headerButton}
          hitSlop={hitSlop10}
        >
          <Icon
            name="ellipsis-horizontal"
            size={20}
            color={theme.text}
            variant="outline"
          />
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
        {renderBody()}
      </Animated.View>

      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMoreMenu}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={handleCloseMoreMenu}
        >
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                handleCloseMoreMenu();
                handleShare();
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
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleCloseMoreMenu}
            >
              <Icon
                name="close"
                size={16}
                color={theme.textSecondary}
                variant="outline"
              />
              <Text style={styles.menuItemText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showCommentReportModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCommentReportDialog}
      >
        <View style={styles.submittingOverlay}>
          <View style={styles.commentReportModalCard}>
            <Text style={styles.commentReportModalTitle}>
              {t("postDetail.commentReportTitle")}
            </Text>
            <Text style={styles.commentReportModalSubtitle}>
              {t("postDetail.commentReportQuestion")}
            </Text>

            {commentReportReasons.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.commentReportReasonButton,
                  reason.id === "csae" && styles.commentReportReasonButtonAlert,
                ]}
                onPress={() => handleSubmitCommentReport(reason.id)}
                disabled={isSubmittingCommentReport}
              >
                <Text
                  style={[
                    styles.commentReportReasonText,
                    reason.id === "csae" && styles.commentReportReasonTextAlert,
                  ]}
                >
                  {reason.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.commentReportCancelButton}
              onPress={handleCloseCommentReportDialog}
              disabled={isSubmittingCommentReport}
            >
              <Text style={styles.commentReportCancelButtonText}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isSubmittingComment} transparent animationType="fade">
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingOverlayCard}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.submittingOverlayText}>
              {t("common.loading")}
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLotteryContractModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseLotteryContractDialog}
      >
        <View style={styles.contractModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCloseLotteryContractDialog}
          />
          <View style={styles.contractModalCard}>
            <View style={styles.contractModalHandle} />
            <View style={styles.contractModalHeader}>
              <View style={styles.contractModalTitleWrap}>
                <View style={styles.contractModalIconWrap}>
                  <Icon
                    name="link"
                    size={14}
                    color={theme.primary}
                    variant="outline"
                  />
                </View>
                <View>
                  <Text style={styles.contractModalTitle}>
                    {t("postDetail.fundLotteryTitle")}
                  </Text>
                  <Text style={styles.contractModalSubtitle}>
                    {t("postDetail.fundLotterySubtitle")}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.contractModalClose}
                onPress={handleCloseLotteryContractDialog}
                hitSlop={hitSlop10}
              >
                <Icon
                  name="close"
                  size={16}
                  color={theme.textSecondary}
                  variant="outline"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.contractModalAddressBox}>
              <Text style={styles.contractModalAddress}>
                {selectedLotteryContract}
              </Text>
            </View>
            <Text style={styles.contractModalHint}>
              {t("postDetail.fundLotteryHint")}
            </Text>

            <View style={styles.contractModalActions}>
              <TouchableOpacity
                style={styles.contractModalSecondaryButton}
                onPress={handleCloseLotteryContractDialog}
              >
                <Text style={styles.contractModalSecondaryText}>
                  {t("common.close")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.contractModalPrimaryButton}
                onPress={() => {
                  void handleCopyBlockchainValue(
                    t("postDetail.contract"),
                    selectedLotteryContract,
                  );
                }}
              >
                <Icon
                  name="copy"
                  size={14}
                  color={theme.onPrimary}
                  variant="outline"
                />
                <Text style={styles.contractModalPrimaryText}>
                  {t("common.copy")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      height: 52,
      paddingHorizontal: spacing.s,
      borderBottomWidth: hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.headerBackground,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerButton: {
      height: 36,
      width: 36,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      ...typography.bodyStrong,
      color: theme.text,
    },
    contentContainer: {
      padding: spacing.l,
      paddingBottom: 96,
    },
    postCard: {
      flexDirection: "row",
      marginHorizontal: -spacing.l,
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
    postDisplayName: {
      ...typography.bodyStrong,
      color: theme.text,
      maxWidth: 150,
    },
    verifiedBadge: {
      marginHorizontal: spacing.xs,
    },
    postUsername: {
      ...typography.body,
      color: theme.textSecondary,
      marginLeft: spacing.xs,
    },
    postHeaderTimestamp: {
      ...typography.body,
      color: theme.textSecondary,
      marginLeft: spacing.xs,
    },
    pendingPill: {
      marginLeft: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.pill,
      backgroundColor: "rgba(255, 193, 7, 0.18)",
    },
    pendingPillText: {
      ...typography.meta,
      color: theme.warning || "#A56A00",
      fontWeight: "700",
      textTransform: "uppercase",
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
    lotteryRowText: {
      ...typography.caption,
      color: theme.textSecondary,
      flex: 1,
    },
    lotteryCard: {
      marginTop: spacing.l,
      padding: spacing.l,
      backgroundColor: theme.card,
      borderRadius: radii.l,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      gap: spacing.s,
    },
    lotteryTitle: {
      ...typography.bodyStrong,
      color: theme.text,
    },
    lotteryTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
    },
    lotteryTitleIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    lotteryHighlights: {
      flexDirection: "row",
      gap: spacing.s,
    },
    lotteryStatChip: {
      flex: 1,
      borderRadius: radii.m,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.s,
      gap: 2,
    },
    lotteryStatLabel: {
      ...typography.small,
      color: theme.textSecondary,
    },
    lotteryStatValue: {
      ...typography.bodyStrong,
      color: theme.text,
    },
    lotteryMetaLine: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    lotteryText: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    lotteryAddress: {
      ...typography.small,
      color: theme.textSecondary,
    },
    lotteryContractHint: {
      ...typography.small,
      color: theme.textTertiary,
      marginTop: -2,
    },
    lotteryContractRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: radii.m,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.s,
      gap: spacing.s,
    },
    lotteryContractMeta: {
      flex: 1,
      gap: 2,
    },
    lotteryContractLabel: {
      ...typography.small,
      color: theme.textSecondary,
    },
    lotteryContractValue: {
      ...typography.caption,
      color: theme.text,
      fontFamily: monoFontFamily,
    },
    lotteryActions: {
      marginTop: spacing.s,
      flexDirection: "row",
      gap: spacing.s,
    },
    donateButton: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.s,
      alignItems: "center",
      justifyContent: "center",
    },
    donateButtonText: {
      ...typography.caption,
      color: theme.onPrimary,
      fontWeight: "700",
    },
    claimButton: {
      flex: 1,
      backgroundColor: theme.success,
      borderRadius: radii.pill,
      paddingVertical: spacing.s,
      alignItems: "center",
      justifyContent: "center",
    },
    claimButtonDisabled: {
      backgroundColor: theme.textTertiary,
    },
    claimButtonText: {
      ...typography.caption,
      color: theme.onPrimary,
      fontWeight: "700",
    },
    lotteryStatusBox: {
      marginTop: spacing.xs,
      padding: spacing.s,
      borderRadius: radii.m,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      gap: 4,
    },
    lotteryStatusText: {
      ...typography.small,
      color: theme.textSecondary,
    },
    commentsCard: {
      marginTop: spacing.l,
      padding: spacing.l,
      backgroundColor: theme.card,
      borderRadius: radii.l,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      gap: spacing.s,
    },
    commentsTitle: {
      ...typography.bodyStrong,
      color: theme.text,
    },
    commentComposerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.s,
    },
    commentInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 110,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      borderRadius: radii.m,
      backgroundColor: theme.surface,
      color: theme.text,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.s,
      ...typography.body,
    },
    commentSendButton: {
      height: 40,
      width: 40,
      borderRadius: radii.pill,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    commentSendButtonDisabled: {
      backgroundColor: theme.textTertiary,
    },
    commentSignInHint: {
      marginTop: 2,
    },
    commentSignInText: {
      ...typography.small,
      color: theme.primary,
    },
    commentsLoading: {
      paddingVertical: spacing.s,
    },
    commentsEmpty: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    commentsList: {
      gap: spacing.s,
    },
    commentItem: {
      borderRadius: radii.m,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: spacing.s,
      gap: 4,
    },
    commentMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.s,
    },
    commentMetaActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    commentMeta: {
      ...typography.small,
      color: theme.textSecondary,
      flex: 1,
    },
    commentPendingPill: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.s,
      paddingVertical: 2,
      backgroundColor: "rgba(255, 193, 7, 0.18)",
    },
    commentPendingPillText: {
      ...typography.small,
      color: theme.warning || "#A56A00",
      fontWeight: "700",
      textTransform: "uppercase",
    },
    commentContent: {
      ...typography.body,
      color: theme.text,
    },
    commentReportButton: {
      borderRadius: radii.pill,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: spacing.s,
      paddingVertical: 4,
    },
    commentReportButtonText: {
      ...typography.small,
      color: theme.textSecondary,
      fontWeight: "700",
    },
    blockchainCard: {
      marginTop: spacing.l,
      padding: spacing.l,
      backgroundColor: theme.card,
      borderRadius: radii.l,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
    },
    blockchainHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    blockchainHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
    },
    blockchainToggleButton: {
      height: 22,
      width: 22,
      borderRadius: 11,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    blockchainTitle: {
      ...typography.bodyStrong,
      color: theme.text,
    },
    blockchainBody: {
      marginTop: spacing.s,
      gap: spacing.xs,
    },
    blockchainHint: {
      ...typography.small,
      color: theme.textSecondary,
      marginBottom: spacing.xs,
    },
    blockchainRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: radii.m,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.s,
      gap: spacing.s,
    },
    blockchainMeta: {
      flex: 1,
      gap: 2,
    },
    blockchainLabel: {
      ...typography.small,
      color: theme.textSecondary,
    },
    blockchainValue: {
      ...typography.caption,
      color: theme.text,
      fontFamily: monoFontFamily,
    },
    menuOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-start",
      alignItems: "flex-end",
      paddingTop: 56,
      paddingRight: spacing.s,
    },
    menuCard: {
      backgroundColor: theme.card,
      borderRadius: radii.m,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      minWidth: 210,
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
    contractModalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      paddingHorizontal: spacing.s,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    contractModalCard: {
      backgroundColor: theme.card,
      borderRadius: radii.l,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      padding: spacing.l,
      gap: spacing.s,
      marginBottom: spacing.l,
    },
    contractModalHandle: {
      alignSelf: "center",
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: -spacing.xs,
      marginBottom: spacing.xs,
    },
    contractModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.s,
    },
    contractModalTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
    },
    contractModalIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    contractModalTitle: {
      ...typography.bodyStrong,
      color: theme.text,
    },
    contractModalSubtitle: {
      ...typography.small,
      color: theme.textSecondary,
    },
    contractModalClose: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    contractModalAddressBox: {
      borderRadius: radii.m,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.s,
    },
    contractModalAddress: {
      ...typography.caption,
      color: theme.text,
      fontFamily: monoFontFamily,
    },
    contractModalHint: {
      ...typography.small,
      color: theme.textTertiary,
    },
    contractModalActions: {
      flexDirection: "row",
      gap: spacing.s,
    },
    contractModalSecondaryButton: {
      flex: 1,
      borderRadius: radii.pill,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: spacing.s,
      alignItems: "center",
      justifyContent: "center",
    },
    contractModalSecondaryText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: "700",
    },
    contractModalPrimaryButton: {
      flex: 1,
      borderRadius: radii.pill,
      backgroundColor: theme.primary,
      paddingVertical: spacing.s,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    contractModalPrimaryText: {
      ...typography.caption,
      color: theme.onPrimary,
      fontWeight: "700",
    },
    submittingOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    submittingOverlayCard: {
      minWidth: 170,
      borderRadius: radii.l,
      backgroundColor: theme.card,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.s,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
    },
    commentReportModalCard: {
      width: "100%",
      maxWidth: 420,
      borderRadius: radii.l,
      backgroundColor: theme.card,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      gap: spacing.s,
      paddingHorizontal: spacing.l,
      paddingVertical: spacing.l,
    },
    commentReportModalTitle: {
      ...typography.bodyStrong,
      color: theme.text,
      textAlign: "center",
    },
    commentReportModalSubtitle: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: "center",
    },
    commentReportReasonButton: {
      borderRadius: radii.m,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.m,
    },
    commentReportReasonButtonAlert: {
      borderColor: theme.error,
      backgroundColor: "rgba(255, 59, 48, 0.08)",
    },
    commentReportReasonText: {
      ...typography.body,
      color: theme.text,
    },
    commentReportReasonTextAlert: {
      color: theme.error,
      fontWeight: "700",
    },
    commentReportCancelButton: {
      marginTop: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: spacing.s,
      alignItems: "center",
      justifyContent: "center",
    },
    commentReportCancelButtonText: {
      ...typography.body,
      color: theme.text,
      fontWeight: "700",
    },
    submittingOverlayText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    stateWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xxl,
    },
  });

export default PostDetailScreen;
