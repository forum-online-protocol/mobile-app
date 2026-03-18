import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import Toast from "../utils/Toast";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import Icon from "./Icon";
import { voteOnPostAsync } from "../store/socialSlice";
import {
  checkVotingEligibility,
  formatRestrictions,
  formatMerkleRestrictions,
} from "../utils/votingEligibility";
import { useNavigation } from "../contexts/NavigationContext";
import PassportVerificationService from "../services/PassportVerificationService";
import ApiService from "../services/ApiService";
import { useLocalization } from "../hooks/useLocalization";
import { useTheme } from "../contexts/ThemeContext";

interface VotingCardProps {
  postId: string;
  voteData: {
    options: Array<{
      id: string | number;
      label: string;
      count: number;
      percentage?: number;
    }>;
    totalVotes: number;
    deadline?: string;
    userVote?: string | number;
    restrictions?: any; // Vote restrictions (legacy)
  };
  // New Merkle-based restriction fields from server
  allowedCountries?: string[];
  minAgeRange?: number;
  requiresVerification?: boolean;
  eligibilityRoot?: string;
  hasVoted?: boolean;
  userVote?: string | number;
  disabled?: boolean;
  guestMessage?: string;
  proposalContent?: string; // Post content for voting dialog
  compactReceipt?: boolean;
  onOpenDetails?: () => void;
}

const truncateMiddle = (
  value?: string,
  left: number = 10,
  right: number = 8,
) => {
  if (!value) return "";
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
};

