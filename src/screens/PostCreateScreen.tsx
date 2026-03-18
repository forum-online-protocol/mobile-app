import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Switch,
  ActivityIndicator,
  Modal,
} from "react-native";
import Toast from "../utils/Toast";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { createPostAsync } from "../store/socialSlice";
import { useNavigation } from "../contexts/NavigationContext";
import { useLocalization } from "../hooks/useLocalization";
import { useServerFeatureFlags } from "../hooks/useServerFeatureFlags";
import { useTheme } from "../contexts/ThemeContext";
import { hairlineWidth, radii, spacing, typography } from "../styles/tokens";
import { openExternalUrl } from "../utils/openExternalUrl";

interface PostCreateScreenProps {
  navigation?: any;
  route?: any;
}

// Common country codes for quick reference
const COMMON_COUNTRIES = [
  { code: "USA", name: "United States" },
  { code: "CAN", name: "Canada" },
  { code: "MEX", name: "Mexico" },
  { code: "GBR", name: "United Kingdom" },
  { code: "FRA", name: "France" },
  { code: "DEU", name: "Germany" },
  { code: "JPN", name: "Japan" },
  { code: "CHN", name: "China" },
  { code: "IND", name: "India" },
  { code: "BRA", name: "Brazil" },
  { code: "RUS", name: "Russia" },
  { code: "AUS", name: "Australia" },
];

const SAFETY_POLICY_URL =
  "https://github.com/forum-online-protocol/privacy-policy/blob/main/safety_policy.md";
const POSTING_RULES_URL =
  "https://github.com/forum-online-protocol/privacy-policy/blob/main/posting_rules.md";
const PRIVACY_POLICY_REPO_URL =
  "https://github.com/forum-online-protocol/privacy-policy";

