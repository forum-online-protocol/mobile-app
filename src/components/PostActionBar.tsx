import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "./Icon";
import { useTheme } from "../contexts/ThemeContext";
import { useLocalization } from "../hooks/useLocalization";
import { hitSlop10, spacing, typography } from "../styles/tokens";

interface PostActionBarProps {
  replies?: number;
  reposts?: number;
  likes?: number;
  isLiked?: boolean;
  isReposted?: boolean;
  showReply?: boolean;
  disabled?: boolean;
  onReply?: () => void;
  onRepost?: () => void;
  onLike?: () => void;
  onShare?: () => void;
}

const formatCount = (value?: number, showZero = false) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return showZero ? "0" : "";
  }

  if (normalized <= 0) {
    return showZero ? "0" : "";
  }

  if (normalized < 1000) return String(normalized);
  if (normalized < 1_000_000)
    return `${(normalized / 1000).toFixed(1).replace(".0", "")}K`;
  return `${(normalized / 1_000_000).toFixed(1).replace(".0", "")}M`;
};

const PostActionBar: React.FC<PostActionBarProps> = ({
  replies,
  reposts,
  likes,
  isLiked,
  isReposted,
  showReply = true,
  disabled = false,
  onReply,
  onRepost,
  onLike,
  onShare,
}) => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {showReply ? (
        <TouchableOpacity
          style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
          onPress={onReply}
          disabled={disabled}
          hitSlop={hitSlop10}
          accessibilityRole="button"
          accessibilityLabel={t("postAction.reply")}
        >
          <Icon
            name="chatbubble"
            size={16}
            color={theme.textSecondary}
            variant="outline"
          />
          <Text style={styles.actionText}>{formatCount(replies, true)}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
        onPress={onRepost}
        disabled={disabled}
        hitSlop={hitSlop10}
        accessibilityRole="button"
        accessibilityLabel={t("postAction.repost")}
      >
        <Icon
          name="sync"
          size={16}
          color={isReposted ? "#00BA7C" : theme.textSecondary}
          variant={isReposted ? "filled" : "outline"}
        />
        <Text style={[styles.actionText, isReposted && styles.repostedText]}>
          {formatCount(reposts)}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
        onPress={onLike}
        disabled={disabled}
        hitSlop={hitSlop10}
        accessibilityRole="button"
        accessibilityLabel={t("postAction.like")}
      >
        <Icon
          name="heart"
          size={16}
          color={isLiked ? "#F91880" : theme.textSecondary}
          variant={isLiked ? "filled" : "outline"}
        />
        <Text style={[styles.actionText, isLiked && styles.likedText]}>
          {formatCount(likes)}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.actionButton,
          styles.shareButton,
        ]}
        onPress={onShare}
        hitSlop={hitSlop10}
        accessibilityRole="button"
        accessibilityLabel={t("postAction.share")}
      >
        <Icon
          name="share"
          size={16}
          color={theme.textSecondary}
          variant="outline"
        />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.xs,
      width: "100%",
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      minHeight: 34,
      paddingVertical: spacing.xs,
    },
    actionButtonDisabled: {
      opacity: 0.45,
    },
    shareButton: {
      justifyContent: "flex-end",
    },
    actionText: {
      ...typography.caption,
      color: theme.textSecondary,
      marginLeft: spacing.xs,
    },
    likedText: {
      color: "#F91880",
      fontWeight: "700",
    },
    repostedText: {
      color: "#00BA7C",
      fontWeight: "700",
    },
  });

export default PostActionBar;
