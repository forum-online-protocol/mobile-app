import React, { useMemo, useState } from "react";
import {
  GestureResponderEvent,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Post } from "../types";
import { useTheme } from "../contexts/ThemeContext";
import { useLocalization } from "../hooks/useLocalization";
import Icon from "./Icon";
import VotingCard from "./VotingCard";
import PostActionBar from "./PostActionBar";
import { getPostDisplayContent } from "../utils/localizedPost";
import { getPostAuthorPresentation } from "../utils/anonymousPost";
import {
  hairlineWidth,
  hitSlop10,
  radii,
  spacing,
  typography,
} from "../styles/tokens";

interface PostFeedCardProps {
  post: Post;
  onPress?: () => void;
  onAuthorPress?: () => void;
  onMenuPress?: (event?: GestureResponderEvent) => void;
  onReply?: () => void;
  onRepost?: () => void;
  onLike?: () => void;
  onShare?: () => void;
  onLotteryPress?: () => void;
  lotterySummaryMode?: "contract" | "details";
  lotteryVisible?: boolean;
  commentsVisible?: boolean;
  compactReceipt?: boolean;
  onOpenVotingDetails?: () => void;
  fullBleed?: boolean;
}

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

const PostFeedCard: React.FC<PostFeedCardProps> = ({
  post,
  onPress,
  onAuthorPress,
  onMenuPress,
  onReply,
  onRepost,
  onLike,
  onShare,
  onLotteryPress,
  lotterySummaryMode = "contract",
  lotteryVisible = false,
  commentsVisible = true,
  compactReceipt = false,
  onOpenVotingDetails,
  fullBleed = false,
}) => {
  const { theme } = useTheme();
  const { t, currentLanguage } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const displayContent = useMemo(
    () => getPostDisplayContent(post, currentLanguage),
    [post, currentLanguage],
  );
  const authorPresentation = useMemo(
    () => getPostAuthorPresentation(post, t),
    [post, t],
  );

  const hasVotingOptions =
    Array.isArray(post.voteData?.options) && post.voteData.options.length > 0;
  const resolvedReplies = useMemo(() => {
    const repliesValue = Number((post as any)?.replies);
    if (Number.isFinite(repliesValue) && repliesValue >= 0) {
      return repliesValue;
    }

    const commentsValue = Number((post as any)?.comments);
    if (Number.isFinite(commentsValue) && commentsValue >= 0) {
      return commentsValue;
    }

    return 0;
  }, [post]);
  const isPendingModeration = !!(
    post.isPendingModeration ||
    post.isPending ||
    post.status === "pending_review" ||
    post.moderationStatus?.status === "pending_moderation" ||
    post.moderationStatus?.status === "pending_review"
  );
  const isLegacyArchived = post.isReadOnlyLegacy === true;
  const isInteractionDisabled = isPendingModeration || isLegacyArchived;
  const timestamp = formatTimestamp(post.timestamp || post.createdAt);

  const lotteryConfig = post.lottery || (post.voteData as any)?.lottery;
  const lotteryContractAddress = (
    post.lotteryAddress ||
    lotteryConfig?.contractAddress ||
    ""
  )
    .toString()
    .trim();
  const hasLotteryInfo =
    lotteryVisible && Boolean(lotteryConfig?.enabled || lotteryContractAddress);
  const lotteryRowPress = onLotteryPress || onPress;
  const lotteryOddsNumerator = Number(lotteryConfig?.oddsNumerator || 1);
  const lotteryOddsDenominator = Number(lotteryConfig?.oddsDenominator || 1000);
  const lotteryPayoutMode = lotteryConfig?.payoutMode || "fixed";
  const lotteryAsset = lotteryConfig?.asset || "ETH";
  const lotteryFixedAmountEth = (lotteryConfig?.fixedAmountEth || "")
    .toString()
    .trim();
  const lotteryShareBps = Number(lotteryConfig?.shareBps || 0);

  const payoutLabel = useMemo(() => {
    if (lotteryPayoutMode === "fixed" && lotteryFixedAmountEth) {
      return `${lotteryFixedAmountEth} ${lotteryAsset}`;
    }

    if (lotteryPayoutMode === "share" && lotteryShareBps > 0) {
      const percent = (lotteryShareBps / 100).toFixed(2).replace(/\.00$/, "");
      return `${percent}%`;
    }

    return t("postDetail.notAvailableShort");
  }, [
    lotteryPayoutMode,
    lotteryFixedAmountEth,
    lotteryAsset,
    lotteryShareBps,
    t,
  ]);

  const lotterySummaryText = useMemo(() => {
    if (lotterySummaryMode === "details") {
      return `${t("postDetail.lottery")} • ${t("postDetail.odds")}: ${lotteryOddsNumerator}/${lotteryOddsDenominator} • ${t("postDetail.payout")}: ${payoutLabel}`;
    }

    if (lotteryContractAddress) {
      return `${t("postDetail.lottery")} • ${t("postDetail.contract")}: ${truncateAddress(lotteryContractAddress)}`;
    }

    return `${t("postDetail.lottery")} • ${t("postDetail.pendingDeploy")}`;
  }, [
    lotterySummaryMode,
    lotteryContractAddress,
    lotteryOddsNumerator,
    lotteryOddsDenominator,
    payoutLabel,
    t,
  ]);
  const isLotteryDetailsMode = lotterySummaryMode === "details";

  const handleAuthorPress = (event?: GestureResponderEvent) => {
    event?.stopPropagation?.();
    if (!authorPresentation.canOpenProfile) {
      return;
    }
    onAuthorPress?.();
  };

  const handleMenuPress = (event?: GestureResponderEvent) => {
    event?.stopPropagation?.();
    onMenuPress?.(event);
  };

  const avatarUri = authorPresentation.avatar;
  const fallbackText = (authorPresentation.displayName || "U")
    .charAt(0)
    .toUpperCase();

  const content = (
    <>
      <TouchableOpacity
        style={styles.avatarColumn}
        onPress={handleAuthorPress}
        hitSlop={hitSlop10}
        disabled={!onAuthorPress || !authorPresentation.canOpenProfile}
        activeOpacity={0.8}
      >
        {avatarUri && !avatarFailed ? (
          <Image
            source={{ uri: avatarUri }}
            style={styles.avatar}
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{fallbackText}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.postBody}>
        <View style={styles.postHeaderRow}>
          <View style={styles.postIdentityRow}>
            <TouchableOpacity
              onPress={handleAuthorPress}
              hitSlop={hitSlop10}
              disabled={!onAuthorPress || !authorPresentation.canOpenProfile}
            >
              <Text style={styles.displayName} numberOfLines={1}>
                {authorPresentation.displayName}
              </Text>
            </TouchableOpacity>
            {authorPresentation.showVerified ? (
              <Icon
                name="checkmark"
                variant="filled"
                size={14}
                color={theme.primary}
                style={styles.verifiedBadge}
              />
            ) : null}
            {authorPresentation.username ? (
              <TouchableOpacity
                onPress={handleAuthorPress}
                hitSlop={hitSlop10}
                style={styles.usernameButton}
                disabled={!onAuthorPress || !authorPresentation.canOpenProfile}
              >
                <Text style={styles.username} numberOfLines={1}>
                  @{authorPresentation.username}
                </Text>
              </TouchableOpacity>
            ) : null}
            {timestamp ? (
              <Text style={styles.timestamp}>· {timestamp}</Text>
            ) : null}
            {isPendingModeration ? (
              <View style={styles.pendingPill}>
                <Text style={styles.pendingPillText}>
                  {t("profile.pendingModeration")}
                </Text>
              </View>
            ) : null}
          </View>

          {onMenuPress ? (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={handleMenuPress}
              hitSlop={hitSlop10}
            >
              <Icon
                name="ellipsis-horizontal"
                size={18}
                color={theme.textSecondary}
                variant="outline"
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.postContent}>{displayContent}</Text>

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
              disabled={isInteractionDisabled}
              guestMessage={
                isPendingModeration
                  ? "Voting opens after moderation approval"
                  : isLegacyArchived
                    ? t("voting.legacyArchived")
                    : undefined
              }
              proposalContent={displayContent}
              compactReceipt={compactReceipt}
              onOpenDetails={onOpenVotingDetails}
            />
          </View>
        ) : null}

        {hasLotteryInfo ? (
          <TouchableOpacity
            style={[
              styles.lotteryRow,
              isLotteryDetailsMode && styles.lotteryRowDetails,
            ]}
            onPress={lotteryRowPress}
            activeOpacity={0.85}
            disabled={!lotteryRowPress}
          >
            <Icon
              name="sparkles"
              size={14}
              color={theme.primary}
              variant="filled"
            />
            {isLotteryDetailsMode ? (
              <View style={styles.lotteryDetailsWrap}>
                <View style={styles.lotteryChip}>
                  <Text style={styles.lotteryChipLabel}>
                    {t("postDetail.odds")}
                  </Text>
                  <Text style={styles.lotteryChipValue}>
                    {lotteryOddsNumerator}/{lotteryOddsDenominator}
                  </Text>
                </View>
                <View style={styles.lotteryChip}>
                  <Text style={styles.lotteryChipLabel}>
                    {t("postDetail.payout")}
                  </Text>
                  <Text style={styles.lotteryChipValue}>{payoutLabel}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.lotteryText} numberOfLines={1}>
                {lotterySummaryText}
              </Text>
            )}
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
          showReply={commentsVisible && !isLegacyArchived}
          disabled={isInteractionDisabled}
          onReply={onReply}
          onRepost={onRepost}
          onLike={onLike}
          onShare={onShare}
        />
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.postCard, fullBleed && styles.postCardFullBleed]}
        activeOpacity={0.94}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.postCard, fullBleed && styles.postCardFullBleed]}>
      {content}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    postCard: {
      flexDirection: "row",
      marginHorizontal: 0,
      marginTop: 0,
      paddingHorizontal: spacing.l,
      paddingVertical: spacing.m,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    postCardFullBleed: {
      marginHorizontal: -spacing.l,
      marginTop: 0,
      paddingHorizontal: spacing.l,
      borderRadius: 0,
      borderWidth: 0,
      borderBottomWidth: hairlineWidth,
      borderBottomColor: theme.divider,
      backgroundColor: theme.background,
      shadowOpacity: 0,
      elevation: 0,
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
    lotteryRowDetails: {
      paddingVertical: spacing.s,
    },
    lotteryDetailsWrap: {
      flex: 1,
      flexDirection: "row",
      gap: spacing.xs,
      marginLeft: spacing.xs,
    },
    lotteryChip: {
      flex: 1,
      borderRadius: radii.s,
      borderWidth: hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.background,
      paddingHorizontal: spacing.xs,
      paddingVertical: 4,
      gap: 1,
    },
    lotteryChipLabel: {
      ...typography.small,
      color: theme.textSecondary,
    },
    lotteryChipValue: {
      ...typography.caption,
      color: theme.text,
      fontWeight: "700",
    },
    lotteryText: {
      ...typography.caption,
      color: theme.textSecondary,
      flex: 1,
    },
  });

export default PostFeedCard;