const PostCreateScreen: React.FC<PostCreateScreenProps> = ({
  navigation: navProp,
  route,
}) => {
  const { t } = useLocalization();
  const { featureFlags } = useServerFeatureFlags();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch();
  const wallet = useSelector((state: RootState) => state.auth.wallet);
  const passportData = useSelector(
    (state: RootState) => state.auth.passportData,
  );

  const [content, setContent] = useState("");
  const [composerMode, setComposerMode] = useState<"post" | "proposal">("post");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [requirePassport, setRequirePassport] = useState(true);
  const [allowedNationalities, setAllowedNationalities] = useState("");
  const [excludedNationalities, setExcludedNationalities] = useState("");
  const [lotteryEnabled, setLotteryEnabled] = useState(false);
  const [lotteryOddsNumerator, setLotteryOddsNumerator] = useState("1");
  const [lotteryOddsDenominator, setLotteryOddsDenominator] = useState("1000");
  const [lotteryPayoutMode, setLotteryPayoutMode] = useState<"fixed" | "share">(
    "fixed",
  );
  const [lotteryFixedAmountEth, setLotteryFixedAmountEth] = useState("0.01");
  const [lotteryShareBps, setLotteryShareBps] = useState("500");
  const [lotteryClaimDays, setLotteryClaimDays] = useState("7");
  const [lotteryMaxWinners, setLotteryMaxWinners] = useState("10");
  const [lotteryMaxEntriesPerWallet, setLotteryMaxEntriesPerWallet] =
    useState("1");
  const [isPosting, setIsPosting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [hasAcceptedPostingRules, setHasAcceptedPostingRules] = useState(false);
  const isProposal = composerMode === "proposal";

  const maxContentLength = 500;
  const remainingChars = maxContentLength - content.length;
  const initiativeOptions = useMemo(
    () => [
      { id: "1", canonicalLabel: "agree", label: t("proposalCreate.agree") },
      {
        id: "2",
        canonicalLabel: "disagree",
        label: t("proposalCreate.disagree"),
      },
    ],
    [t],
  );

  useEffect(() => {
    if (!featureFlags.lotteryEnabled) {
      setLotteryEnabled(false);
    }
  }, [featureFlags.lotteryEnabled]);

  useEffect(() => {
    if (!featureFlags.anonymousPostingEnabled) {
      setIsAnonymous(false);
    }
  }, [featureFlags.anonymousPostingEnabled]);

  const handleClose = () => {
    console.log("[PostCreateScreen] Navigating back to feed");
    try {
      // Always navigate to Feed screen
      navigation.navigate("Feed");
    } catch (error) {
      console.warn(
        "[PostCreateScreen] Navigation failed, trying alternative:",
        error,
      );
      // Fallback: try using prop navigation
      if (navProp) {
        navProp.goBack();
      } else {
        console.error("[PostCreateScreen] No navigation available");
      }
    }
  };

  const handlePost = async () => {
    if (!hasAcceptedPostingRules) {
      Toast.error(t("proposalCreate.acceptPostingRules"));
      return;
    }

    if (!content.trim()) {
      Toast.error(t("proposalCreate.pleaseEnterContent"));
      return;
    }

    if (isProposal) {
      if (!deadlineDays || parseInt(deadlineDays) < 1) {
        Toast.error(t("proposalCreate.setValidDeadline"));
        return;
      }

      if (lotteryEnabled) {
        const oddsN = parseInt(lotteryOddsNumerator, 10);
        const oddsD = parseInt(lotteryOddsDenominator, 10);
        const claimDays = parseInt(lotteryClaimDays, 10);
        const maxWinners = parseInt(lotteryMaxWinners, 10);
        const maxEntries = parseInt(lotteryMaxEntriesPerWallet, 10);

        if (
          !Number.isFinite(oddsN) ||
          !Number.isFinite(oddsD) ||
          oddsN <= 0 ||
          oddsD <= 0 ||
          oddsN > oddsD
        ) {
          Toast.error(t("proposalCreate.lotteryInvalidOdds"));
          return;
        }

        if (!Number.isFinite(claimDays) || claimDays <= 0) {
          Toast.error(t("proposalCreate.lotteryClaimWindowInvalid"));
          return;
        }

        if (!Number.isFinite(maxWinners) || maxWinners <= 0) {
          Toast.error(t("proposalCreate.lotteryMaxWinnersInvalid"));
          return;
        }

        if (!Number.isFinite(maxEntries) || maxEntries <= 0) {
          Toast.error(t("proposalCreate.lotteryMaxEntriesInvalid"));
          return;
        }

        if (lotteryPayoutMode === "fixed") {
          const amount = Number(lotteryFixedAmountEth);
          if (!Number.isFinite(amount) || amount <= 0) {
            Toast.error(t("proposalCreate.lotteryFixedPayoutInvalid"));
            return;
          }
        } else {
          const share = parseInt(lotteryShareBps, 10);
          if (!Number.isFinite(share) || share <= 0 || share > 10000) {
            Toast.error(t("proposalCreate.lotteryShareInvalid"));
            return;
          }
        }
      }
    }

    setIsPosting(true);

    try {
      let voteData = null;

      // Prepare vote data for proposal
      if (isProposal) {
        const daysNum = parseInt(deadlineDays) || 7;
        const deadline = new Date(
          Date.now() + daysNum * 24 * 60 * 60 * 1000,
        ).toISOString();
        const options = initiativeOptions.map((option) => ({
          id: option.id,
          label: option.canonicalLabel,
          count: 0,
          percentage: 0,
        }));

        const restrictions: any = {
          verificationLevel: requirePassport ? "passport" : "any",
        };

        if (minAge && parseInt(minAge) > 0) {
          restrictions.minAge = parseInt(minAge);
        }

        if (maxAge && parseInt(maxAge) > 0) {
          restrictions.maxAge = parseInt(maxAge);
        }

        if (allowedNationalities.trim()) {
          restrictions.allowedNationalities = allowedNationalities
            .split(",")
            .map((code) => code.trim().toUpperCase())
            .filter((code) => code.length > 0);
        }

        if (excludedNationalities.trim()) {
          restrictions.excludedNationalities = excludedNationalities
            .split(",")
            .map((code) => code.trim().toUpperCase())
            .filter((code) => code.length > 0);
        }

        voteData = {
          options,
          totalVotes: 0,
          deadline,
          restrictions,
          lottery:
            lotteryEnabled && featureFlags.lotteryEnabled
              ? {
                  enabled: true,
                  oddsNumerator: parseInt(lotteryOddsNumerator, 10) || 1,
                  oddsDenominator: parseInt(lotteryOddsDenominator, 10) || 1000,
                  payoutMode: lotteryPayoutMode,
                  fixedAmountEth:
                    lotteryPayoutMode === "fixed"
                      ? lotteryFixedAmountEth
                      : undefined,
                  shareBps:
                    lotteryPayoutMode === "share"
                      ? parseInt(lotteryShareBps, 10) || 500
                      : undefined,
                  claimWindowSeconds:
                    (parseInt(lotteryClaimDays, 10) || 7) * 24 * 60 * 60,
                  maxWinners: parseInt(lotteryMaxWinners, 10) || 10,
                  maxEntriesPerWallet:
                    parseInt(lotteryMaxEntriesPerWallet, 10) || 1,
                }
              : undefined,
        };
      }

      if (!wallet) {
        Toast.error(t("proposalCreate.walletRequired"));
        return;
      }

      const result = await dispatch(
        createPostAsync({
          content: content.trim(),
          isProposal,
          voteData,
          isAnonymous,
          ipfsHash: "",
          replyTo: 0,
        }) as any,
      ).unwrap();

      if (
        result?.status === "pending_review" ||
        result?.submissionId ||
        result?.submission
      ) {
        Toast.success(t("proposalCreate.submittedForReview"));
      } else {
        Toast.success(t("proposalCreate.post"));
      }
      setTimeout(handleClose, 2000); // Close after 2 seconds to give user time to read
    } catch (error) {
      console.error("Failed to create post:", error);
      const message =
        error instanceof Error && error.message
          ? error.message.replace(/^HTTP\s+\d+:\s*/i, "").trim()
          : t("proposalCreate.failedToCreatePost");
      Toast.error(message || t("proposalCreate.failedToCreatePost"));
    } finally {
      setIsPosting(false);
    }
  };

  // Mock post creation removed - now using API only

  const openPolicy = async (url: string) => {
    try {
      await openExternalUrl([url, PRIVACY_POLICY_REPO_URL]);
    } catch {
      Toast.error(t("proposalCreate.openPolicyFailed"));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {isProposal
              ? t("proposalCreate.createProposal")
              : t("proposalCreate.createPost")}
          </Text>

          <TouchableOpacity
            onPress={handlePost}
            disabled={!content.trim() || isPosting || !hasAcceptedPostingRules}
            style={[
              styles.postButton,
              (!content.trim() || isPosting || !hasAcceptedPostingRules) &&
                styles.postButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("proposalCreate.post")}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Text
                style={[
                  styles.postButtonText,
                  (!content.trim() || isPosting || !hasAcceptedPostingRules) &&
                    styles.postButtonTextDisabled,
                ]}
              >
                {t("proposalCreate.post")}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[
                styles.modeToggleButton,
                composerMode === "post" && styles.modeToggleButtonActive,
              ]}
              onPress={() => setComposerMode("post")}
              accessibilityRole="button"
              accessibilityLabel={t("proposalCreate.createPost")}
            >
              <Text
                style={[
                  styles.modeToggleText,
                  composerMode === "post" && styles.modeToggleTextActive,
                ]}
              >
                {t("proposalCreate.quickPost")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeToggleButton,
                composerMode === "proposal" && styles.modeToggleButtonActive,
              ]}
              onPress={() => setComposerMode("proposal")}
              accessibilityRole="button"
              accessibilityLabel={t("proposalCreate.createProposal")}
            >
              <Text
                style={[
                  styles.modeToggleText,
                  composerMode === "proposal" && styles.modeToggleTextActive,
                ]}
              >
                {t("proposalCreate.advancedProposal")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Anonymous Toggle */}
          {featureFlags.anonymousPostingEnabled ? (
            <View style={styles.proposalToggle}>
              <Text style={styles.proposalLabel}>
                {t("proposalCreate.postAnonymously")}
              </Text>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: theme.textTertiary, true: theme.primary }}
                thumbColor={isAnonymous ? theme.onPrimary : theme.surface}
              />
            </View>
          ) : null}

          <View style={styles.policyConsentRow}>
            <TouchableOpacity
              style={[
                styles.policyCheckbox,
                hasAcceptedPostingRules && styles.policyCheckboxChecked,
              ]}
              onPress={() => setHasAcceptedPostingRules((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasAcceptedPostingRules }}
              accessibilityLabel={t("proposalCreate.postingConsent")}
            >
              {hasAcceptedPostingRules ? (
                <Text style={styles.policyCheckboxMark}>✓</Text>
              ) : null}
            </TouchableOpacity>
            <View style={styles.policyTextWrap}>
              <Text style={styles.policyText}>
                {t("proposalCreate.postingConsent")}
              </Text>
              <View style={styles.policyLinksRow}>
                <TouchableOpacity
                  onPress={() => void openPolicy(POSTING_RULES_URL)}
                  style={styles.policyLinkButton}
                >
                  <Text style={styles.policyLinkText}>
                    {t("proposalCreate.openPostingRules")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void openPolicy(SAFETY_POLICY_URL)}
                  style={styles.policyLinkButton}
                >
                  <Text style={styles.policyLinkText}>
                    {t("proposalCreate.openSafetyPolicy")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Main Content Input */}
          <View style={styles.contentFieldSection}>
            <Text style={styles.contentFieldLabel}>
              {isProposal
                ? t("proposalCreate.contentLabelProposal")
                : t("proposalCreate.contentLabelPost")}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={
                isProposal
                  ? t("proposalCreate.describeProposal")
                  : t("proposalCreate.whatsHappening")
              }
              placeholderTextColor={theme.placeholder}
              multiline
              value={content}
              onChangeText={setContent}
              maxLength={maxContentLength}
              textAlignVertical="top"
              autoFocus={false}
            />

            {/* Character Counter */}
            <View style={styles.footer}>
              <Text
                style={[
                  styles.charCounter,
                  remainingChars < 50 && styles.charCounterWarning,
                  remainingChars < 0 && styles.charCounterError,
                ]}
              >
                {remainingChars}
              </Text>
            </View>
          </View>

          {/* Proposal Settings (if proposal) */}
          {isProposal && (
            <View style={styles.proposalSection}>
              {/* Fixed Initiative Options */}
              <View style={styles.optionsContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {t("proposalCreate.votingOptions")}
                  </Text>
                </View>
                <Text style={styles.optionHint}>
                  {t("proposalCreate.fixedOptionsHint")}
                </Text>

                {initiativeOptions.map((option, index) => (
                  <View key={option.id} style={styles.optionRow}>
                    <Text style={styles.optionNumber}>{index + 1}.</Text>
                    <View style={styles.optionInput}>
                      <Text style={styles.optionValueText}>{option.label}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Deadline */}
              <View style={styles.deadlineContainer}>
                <Text style={styles.sectionTitle}>
                  {t("proposalCreate.votingDeadline")}
                </Text>
                <View style={styles.deadlineRow}>
                  <TextInput
                    style={styles.deadlineInput}
                    value={deadlineDays}
                    onChangeText={setDeadlineDays}
                    keyboardType="numeric"
                    placeholder="7"
                    placeholderTextColor={theme.placeholder}
                  />
                  <Text style={styles.deadlineText}>
                    {t("proposalCreate.daysFromNow")}
                  </Text>
                </View>
              </View>

              {/* Voting Restrictions */}
              <View style={styles.restrictionsContainer}>
                <Text style={styles.sectionTitle}>
                  {t("proposalCreate.votingRestrictions")}
                </Text>

                {/* Passport Requirement */}
                <View style={styles.restrictionRow}>
                  <Text style={styles.restrictionLabel}>
                    {t("proposalCreate.requirePassportVerification")}
                  </Text>
                  <Switch
                    value={requirePassport}
                    onValueChange={setRequirePassport}
                    trackColor={{
                      false: theme.textTertiary,
                      true: theme.primary,
                    }}
                    thumbColor={
                      requirePassport ? theme.onPrimary : theme.surface
                    }
                  />
                </View>

                {/* Age Restrictions */}
                <View style={styles.ageRow}>
                  <View style={styles.ageInput}>
                    <Text style={styles.ageLabel}>
                      {t("proposalCreate.minAge")}
                    </Text>
                    <TextInput
                      style={styles.ageTextInput}
                      value={minAge}
                      onChangeText={setMinAge}
                      keyboardType="numeric"
                      placeholder="18"
                      placeholderTextColor={theme.placeholder}
                    />
                  </View>
                  <View style={styles.ageInput}>
                    <Text style={styles.ageLabel}>
                      {t("proposalCreate.maxAge")}
                    </Text>
                    <TextInput
                      style={styles.ageTextInput}
                      value={maxAge}
                      onChangeText={setMaxAge}
                      keyboardType="numeric"
                      placeholder={t("proposalCreate.none")}
                      placeholderTextColor={theme.placeholder}
                    />
                  </View>
                </View>

                {/* Nationality Restrictions */}
                <View style={styles.nationalitySection}>
                  <Text style={styles.nationalityTitle}>
                    {t("proposalCreate.nationalityRestrictions")}
                  </Text>
                  <Text style={styles.nationalityHint}>
                    {t("proposalCreate.enterCountryCodes")}
                  </Text>

                  {/* Common Country Codes Helper */}
                  <View style={styles.countryCodesHelper}>
                    <Text style={styles.helperTitle}>
                      {t("proposalCreate.commonCodes")}
                    </Text>
                    <View style={styles.countryCodesList}>
                      {COMMON_COUNTRIES.map((country, index) => (
                        <Text key={country.code} style={styles.countryCode}>
                          {country.code} ({country.name})
                          {index < COMMON_COUNTRIES.length - 1 ? ", " : ""}
                        </Text>
                      ))}
                    </View>
                  </View>

                  <View style={styles.nationalityInputContainer}>
                    <Text style={styles.nationalityLabel}>
                      {t("proposalCreate.allowOnlyTheseCountries")}
                    </Text>
                    <TextInput
                      style={styles.nationalityInput}
                      value={allowedNationalities}
                      onChangeText={setAllowedNationalities}
                      placeholder={t("proposalCreate.exampleAllowedCountries")}
                      placeholderTextColor={theme.placeholder}
                      autoCapitalize="characters"
                      multiline
                    />
                    <Text style={styles.nationalityNote}>
                      {t("proposalCreate.leaveEmptyToAllowAll")}
                    </Text>
                  </View>

                  <View style={styles.nationalityInputContainer}>
                    <Text style={styles.nationalityLabel}>
                      {t("proposalCreate.excludeTheseCountries")}
                    </Text>
                    <TextInput
                      style={styles.nationalityInput}
                      value={excludedNationalities}
                      onChangeText={setExcludedNationalities}
                      placeholder={t("proposalCreate.exampleExcludedCountries")}
                      placeholderTextColor={theme.placeholder}
                      autoCapitalize="characters"
                      multiline
                    />
                    <Text style={styles.nationalityNote}>
                      {t("proposalCreate.citizensCannotVote")}
                    </Text>
                  </View>
                </View>

                {featureFlags.lotteryEnabled ? (
                  <View style={styles.lotterySection}>
                    <View style={styles.restrictionRow}>
                      <Text style={styles.restrictionLabel}>
                        {t("proposalCreate.lottery.enableForProposal")}
                      </Text>
                      <Switch
                        value={lotteryEnabled}
                        onValueChange={setLotteryEnabled}
                        trackColor={{
                          false: theme.textTertiary,
                          true: theme.primary,
                        }}
                        thumbColor={
                          lotteryEnabled ? theme.onPrimary : theme.surface
                        }
                      />
                    </View>

                    {lotteryEnabled && (
                      <View style={styles.lotteryConfig}>
                        <Text style={styles.lotteryHint}>
                          {t("proposalCreate.lottery.hint")}
                        </Text>

                        <View style={styles.lotteryRow}>
                          <View style={styles.lotteryInputGroup}>
                            <Text style={styles.ageLabel}>
                              {t("proposalCreate.lottery.oddsNumerator")}
                            </Text>
                            <TextInput
                              style={styles.ageTextInput}
                              value={lotteryOddsNumerator}
                              onChangeText={setLotteryOddsNumerator}
                              keyboardType="numeric"
                              placeholder="1"
                              placeholderTextColor={theme.placeholder}
                            />
                          </View>
                          <View style={styles.lotteryInputGroup}>
                            <Text style={styles.ageLabel}>
                              {t("proposalCreate.lottery.oddsDenominator")}
                            </Text>
                            <TextInput
                              style={styles.ageTextInput}
                              value={lotteryOddsDenominator}
                              onChangeText={setLotteryOddsDenominator}
                              keyboardType="numeric"
                              placeholder="1000"
                              placeholderTextColor={theme.placeholder}
                            />
                          </View>
                        </View>

                        <View style={styles.lotteryModeRow}>
                          <TouchableOpacity
                            onPress={() => setLotteryPayoutMode("fixed")}
                            style={[
                              styles.modeButton,
                              lotteryPayoutMode === "fixed" &&
                                styles.modeButtonActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.modeButtonText,
                                lotteryPayoutMode === "fixed" &&
                                  styles.modeButtonTextActive,
                              ]}
                            >
                              {t("proposalCreate.lottery.fixedAmount")}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setLotteryPayoutMode("share")}
                            style={[
                              styles.modeButton,
                              lotteryPayoutMode === "share" &&
                                styles.modeButtonActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.modeButtonText,
                                lotteryPayoutMode === "share" &&
                                  styles.modeButtonTextActive,
                              ]}
                            >
                              {t("proposalCreate.lottery.poolShare")}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {lotteryPayoutMode === "fixed" ? (
                          <View style={styles.lotteryInputGroup}>
                            <Text style={styles.ageLabel}>
                              {t("proposalCreate.lottery.fixedPayoutEth")}
                            </Text>
                            <TextInput
                              style={styles.ageTextInput}
                              value={lotteryFixedAmountEth}
                              onChangeText={setLotteryFixedAmountEth}
                              keyboardType="decimal-pad"
                              placeholder="0.01"
                              placeholderTextColor={theme.placeholder}
                            />
                          </View>
                        ) : (
                          <View style={styles.lotteryInputGroup}>
                            <Text style={styles.ageLabel}>
                              {t("proposalCreate.lottery.poolShareBps")}
                            </Text>
                            <TextInput
                              style={styles.ageTextInput}
                              value={lotteryShareBps}
                              onChangeText={setLotteryShareBps}
                              keyboardType="numeric"
                              placeholder="500"
                              placeholderTextColor={theme.placeholder}
                            />
                          </View>
                        )}

                        <View style={styles.lotteryRow}>
                          <View style={styles.lotteryInputGroup}>
                            <Text style={styles.ageLabel}>
                              {t("proposalCreate.lottery.claimWindowDays")}
                            </Text>
                            <TextInput
                              style={styles.ageTextInput}
                              value={lotteryClaimDays}
                              onChangeText={setLotteryClaimDays}
                              keyboardType="numeric"
                              placeholder="7"
                              placeholderTextColor={theme.placeholder}
                            />
                          </View>
                          <View style={styles.lotteryInputGroup}>
                            <Text style={styles.ageLabel}>
                              {t("proposalCreate.lottery.maxWinners")}
                            </Text>
                            <TextInput
                              style={styles.ageTextInput}
                              value={lotteryMaxWinners}
                              onChangeText={setLotteryMaxWinners}
                              keyboardType="numeric"
                              placeholder="10"
                              placeholderTextColor={theme.placeholder}
                            />
                          </View>
                        </View>

                        <View style={styles.lotteryInputGroup}>
                          <Text style={styles.ageLabel}>
                            {t("proposalCreate.lottery.maxEntriesPerWallet")}
                          </Text>
                          <TextInput
                            style={styles.ageTextInput}
                            value={lotteryMaxEntriesPerWallet}
                            onChangeText={setLotteryMaxEntriesPerWallet}
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor={theme.placeholder}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Restrictions Preview */}
                {(requirePassport ||
                  minAge ||
                  maxAge ||
                  allowedNationalities ||
                  excludedNationalities) && (
                  <View style={styles.restrictionsPreview}>
                    <Text style={styles.previewTitle}>
                      {t("proposalCreate.votingRequirements")}
                    </Text>
                    <Text style={styles.previewText}>
                      {[
                        requirePassport &&
                          t("proposalCreate.passportVerificationRequired"),
                        minAge &&
                          t("proposalCreate.minimumAge", { age: minAge }),
                        maxAge &&
                          t("proposalCreate.maximumAge", { age: maxAge }),
                        allowedNationalities &&
                          t("proposalCreate.onlyCitizensOf", {
                            countries: allowedNationalities,
                          }),
                        excludedNationalities &&
                          t("proposalCreate.excludes", {
                            countries: excludedNationalities,
                          }),
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Verified Badge Info */}
          {passportData && (
            <View style={styles.verifiedInfo}>
              <Text style={styles.verifiedIcon}>✓</Text>
              <Text style={styles.verifiedText}>
                {t("proposalCreate.postingAsVerified")}
              </Text>
            </View>
          )}
        </ScrollView>

        <Modal visible={isPosting} transparent animationType="fade">
          <View style={styles.postingOverlay}>
            <View style={styles.postingOverlayCard}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.postingOverlayText}>
                {t("common.loading")}
              </Text>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    keyboardAvoid: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.l,
      paddingVertical: spacing.m,
      borderBottomWidth: hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.headerBackground,
    },
    closeButton: {
      padding: spacing.s,
    },
    closeText: {
      fontSize: 24,
      color: theme.text,
    },
    headerTitle: {
      ...typography.headline,
      color: theme.text,
      fontWeight: "600",
    },
    postButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.s,
      borderRadius: radii.pill,
      minWidth: 80,
      alignItems: "center",
    },
    postButtonDisabled: {
      opacity: 0.55,
    },
    postButtonText: {
      ...typography.body,
      color: theme.onPrimary,
      fontWeight: "600",
    },
    postButtonTextDisabled: {
      opacity: 0.7,
    },
    content: {
      flex: 1,
      padding: spacing.l,
    },
    modeRow: {
      flexDirection: "row",
      gap: spacing.s,
      marginBottom: spacing.l,
    },
    modeToggleButton: {
      flex: 1,
      borderWidth: hairlineWidth,
      borderColor: theme.inputBorder,
      borderRadius: radii.pill,
      backgroundColor: theme.inputBackground,
      paddingVertical: spacing.s,
      alignItems: "center",
    },
    modeToggleButtonActive: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}22`,
    },
    modeToggleText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    modeToggleTextActive: {
      color: theme.primary,
    },
    proposalToggle: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.m,
      borderBottomWidth: hairlineWidth,
      borderBottomColor: theme.border,
      marginBottom: spacing.l,
    },
    proposalLabel: {
      ...typography.body,
      color: theme.text,
      fontWeight: "500",
    },
    proposalSection: {
      marginBottom: spacing.l,
    },
    policyConsentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.l,
      gap: spacing.s,
    },
    policyCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: hairlineWidth,
      borderColor: theme.inputBorder,
      backgroundColor: theme.inputBackground,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    policyCheckboxChecked: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}22`,
    },
    policyCheckboxMark: {
      ...typography.caption,
      color: theme.primary,
      fontWeight: "700",
    },
    policyTextWrap: {
      flex: 1,
    },
    policyText: {
      ...typography.caption,
      color: theme.text,
      lineHeight: 18,
    },
    policyLinksRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.s,
      marginTop: 4,
    },
    policyLinkButton: {
      alignSelf: "flex-start",
    },
    policyLinkText: {
      ...typography.caption,
      color: theme.primary,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    contentFieldSection: {
      marginBottom: spacing.xl,
    },
    contentFieldLabel: {
      ...typography.bodyStrong,
      color: theme.text,
      marginBottom: spacing.s,
    },
    optionsContainer: {
      marginBottom: spacing.xl,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.m,
    },
    sectionTitle: {
      ...typography.bodyStrong,
      color: theme.text,
    },
    optionHint: {
      ...typography.small,
      color: theme.textSecondary,
      marginBottom: spacing.s,
    },
    addButton: {
      paddingHorizontal: 14,
      paddingVertical: spacing.s,
      backgroundColor: theme.primary,
      borderRadius: radii.l,
    },
    addButtonText: {
      ...typography.caption,
      color: theme.onPrimary,
      fontWeight: "600",
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.s,
    },
    optionNumber: {
      ...typography.caption,
      color: theme.textSecondary,
      marginRight: spacing.s,
      width: 20,
    },
    optionInput: {
      flex: 1,
      borderWidth: hairlineWidth,
      borderColor: theme.inputBorder,
      borderRadius: radii.s,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      backgroundColor: theme.inputBackground,
      justifyContent: "center",
    },
    optionValueText: {
      ...typography.body,
      color: theme.inputText,
    },
    removeButton: {
      marginLeft: spacing.s,
      padding: 6,
    },
    removeButtonText: {
      fontSize: 20,
      color: theme.error,
    },
    deadlineContainer: {
      marginBottom: spacing.xl,
    },
    deadlineRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.s,
    },
    deadlineInput: {
      width: 60,
      ...typography.body,
      color: theme.inputText,
      borderWidth: hairlineWidth,
      borderColor: theme.inputBorder,
      borderRadius: radii.s,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      marginRight: spacing.s,
      textAlign: "center",
      backgroundColor: theme.inputBackground,
    },
    deadlineText: {
      ...typography.body,
      color: theme.textSecondary,
    },
    restrictionsContainer: {
      marginBottom: spacing.xl,
    },
    restrictionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.m,
      paddingVertical: spacing.s,
    },
    restrictionLabel: {
      ...typography.body,
      color: theme.text,
    },
    ageRow: {
      flexDirection: "row",
      marginTop: spacing.m,
      gap: spacing.l,
    },
    ageInput: {
      flex: 1,
    },
    ageLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      marginBottom: 6,
    },
    ageTextInput: {
      ...typography.body,
      color: theme.inputText,
      borderWidth: hairlineWidth,
      borderColor: theme.inputBorder,
      borderRadius: radii.s,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      textAlign: "center",
      backgroundColor: theme.inputBackground,
    },
    nationalitySection: {
      marginTop: spacing.xl,
      paddingTop: spacing.l,
      borderTopWidth: hairlineWidth,
      borderTopColor: theme.border,
    },
    nationalityTitle: {
      ...typography.bodyStrong,
      color: theme.text,
      marginBottom: spacing.xs,
    },
    nationalityHint: {
      ...typography.small,
      color: theme.textSecondary,
      marginBottom: spacing.s,
      fontStyle: "italic",
    },
    countryCodesHelper: {
      marginBottom: spacing.l,
      padding: spacing.s + 2,
      backgroundColor: theme.surface,
      borderRadius: radii.s,
    },
    helperTitle: {
      ...typography.small,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 6,
    },
    countryCodesList: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    countryCode: {
      ...typography.small,
      color: theme.textSecondary,
    },
    nationalityInputContainer: {
      marginBottom: spacing.l,
    },
    nationalityLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      marginBottom: 6,
      fontWeight: "500",
    },
    nationalityInput: {
      ...typography.body,
      color: theme.inputText,
      borderWidth: hairlineWidth,
      borderColor: theme.inputBorder,
      borderRadius: radii.s,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.m - 2,
      minHeight: 44,
      textAlignVertical: "top",
      backgroundColor: theme.inputBackground,
    },
    nationalityNote: {
      ...typography.small,
      color: theme.textSecondary,
      marginTop: spacing.xs,
      fontStyle: "italic",
    },
    restrictionsPreview: {
      marginTop: spacing.l,
      padding: spacing.m,
      backgroundColor: theme.surface,
      borderColor: theme.warning,
      borderWidth: hairlineWidth,
      borderRadius: radii.s,
    },
    previewTitle: {
      ...typography.caption,
      fontWeight: "700",
      color: theme.textSecondary,
      marginBottom: 6,
    },
    previewText: {
      ...typography.small,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    lotterySection: {
      marginTop: spacing.l,
      paddingTop: spacing.l,
      borderTopWidth: hairlineWidth,
      borderTopColor: theme.border,
    },
    lotteryConfig: {
      marginTop: spacing.m,
      gap: spacing.m,
    },
    lotteryHint: {
      ...typography.small,
      color: theme.textSecondary,
      fontStyle: "italic",
    },
    lotteryRow: {
      flexDirection: "row",
      gap: spacing.l,
    },
    lotteryInputGroup: {
      flex: 1,
    },
    lotteryModeRow: {
      flexDirection: "row",
      gap: spacing.s,
    },
    modeButton: {
      flex: 1,
      borderWidth: hairlineWidth,
      borderColor: theme.inputBorder,
      borderRadius: radii.s,
      paddingVertical: spacing.s,
      alignItems: "center",
      backgroundColor: theme.inputBackground,
    },
    modeButtonActive: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}22`,
    },
    modeButtonText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    modeButtonTextActive: {
      color: theme.primary,
    },
    textInput: {
      ...typography.body,
      color: theme.inputText,
      lineHeight: 24,
      minHeight: 120,
      borderWidth: hairlineWidth,
      borderColor: theme.inputBorder,
      borderRadius: radii.m,
      backgroundColor: theme.inputBackground,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.m,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingTop: spacing.s,
    },
    charCounter: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    charCounterWarning: {
      color: theme.warning,
    },
    charCounterError: {
      color: theme.error,
    },
    verifiedInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.l,
      padding: spacing.m,
      backgroundColor: "rgba(16, 185, 129, 0.1)",
      borderRadius: radii.s,
    },
    verifiedIcon: {
      fontSize: 16,
      color: theme.success,
      marginRight: spacing.s,
    },
    verifiedText: {
      ...typography.body,
      color: theme.success,
    },
    postingOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    postingOverlayCard: {
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
    postingOverlayText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontWeight: "600",
    },
  });

export default PostCreateScreen;