const VotingCard: React.FC<VotingCardProps> = ({
  postId,
  voteData,
  allowedCountries,
  minAgeRange,
  requiresVerification,
  eligibilityRoot,
  hasVoted = false,
  userVote,
  disabled = false,
  guestMessage,
  proposalContent,
  compactReceipt = false,
  onOpenDetails,
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t } = useLocalization();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const passportData = useSelector(
    (state: RootState) => state.auth.passportData,
  );
  const wallet = useSelector((state: RootState) => state.auth.wallet);
  const [localVote, setLocalVote] = useState<string | number | null>(
    userVote || voteData.userVote || (hasVoted ? "__voted__" : null),
  );
  const [localVoteData, setLocalVoteData] = useState(voteData); // Track updated vote data
  const [isVoting, setIsVoting] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | number | null>(
    null,
  );
  const [votingStatus, setVotingStatus] = useState<
    "preparing" | "submitting" | "success" | "error"
  >("preparing");
  const [isEligible, setIsEligible] = useState<boolean>(true);
  const [eligibilityReason, setEligibilityReason] = useState<string>("");
  const [lastVoteReceipt, setLastVoteReceipt] = useState<{
    nullifier: string;
    status: string;
    proofHash?: string;
    txHash?: string;
    publisherAddress?: string;
    paymasterAddress?: string;
  } | null>(null);
  const [isCheckingReceipt, setIsCheckingReceipt] = useState(false);
  const [showReceiptDetails, setShowReceiptDetails] = useState(false);
  const voteAnonymously = true; // All votes are anonymous
  const isVotingDisabled = disabled === true;
  const voteChoiceStorageKey = useMemo(
    () => `vote_choice:${(wallet?.address || "anon").toLowerCase()}:${postId}`,
    [wallet?.address, postId],
  );

  // Check voting eligibility based on passport data and restrictions
  useEffect(() => {
    if (passportData && (allowedCountries || minAgeRange)) {
      try {
        // Use server-provided restrictions, fallback to legacy, then defaults
        const restrictions = {
          minAgeRange: minAgeRange || voteData.restrictions?.minAgeRange || 1,
          allowedCountries: allowedCountries ||
            voteData.restrictions?.allowedCountries || [
              "RUS",
              "UKR",
              "KAZ",
              "BLR",
              "USA",
              "GBR",
            ],
        };

        // Convert passport data to expected format for eligibility check
        const passportForVerification = {
          personalData: {
            firstName:
              passportData.personalData?.firstName || passportData.firstName,
            lastName:
              passportData.personalData?.lastName || passportData.lastName,
            nationality:
              passportData.personalData?.nationality ||
              passportData.nationality,
            issuingState:
              passportData.personalData?.issuingState ||
              passportData.issuingState,
            dateOfBirth:
              passportData.personalData?.dateOfBirth ||
              passportData.dateOfBirth,
            dateOfExpiry:
              passportData.personalData?.dateOfExpiry ||
              passportData.dateOfExpiry,
            gender: passportData.personalData?.gender || passportData.gender,
            documentNumber:
              passportData.personalData?.documentNumber ||
              passportData.documentNumber,
            documentType:
              passportData.personalData?.documentType ||
              passportData.documentType ||
              "P",
          },
        };

        // Check eligibility using PassportVerificationService
        const eligibilityCheck = PassportVerificationService.checkEligibility(
          passportForVerification,
          restrictions,
        );

        setIsEligible(eligibilityCheck.eligible);
        if (!eligibilityCheck.eligible) {
          setEligibilityReason(
            eligibilityCheck.reason || "Not eligible to vote",
          );
        }
      } catch (error) {
        setIsEligible(false);
        setEligibilityReason("Error verifying eligibility");
      }
    } else if (!passportData) {
      setIsEligible(false);
      setEligibilityReason("Passport verification required");
    }
  }, [passportData, allowedCountries, minAgeRange, voteData.restrictions]);

  // Initialize vote state from server data and persist locally per-wallet.
  useEffect(() => {
    let cancelled = false;

    const hydrateVote = async () => {
      const serverVote = userVote || voteData.userVote || null;
      if (
        serverVote !== null &&
        serverVote !== undefined &&
        `${serverVote}`.trim().length > 0
      ) {
        if (!cancelled) {
          setLocalVote(serverVote);
        }
        try {
          await AsyncStorage.setItem(voteChoiceStorageKey, String(serverVote));
        } catch {
          // ignore storage sync issues
        }
        return;
      }

      if (hasVoted) {
        if (!cancelled) {
          setLocalVote("__voted__");
        }
        return;
      }

      try {
        const storedVote = await AsyncStorage.getItem(voteChoiceStorageKey);
        if (!cancelled) {
          setLocalVote(
            storedVote && storedVote.trim().length > 0 ? storedVote : null,
          );
        }
      } catch {
        if (!cancelled) {
          setLocalVote(null);
        }
      }
    };

    hydrateVote();
    return () => {
      cancelled = true;
    };
  }, [postId, userVote, voteData.userVote, hasVoted, voteChoiceStorageKey]);

  // Sync local vote data when prop changes (for feed refreshes)
  useEffect(() => {
    setLocalVoteData(voteData);
  }, [voteData]);

  useEffect(() => {
    let cancelled = false;
    const loadLatestReceipt = async () => {
      try {
        const stored = await AsyncStorage.getItem(
          `vote_receipt_latest:${postId}`,
        );
        if (!stored) {
          return;
        }
        const parsed = JSON.parse(stored);
        if (!parsed?.nullifier || cancelled) {
          return;
        }

        const draftReceipt = {
          nullifier: parsed.nullifier as string,
          status: (parsed.status as string) || "queued",
          proofHash: parsed.proofHash as string | undefined,
          txHash: parsed.txHash as string | undefined,
          publisherAddress: parsed.publisherAddress as string | undefined,
          paymasterAddress: parsed.paymasterAddress as string | undefined,
        };
        setLastVoteReceipt(draftReceipt);
        setLocalVote((current) => current ?? "__voted__");

        const apiService = ApiService.getInstance();
        const result = await apiService.getVoteReceipt(
          postId,
          draftReceipt.nullifier,
        );
        if (!result.success || cancelled) {
          return;
        }

        const onChain = result.data?.onChain?.onChain === true;
        const remoteReceipt = result.data?.receipt;
        const onChainData = result.data?.onChain;
        const updatedReceipt = {
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

        setLastVoteReceipt(updatedReceipt);
        setLocalVote((current) => current ?? "__voted__");
        await AsyncStorage.setItem(
          `vote_receipt_latest:${postId}`,
          JSON.stringify(updatedReceipt),
        );
      } catch {
        // ignore receipt hydration errors
      }
    };

    loadLatestReceipt();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  useEffect(() => {
    setShowReceiptDetails(false);
  }, [postId]);

  const handleVerifyReceipt = async () => {
    if (!lastVoteReceipt?.nullifier) {
      return;
    }

    setIsCheckingReceipt(true);
    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.getVoteReceipt(
        postId,
        lastVoteReceipt.nullifier,
      );
      if (!result.success) {
        throw new Error(result.error || "Failed to verify vote receipt");
      }

      const onChain = result.data?.onChain?.onChain === true;
      const remoteReceipt = result.data?.receipt;
      const onChainData = result.data?.onChain;
      const updatedReceipt = {
        nullifier: lastVoteReceipt.nullifier,
        status: onChain
          ? "published"
          : remoteReceipt?.status || lastVoteReceipt.status,
        proofHash: remoteReceipt?.proofHash || lastVoteReceipt.proofHash,
        txHash:
          onChainData?.txHash ||
          remoteReceipt?.txHash ||
          lastVoteReceipt.txHash,
        publisherAddress:
          onChainData?.publisherAddress ||
          remoteReceipt?.publisherAddress ||
          lastVoteReceipt.publisherAddress,
        paymasterAddress:
          onChainData?.paymasterAddress ||
          remoteReceipt?.paymasterAddress ||
          lastVoteReceipt.paymasterAddress,
      };

      setLastVoteReceipt(updatedReceipt);
      await AsyncStorage.setItem(
        `vote_receipt_latest:${postId}`,
        JSON.stringify(updatedReceipt),
      );
      Toast.success(
        onChain
          ? t("voting.voteReceiptConfirmed")
          : t("voting.voteReceiptStatus", { status: updatedReceipt.status }),
      );
    } catch (error: any) {
      Toast.error(error?.message || t("voting.voteReceiptVerifyFailed"));
    } finally {
      setIsCheckingReceipt(false);
    }
  };

  // Calculate totals and percentages using local data
  const hasVotingOptions =
    Array.isArray(localVoteData?.options) && localVoteData.options.length > 0;

  if (!hasVotingOptions) {
    return null;
  }

  const totalVotes =
    localVoteData.totalVotes ||
    localVoteData.options.reduce((sum, opt) => sum + (opt.count || 0), 0);

  // Function to translate common voting option labels
  const translateOptionLabel = (option: {
    id: string | number;
    label: string;
  }): string => {
    const candidates = [option.id, option.label]
      .map((value) =>
        String(value || "")
          .trim()
          .toLowerCase(),
      )
      .filter(
        (value, index, collection) =>
          value.length > 0 && collection.indexOf(value) === index,
      );

    for (const candidate of candidates) {
      const translated = t(`voting.options.${candidate}`);
      if (translated && !translated.includes("voting.options.")) {
        return translated;
      }
    }

    return option.label;
  };

  // Ensure percentages are calculated and labels are localized
  const optionsWithPercentages = localVoteData.options.map((option) => ({
    ...option,
    count: option.count || 0,
    label: translateOptionLabel(option),
    percentage:
      option.percentage ||
      (totalVotes > 0
        ? Math.round(((option.count || 0) / totalVotes) * 100)
        : 0),
  }));
  const hasSelectableOptions = optionsWithPercentages.length > 0;
  const shouldShowRestrictions =
    requiresVerification ||
    minAgeRange ||
    (Array.isArray(allowedCountries) && allowedCountries.length > 0) ||
    voteData.restrictions;

  const handleVoteClick = (voteOption: string | number) => {
    if (isVotingDisabled) {
      if (guestMessage) {
        Toast.info(guestMessage);
      }
      return;
    }

    if (Platform.OS === "web") {
      Toast.info(t("voting.webDemoDisabled"));
      return;
    }

    // Check voting eligibility
    const eligibility = checkVotingEligibility(
      passportData,
      voteData.restrictions,
    );

    if (!eligibility.eligible) {
      Toast.error(eligibility.details || t("voting.notEligible"));
      return;
    }

    if (!passportData) {
      Toast.warning(t("voting.needPassportVerification"));
      return;
    }

    if (localVote) {
      Toast.info(t("voting.alreadyVoted"));
      return;
    }

    // Show approval dialog
    setSelectedVote(voteOption);
    setVotingStatus("preparing");
    setShowApprovalDialog(true);
  };

  const handleConfirmVote = async () => {
    if (!selectedVote) return;
    if (isVotingDisabled) {
      setShowApprovalDialog(false);
      return;
    }

    setIsVoting(true);
    setVotingStatus("submitting");

    try {
      // Find the label for the vote option
      let voteLabel = String(selectedVote);
      if (localVoteData.options) {
        const option = localVoteData.options.find(
          (opt) => String(opt.id) === String(selectedVote),
        );
        voteLabel = option ? option.label : String(selectedVote);
      }

      // If wallet available, send to server with Merkle proof verification
      if (wallet) {
        let verificationProof = null;

        // Generate Merkle proof if passport data is available (server requires proof for ALL votes)
        if (passportData) {
          try {
            // Use server-provided restrictions, fallback to legacy, then defaults
            const restrictions = {
              minAgeRange:
                minAgeRange || voteData.restrictions?.minAgeRange || 1,
              allowedCountries: allowedCountries ||
                voteData.restrictions?.allowedCountries || [
                  "RUS",
                  "UKR",
                  "KAZ",
                  "BLR",
                  "USA",
                  "GBR",
                ],
            };

            // Convert passport data to expected format
            const passportForVerification = {
              personalData: {
                firstName:
                  passportData.personalData?.firstName ||
                  passportData.firstName,
                lastName:
                  passportData.personalData?.lastName || passportData.lastName,
                nationality:
                  passportData.personalData?.nationality ||
                  passportData.nationality,
                issuingState:
                  passportData.personalData?.issuingState ||
                  passportData.issuingState,
                dateOfBirth:
                  passportData.personalData?.dateOfBirth ||
                  passportData.dateOfBirth,
                dateOfExpiry:
                  passportData.personalData?.dateOfExpiry ||
                  passportData.dateOfExpiry,
                gender:
                  passportData.personalData?.gender || passportData.gender,
                documentNumber:
                  passportData.personalData?.documentNumber ||
                  passportData.documentNumber,
                documentType:
                  passportData.personalData?.documentType ||
                  passportData.documentType ||
                  "P",
              },
            };

            // Get API nonce for verification proof
            const apiService = ApiService.getInstance();
            const apiNonce = await apiService.getNonce(wallet.address);

            // Generate Merkle proof using PassportVerificationService with API nonce
            verificationProof =
              await PassportVerificationService.generateVerificationProof(
                passportForVerification,
                restrictions,
                wallet, // Will use WalletService internally
                apiNonce, // Pass API nonce for proper string formatting
                postId, // Pass postId for EIP-712 signing
                selectedVote.toString(), // Pass voteOption for EIP-712 signing
              );
          } catch (proofError) {
            throw new Error(t("errors.privacyProofFailed"));
          }
        } else {
          // Server requires age and nationality proofs for all votes
          throw new Error(t("errors.passportRequired"));
        }

        // Vote using ApiService directly with verification proof
        const apiService = ApiService.getInstance();

        const voteResult = await apiService.voteOnPost(
          postId,
          selectedVote,
          verificationProof,
        );

        if (!voteResult.success) {
          const serverReason =
            (voteResult as any)?.serverResponse?.reason ||
            (voteResult as any)?.serverResponse?.details ||
            (voteResult as any)?.serverResponse?.error;
          throw new Error(
            serverReason ||
              voteResult.error ||
              t("errors.voteSubmissionFailed"),
          );
        }

        const voteReceipt = voteResult.data?.voteReceipt;
        if (voteReceipt?.nullifier) {
          try {
            await AsyncStorage.setItem(
              `vote_receipt_latest:${postId}`,
              JSON.stringify(voteReceipt),
            );
          } catch {}
          setLastVoteReceipt({
            nullifier: voteReceipt.nullifier,
            status: voteReceipt.status || "queued",
            proofHash: voteReceipt.proofHash,
            txHash: voteReceipt.txHash,
            publisherAddress: voteReceipt.publisherAddress,
            paymasterAddress: voteReceipt.paymasterAddress,
          });
          setShowReceiptDetails(false);
        }

        // Use server's verification proof if available
        if (voteResult.data && voteResult.data.verificationProof) {
          verificationProof = voteResult.data.verificationProof;
        }
      }

      // Only update local state AFTER server confirmation (no local storage)
      setLocalVote(selectedVote);
      try {
        await AsyncStorage.setItem(voteChoiceStorageKey, String(selectedVote));
      } catch {
        // ignore storage write issues
      }

      // Update local vote counts immediately for better UX
      const updatedOptions = localVoteData.options.map((option) => {
        if (String(option.id) === String(selectedVote)) {
          return {
            ...option,
            count: option.count + 1,
          };
        }
        return option;
      });

      const updatedTotalVotes = localVoteData.totalVotes + 1;
      const updatedVoteData = {
        ...localVoteData,
        options: updatedOptions.map((option) => ({
          ...option,
          percentage: Math.round((option.count / updatedTotalVotes) * 100),
        })),
        totalVotes: updatedTotalVotes,
      };

      setLocalVoteData(updatedVoteData);
      setVotingStatus("success");
      Toast.success(t("voting.voteRecorded", { option: voteLabel }));

      // Close dialog after a brief delay
      setTimeout(() => {
        setShowApprovalDialog(false);
        setSelectedVote(null);
      }, 1500);
    } catch (error: any) {
      // No need to revert localVote since we never set it until success
      setVotingStatus("error");

      // Show user-friendly error messages
      if (error.message.includes("privacy proof")) {
        Toast.error(t("errors.privacyVerificationFailed"));
      } else if (error.message.includes("eligible")) {
        Toast.error(t("voting.notEligible"));
      } else {
        Toast.error(error?.message || t("errors.voteRecordFailed"));
      }
    } finally {
      setIsVoting(false);
    }
  };

  const handleCancelVote = () => {
    setShowApprovalDialog(false);
    setSelectedVote(null);
    setVotingStatus("preparing");
  };

  const formatDeadline = (deadline?: string) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff < 0) return t("voting.votingClosed");
    if (days > 0) {
      // Direct access to the translation based on count for better compatibility
      const translationKey =
        days === 1 ? "voting.daysRemaining.one" : "voting.daysRemaining.other";
      return t(translationKey, { count: days });
    }
    if (hours > 0) {
      // Direct access to the translation based on count for better compatibility
      const translationKey =
        hours === 1
          ? "voting.hoursRemaining.one"
          : "voting.hoursRemaining.other";
      return t(translationKey, { count: hours });
    }
    return t("voting.closingSoon");
  };

  return (
    <View style={styles.container}>
      {/* Voting Restrictions */}
      {shouldShowRestrictions && (
        <View style={styles.restrictionsContainer}>
          <Icon
            name="info"
            size={14}
            color={theme.textSecondary}
            variant="outline"
          />
          <Text style={styles.restrictionsText}>
            {requiresVerification && (minAgeRange || allowedCountries)
              ? formatMerkleRestrictions(minAgeRange, allowedCountries)
              : voteData.restrictions
                ? formatRestrictions(voteData.restrictions)
                : t("voting.verificationRequired")}
          </Text>
        </View>
      )}

      {/* Options with Progress Bars */}
      {hasSelectableOptions ? (
        <View style={styles.optionsContainer}>
          {optionsWithPercentages.map((option) => {
            const isLeading =
              option.percentage ===
              Math.max(...optionsWithPercentages.map((o) => o.percentage));
            const isUserVote = localVote === option.id;

            return (
              <View key={option.id} style={styles.optionItem}>
                {/* Option Header */}
                <View style={styles.optionHeader}>
                  <Text
                    style={[
                      styles.optionLabel,
                      isUserVote && styles.optionLabelActive,
                    ]}
                  >
                    {option.label}
                    {isUserVote ? ` • ${t("voting.yourChoice")}` : ""}
                  </Text>
                  <Text
                    style={[
                      styles.optionStats,
                      isUserVote && styles.optionStatsActive,
                    ]}
                  >
                    {(option.count || 0).toLocaleString()} ({option.percentage}
                    %)
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      isLeading && styles.progressFillLeading,
                      isUserVote && styles.progressFillActive,
                      { width: `${option.percentage}%` },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Anonymous Voting Note */}

      {/* Vote Stats Row */}
      <View
        style={[
          styles.voteStatsRow,
          !hasSelectableOptions && styles.voteStatsRowCompact,
        ]}
      >
        <Text style={styles.totalVotesCount}>
          {totalVotes.toLocaleString()}{" "}
          {totalVotes === 1
            ? t("voting.singleVote")
            : t("voting.multipleVotes")}
        </Text>
        {voteData.deadline && (
          <>
            <Text style={styles.statsDot}>•</Text>
            <Text style={styles.deadlineText}>
              {formatDeadline(voteData.deadline)}
            </Text>
          </>
        )}
      </View>

      {lastVoteReceipt && (
        <View style={styles.receiptRow}>
          <View style={styles.receiptInlineRow}>
            <Text
              style={styles.receiptText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t("voting.voteReceiptLabel")}:{" "}
              {truncateMiddle(lastVoteReceipt.nullifier, 10, 6)} (
              {lastVoteReceipt.status})
            </Text>
            {compactReceipt ? (
              <TouchableOpacity
                style={styles.receiptIconButton}
                onPress={onOpenDetails}
                accessibilityRole="button"
                accessibilityLabel={t("postDetail.menuShowDetails")}
              >
                <Icon
                  name="chevron-right"
                  size={14}
                  color={theme.textSecondary}
                  variant="outline"
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.receiptButton}
                onPress={() => setShowReceiptDetails((prev) => !prev)}
              >
                <Text style={styles.receiptButtonText}>
                  {showReceiptDetails
                    ? t("common.showLess")
                    : t("common.readMore")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {showReceiptDetails && !compactReceipt ? (
            <View style={styles.receiptDetailsBox}>
              <Text style={styles.receiptDetailLine}>
                {t("voting.voteReceiptStatusLabel")}: {lastVoteReceipt.status}
              </Text>
              <Text style={styles.receiptDetailLine}>
                {t("voting.voteReceiptNullifierLabel")}:{" "}
                {truncateMiddle(lastVoteReceipt.nullifier)}
              </Text>
              {lastVoteReceipt.proofHash ? (
                <Text style={styles.receiptDetailLine}>
                  {t("voting.voteReceiptProofHashLabel")}:{" "}
                  {truncateMiddle(lastVoteReceipt.proofHash)}
                </Text>
              ) : null}
              {lastVoteReceipt.txHash ? (
                <Text style={styles.receiptDetailLine}>
                  {t("voting.voteReceiptTxHashLabel")}:{" "}
                  {truncateMiddle(lastVoteReceipt.txHash)}
                </Text>
              ) : null}
              {lastVoteReceipt.publisherAddress ? (
                <Text style={styles.receiptDetailLine}>
                  {t("voting.voteReceiptPublisherLabel")}:{" "}
                  {truncateMiddle(lastVoteReceipt.publisherAddress)}
                </Text>
              ) : null}
              {lastVoteReceipt.paymasterAddress ? (
                <Text style={styles.receiptDetailLine}>
                  {t("voting.voteReceiptPaymasterLabel")}:{" "}
                  {truncateMiddle(lastVoteReceipt.paymasterAddress)}
                </Text>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.receiptButton,
                  isCheckingReceipt && styles.receiptButtonDisabled,
                ]}
                onPress={handleVerifyReceipt}
                disabled={isCheckingReceipt}
              >
                <Text style={styles.receiptButtonText}>
                  {isCheckingReceipt
                    ? t("voting.voteReceiptChecking")
                    : t("voting.voteReceiptCheck")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* Voting Interface */}
      {!localVote && isVotingDisabled && hasSelectableOptions ? (
        <View style={styles.disabledVotingContainer}>
          <Text style={styles.disabledVotingText}>
            {guestMessage || t("voting.temporarilyUnavailable")}
          </Text>
        </View>
      ) : !wallet ? (
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => {
            navigation.navigate("Auth");
          }}
        >
          <Icon
            name="passport"
            variant="outline"
            size={16}
            color="#FFFFFF"
            style={styles.buttonIcon}
          />
          <Text style={styles.signInButtonText}>
            {t("auth.signInWithPassport")}
          </Text>
        </TouchableOpacity>
      ) : !localVote &&
        passportData &&
        Platform.OS !== "web" &&
        !isEligible ? null : !localVote && // Hide ineligible block
        passportData &&
        Platform.OS !== "web" &&
        isEligible &&
        hasSelectableOptions ? (
        <>
          <View style={styles.voteButtons}>
            {optionsWithPercentages.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.voteButton,
                  isVotingDisabled && styles.voteButtonDisabled,
                  optionsWithPercentages.length > 2 && styles.voteButtonMulti,
                ]}
                onPress={() => handleVoteClick(option.id)}
                disabled={isVoting || isVotingDisabled}
              >
                <Text style={styles.voteButtonText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Anonymous voting notice - only shown with voting buttons */}
          <View style={styles.anonymousContainer}>
            <Icon
              name="shield-checkmark"
              size={12}
              color={theme.success}
              variant="filled"
            />
            <Text style={styles.anonymousNotice}>
              {t("voting.anonymousVoting")} • {t("voting.privacyProtected")}
            </Text>
          </View>
        </>
      ) : !localVote &&
        !passportData &&
        Platform.OS !== "web" &&
        hasSelectableOptions ? (
        <View style={styles.ineligibleContainer}>
          <Text style={styles.ineligibleTitle}>{t("voting.verifyToVote")}</Text>
          <Text style={styles.ineligibleReason}>
            {t("voting.scanPassportToVote")}
          </Text>
          <TouchableOpacity
            style={styles.scanPassportButton}
            onPress={() => navigation.navigate("PassportScan" as never)}
          >
            <Text style={styles.scanPassportButtonText}>
              {t("auth.verifyIdentity")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : localVote ? null : Platform.OS === "web" && hasSelectableOptions ? ( // User vote info is now shown in the option label
        <View style={styles.webNotice}>
          <Text style={styles.webNoticeText}>{t("voting.mobileOnly")}</Text>
        </View>
      ) : hasSelectableOptions ? (
        <View style={styles.noWalletNotice}>
          <Text style={styles.noWalletText}>{t("voting.connectWallet")}</Text>
        </View>
      ) : null}

      {/* Voting Approval Modal */}
      <Modal
        visible={showApprovalDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelVote}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t("voting.confirmVote")}</Text>

            {/* Proposal Content */}
            {proposalContent && (
              <View style={styles.proposalContainer}>
                <Text style={styles.proposalText}>
                  {proposalContent.length > 300
                    ? proposalContent.substring(0, 300) + "..."
                    : proposalContent}
                </Text>
              </View>
            )}

            {selectedVote && (
              <View style={styles.selectedVoteContainer}>
                <Text style={styles.selectedVoteLabel}>
                  {t("voting.youAreVotingFor")}
                </Text>
                <Text style={styles.selectedVoteOption}>
                  {optionsWithPercentages.find(
                    (o) => String(o.id) === String(selectedVote),
                  )?.label || String(selectedVote)}
                </Text>
              </View>
            )}

            {/* Voting Status */}
            <View style={styles.statusContainer}>
              {votingStatus === "submitting" && (
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={styles.statusText}>
                    {t("voting.submittingVote")}
                  </Text>
                </View>
              )}

              {votingStatus === "success" && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusIcon}>✅</Text>
                  <Text style={[styles.statusText, styles.statusSuccess]}>
                    {t("voting.voteRecordedSuccess")}
                  </Text>
                </View>
              )}

              {votingStatus === "error" && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusIcon}>❌</Text>
                  <Text style={[styles.statusText, styles.statusError]}>
                    {t("voting.voteFailed")}
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.modalButtons}>
              {votingStatus === "preparing" && (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={handleCancelVote}
                  >
                    <Text style={styles.cancelButtonText}>
                      {t("common.cancel")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handleConfirmVote}
                  >
                    <Text style={styles.confirmButtonText}>
                      {t("voting.confirmVote")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {votingStatus === "submitting" && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.disabledButton]}
                  disabled={true}
                >
                  <Text style={styles.disabledButtonText}>
                    {t("voting.processing")}
                  </Text>
                </TouchableOpacity>
              )}

              {(votingStatus === "success" || votingStatus === "error") && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleCancelVote}
                >
                  <Text style={styles.confirmButtonText}>
                    {t("common.close")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Anonymous voting notice */}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    container: {
      marginTop: 4,
      paddingTop: 0,
    },
    optionsContainer: {
      marginBottom: 10,
    },
    optionItem: {
      marginBottom: 10,
    },
    optionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    optionLabel: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "500",
      flex: 1,
    },
    optionLabelActive: {
      fontWeight: "700",
      color: theme.primary,
    },
    optionStats: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 8,
    },
    optionStatsActive: {
      fontWeight: "600",
      color: theme.primary,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.border,
      borderRadius: 4,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.textTertiary,
      borderRadius: 4,
    },
    progressFillLeading: {
      backgroundColor: theme.primary,
    },
    progressFillActive: {
      backgroundColor: theme.success,
    },
    voteButtons: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 10,
    },
    voteButton: {
      flexGrow: 1,
      minWidth: "45%",
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 9999,
      alignItems: "center",
      backgroundColor: theme.primary,
    },
    voteButtonMulti: {
      minWidth: "30%",
    },
    voteButtonDisabled: {
      opacity: 0.55,
    },
    voteButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
    disabledVotingContainer: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      marginBottom: 12,
    },
    disabledVotingText: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
    },
    verifyButton: {
      backgroundColor: theme.primary,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 9999,
      alignSelf: "flex-start",
      marginBottom: 8,
    },
    verifyButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
    voteStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    voteStatsRowCompact: {
      paddingTop: 0,
      borderTopWidth: 0,
    },
    totalVotesCount: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    statsDot: {
      fontSize: 13,
      color: theme.textTertiary,
      marginHorizontal: 8,
    },
    deadlineText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    receiptText: {
      fontSize: 12,
      color: theme.textSecondary,
      flex: 1,
    },
    receiptRow: {
      marginBottom: 8,
      gap: 4,
    },
    receiptInlineRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    receiptButton: {
      alignSelf: "flex-start",
      backgroundColor: theme.surface,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    receiptButtonDisabled: {
      opacity: 0.6,
    },
    receiptButtonText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    receiptIconButton: {
      height: 24,
      width: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    receiptDetailsBox: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 8,
      gap: 4,
    },
    receiptDetailLine: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: "monospace",
    },
    restrictionsContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 6,
      marginBottom: 10,
    },
    restrictionsText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 6,
      flex: 1,
    },
    verificationNote: {
      fontSize: 11,
      color: theme.success,
      marginTop: 4,
      fontStyle: "italic",
    },
    anonymousNote: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: "rgba(29, 155, 240, 0.1)",
      borderRadius: 8,
      marginBottom: 12,
      alignItems: "center",
    },
    anonymousText: {
      fontSize: 13,
      color: theme.primaryDark,
      fontWeight: "500",
    },
    signInButton: {
      backgroundColor: theme.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 25,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    signInButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
      marginLeft: 8,
    },
    buttonIcon: {
      marginRight: 4,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    modalContainer: {
      backgroundColor: theme.modalBackground,
      borderRadius: 16,
      paddingVertical: 24,
      paddingHorizontal: 20,
      minWidth: "90%",
      maxWidth: 400,
      elevation: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
      marginBottom: 16,
    },
    proposalContainer: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
    },
    proposalText: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      fontStyle: "italic",
    },
    selectedVoteContainer: {
      backgroundColor: "rgba(29, 155, 240, 0.1)",
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.primaryLight,
    },
    selectedVoteLabel: {
      fontSize: 14,
      color: theme.primaryDark,
      marginBottom: 8,
      textAlign: "center",
    },
    selectedVoteOption: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },
    statusContainer: {
      marginBottom: 24,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
    },
    statusIcon: {
      fontSize: 18,
      marginRight: 8,
    },
    statusText: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    statusSuccess: {
      color: theme.success,
    },
    statusError: {
      color: theme.error,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 16,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 25,
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    confirmButton: {
      backgroundColor: theme.primary,
    },
    disabledButton: {
      backgroundColor: theme.surface,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    disabledButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.textTertiary,
    },
    anonymousContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
      paddingVertical: 4,
    },
    anonymousNotice: {
      fontSize: 11,
      color: theme.success,
      fontWeight: "500",
      marginLeft: 4,
    },
    ineligibleContainer: {
      padding: 16,
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    ineligibleTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
      textAlign: "center",
    },
    ineligibleReason: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 16,
      lineHeight: 20,
      maxWidth: 280,
    },
    scanPassportButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 9999,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    scanPassportButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    webNotice: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    webNoticeText: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
    },
    noWalletNotice: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    noWalletText: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
    },
  });

export default VotingCard;
