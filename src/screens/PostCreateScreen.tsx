import React, { useState } from 'react';
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
} from 'react-native';
import Toast from '../utils/Toast';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { createPostAsync } from '../store/socialSlice';
import { useNavigation } from '../contexts/NavigationContext';
import { useLocalization } from '../hooks/useLocalization';

interface PostCreateScreenProps {
  navigation?: any;
  route?: any;
}

interface VoteOption {
  id: string;
  label: string;
}

// Common country codes for quick reference
const COMMON_COUNTRIES = [
  { code: 'USA', name: 'United States' },
  { code: 'CAN', name: 'Canada' },
  { code: 'MEX', name: 'Mexico' },
  { code: 'GBR', name: 'United Kingdom' },
  { code: 'FRA', name: 'France' },
  { code: 'DEU', name: 'Germany' },
  { code: 'JPN', name: 'Japan' },
  { code: 'CHN', name: 'China' },
  { code: 'IND', name: 'India' },
  { code: 'BRA', name: 'Brazil' },
  { code: 'RUS', name: 'Russia' },
  { code: 'AUS', name: 'Australia' },
];

const PostCreateScreen: React.FC<PostCreateScreenProps> = ({ navigation: navProp, route }) => {
  const { t } = useLocalization();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const wallet = useSelector((state: RootState) => state.auth.wallet);
  const passportData = useSelector((state: RootState) => state.auth.passportData);
  
  const [content, setContent] = useState('');
  const [isProposal, setIsProposal] = useState(true);
  const [proposalTitle, setProposalTitle] = useState('');
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([
    { id: '1', label: t('proposalCreate.agree') },
    { id: '2', label: t('proposalCreate.disagree') },
  ]);
  const [deadlineDays, setDeadlineDays] = useState('7');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [requirePassport, setRequirePassport] = useState(true);
  const [allowedNationalities, setAllowedNationalities] = useState('');
  const [excludedNationalities, setExcludedNationalities] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  const maxContentLength = 500;
  const remainingChars = maxContentLength - content.length;

  const handleClose = () => {
    console.log('[PostCreateScreen] Navigating back to feed');
    try {
      // Always navigate to Feed screen
      navigation.navigate('Feed');
    } catch (error) {
      console.warn('[PostCreateScreen] Navigation failed, trying alternative:', error);
      // Fallback: try using prop navigation
      if (navProp) {
        navProp.goBack();
      } else {
        console.error('[PostCreateScreen] No navigation available');
      }
    }
  };

  const addVoteOption = () => {
    if (voteOptions.length < 10) {
      const newId = (voteOptions.length + 1).toString();
      setVoteOptions([...voteOptions, { id: newId, label: `Option ${newId}` }]);
    } else {
      Toast.warning(t('proposalCreate.maximumTenOptions'));
    }
  };

  const removeVoteOption = (id: string) => {
    if (voteOptions.length > 2) {
      setVoteOptions(voteOptions.filter(opt => opt.id !== id));
    } else {
      Toast.warning(t('proposalCreate.minimumTwoOptionsRequired'));
    }
  };

  const updateVoteOption = (id: string, label: string) => {
    setVoteOptions(voteOptions.map(opt => 
      opt.id === id ? { ...opt, label } : opt
    ));
  };

  const handlePost = async () => {
    if (!content.trim()) {
      Toast.error(t('proposalCreate.pleaseEnterContent'));
      return;
    }

    if (isProposal) {
      if (!proposalTitle.trim()) {
        Toast.error(t('proposalCreate.pleaseEnterTitle'));
        return;
      }

      // Validate vote options
      const validOptions = voteOptions.filter(opt => opt.label.trim());
      if (validOptions.length < 2) {
        Toast.error(t('proposalCreate.minimumTwoOptions'));
        return;
      }

      if (!deadlineDays || parseInt(deadlineDays) < 1) {
        Toast.error(t('proposalCreate.setValidDeadline'));
        return;
      }
    }

    setIsPosting(true);

    try {
      let finalContent = content;
      let voteData = null;
      
      // Format content and prepare vote data for proposal
      if (isProposal) {
        finalContent = `🗳️ PROPOSAL: ${proposalTitle}\n\n${content}`;
        
        // Calculate deadline
        const daysNum = parseInt(deadlineDays) || 7;
        const deadline = new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000).toISOString();
        
        // Prepare vote options with initial counts
        const options = voteOptions
          .filter(opt => opt.label.trim())
          .map((opt, index) => ({
            id: opt.id,
            label: opt.label.trim(),
            count: 0,
            percentage: 0,
          }));
        
        // Build restrictions
        const restrictions: any = {
          verificationLevel: requirePassport ? 'passport' : 'any',
        };
        
        if (minAge && parseInt(minAge) > 0) {
          restrictions.minAge = parseInt(minAge);
        }
        
        if (maxAge && parseInt(maxAge) > 0) {
          restrictions.maxAge = parseInt(maxAge);
        }
        
        // Parse nationality restrictions (comma-separated country codes)
        if (allowedNationalities.trim()) {
          restrictions.allowedNationalities = allowedNationalities
            .split(',')
            .map(code => code.trim().toUpperCase())
            .filter(code => code.length > 0);
        }
        
        if (excludedNationalities.trim()) {
          restrictions.excludedNationalities = excludedNationalities
            .split(',')
            .map(code => code.trim().toUpperCase())
            .filter(code => code.length > 0);
        }
        
        voteData = {
          options,
          totalVotes: 0,
          deadline,
          restrictions,
        };
      }

      // Create post via API only
      if (!wallet) {
        Toast.error(t('proposalCreate.walletRequired'));
        return;
      }

      // Use the async thunk to create post via API
      await dispatch(createPostAsync(finalContent) as any);

      // Show pending approval message
      Toast.success('Your proposal is pending approval');
      setTimeout(handleClose, 2000); // Close after 2 seconds to give user time to read
    } catch (error) {
      console.error('Failed to create post:', error);
      Toast.error('Failed to create post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  // Mock post creation removed - now using API only

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>{t('proposalCreate.createProposal')}</Text>
          
          <TouchableOpacity
            onPress={handlePost}
            disabled={!content.trim() || isPosting}
            style={[
              styles.postButton,
              (!content.trim() || isPosting) && styles.postButtonDisabled,
            ]}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[
                styles.postButtonText,
                (!content.trim() || isPosting) && styles.postButtonTextDisabled,
              ]}>{t('proposalCreate.post')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* Anonymous Toggle */}
          <View style={styles.proposalToggle}>
            <Text style={styles.proposalLabel}>{t('proposalCreate.postAnonymously')}</Text>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: '#767577', true: '#1D9BF0' }}
              thumbColor={isAnonymous ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          {/* Proposal Settings (if proposal) */}
          {isProposal && (
            <View style={styles.proposalSection}>
              {/* Proposal Title */}
              <TextInput
                style={styles.proposalTitleInput}
                placeholder={t('proposalCreate.proposalTitle')}
                placeholderTextColor="#536471"
                value={proposalTitle}
                onChangeText={setProposalTitle}
                maxLength={100}
              />
              
              {/* Voting Options */}
              <View style={styles.optionsContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('proposalCreate.votingOptions')}</Text>
                  {/* <TouchableOpacity onPress={addVoteOption} style={styles.addButton}>
                    <Text style={styles.addButtonText">+ Add Option</Text>
                  </TouchableOpacity> */}
                </View>
                
                {voteOptions.map((option, index) => (
                  <View key={option.id} style={styles.optionRow}>
                    <Text style={styles.optionNumber}>{index + 1}.</Text>
                    <TextInput
                      style={styles.optionInput}
                      value={option.label}
                      onChangeText={(text) => updateVoteOption(option.id, text)}
                      placeholder={`${t('proposalCreate.option')} ${index + 1}`}
                      placeholderTextColor="#536471"
                    />
                    {voteOptions.length > 2 && (
                      <TouchableOpacity 
                        onPress={() => removeVoteOption(option.id)}
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeButtonText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Deadline */}
              <View style={styles.deadlineContainer}>
                <Text style={styles.sectionTitle}>{t('proposalCreate.votingDeadline')}</Text>
                <View style={styles.deadlineRow}>
                  <TextInput
                    style={styles.deadlineInput}
                    value={deadlineDays}
                    onChangeText={setDeadlineDays}
                    keyboardType="numeric"
                    placeholder="7"
                    placeholderTextColor="#536471"
                  />
                  <Text style={styles.deadlineText}>{t('proposalCreate.daysFromNow')}</Text>
                </View>
              </View>

              {/* Voting Restrictions */}
              <View style={styles.restrictionsContainer}>
                <Text style={styles.sectionTitle}>{t('proposalCreate.votingRestrictions')}</Text>
                
                {/* Passport Requirement */}
                <View style={styles.restrictionRow}>
                  <Text style={styles.restrictionLabel}>{t('proposalCreate.requirePassportVerification')}</Text>
                  <Switch
                    value={requirePassport}
                    onValueChange={setRequirePassport}
                    trackColor={{ false: '#767577', true: '#1D9BF0' }}
                    thumbColor={requirePassport ? '#FFFFFF' : '#f4f3f4'}
                  />
                </View>

                {/* Age Restrictions */}
                <View style={styles.ageRow}>
                  <View style={styles.ageInput}>
                    <Text style={styles.ageLabel}>{t('proposalCreate.minAge')}</Text>
                    <TextInput
                      style={styles.ageTextInput}
                      value={minAge}
                      onChangeText={setMinAge}
                      keyboardType="numeric"
                      placeholder="18"
                      placeholderTextColor="#536471"
                    />
                  </View>
                  <View style={styles.ageInput}>
                    <Text style={styles.ageLabel}>{t('proposalCreate.maxAge')}</Text>
                    <TextInput
                      style={styles.ageTextInput}
                      value={maxAge}
                      onChangeText={setMaxAge}
                      keyboardType="numeric"
                      placeholder={t('proposalCreate.none')}
                      placeholderTextColor="#536471"
                    />
                  </View>
                </View>
                
                {/* Nationality Restrictions */}
                <View style={styles.nationalitySection}>
                  <Text style={styles.nationalityTitle}>{t('proposalCreate.nationalityRestrictions')}</Text>
                  <Text style={styles.nationalityHint}>{t('proposalCreate.enterCountryCodes')}</Text>
                  
                  {/* Common Country Codes Helper */}
                  <View style={styles.countryCodesHelper}>
                    <Text style={styles.helperTitle}>{t('proposalCreate.commonCodes')}</Text>
                    <View style={styles.countryCodesList}>
                      {COMMON_COUNTRIES.map((country, index) => (
                        <Text key={country.code} style={styles.countryCode}>
                          {country.code} ({country.name}){index < COMMON_COUNTRIES.length - 1 ? ', ' : ''}
                        </Text>
                      ))}
                    </View>
                  </View>
                  
                  <View style={styles.nationalityInputContainer}>
                    <Text style={styles.nationalityLabel}>{t('proposalCreate.allowOnlyTheseCountries')}</Text>
                    <TextInput
                      style={styles.nationalityInput}
                      value={allowedNationalities}
                      onChangeText={setAllowedNationalities}
                      placeholder="e.g., USA, CAN, MEX"
                      placeholderTextColor="#536471"
                      autoCapitalize="characters"
                      multiline
                    />
                    <Text style={styles.nationalityNote}>{t('proposalCreate.leaveEmptyToAllowAll')}</Text>
                  </View>
                  
                  <View style={styles.nationalityInputContainer}>
                    <Text style={styles.nationalityLabel}>{t('proposalCreate.excludeTheseCountries')}</Text>
                    <TextInput
                      style={styles.nationalityInput}
                      value={excludedNationalities}
                      onChangeText={setExcludedNationalities}
                      placeholder="e.g., RUS, CHN, IRN"
                      placeholderTextColor="#536471"
                      autoCapitalize="characters"
                      multiline
                    />
                    <Text style={styles.nationalityNote}>{t('proposalCreate.citizensCannotVote')}</Text>
                  </View>
                </View>
                
                {/* Restrictions Preview */}
                {(requirePassport || minAge || maxAge || allowedNationalities || excludedNationalities) && (
                  <View style={styles.restrictionsPreview}>
                    <Text style={styles.previewTitle}>{t('proposalCreate.votingRequirements')}</Text>
                    <Text style={styles.previewText}>
                      {[
                        requirePassport && t('proposalCreate.passportVerificationRequired'),
                        minAge && t('proposalCreate.minimumAge', { age: minAge }),
                        maxAge && t('proposalCreate.maximumAge', { age: maxAge }),
                        allowedNationalities && t('proposalCreate.onlyCitizensOf', { countries: allowedNationalities }),
                        excludedNationalities && t('proposalCreate.excludes', { countries: excludedNationalities }),
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Main Content Input */}
          <TextInput
            style={styles.textInput}
            placeholder={t('proposalCreate.describeProposal')}
            placeholderTextColor="#536471"
            multiline
            value={content}
            onChangeText={setContent}
            maxLength={maxContentLength}
            textAlignVertical="top"
            autoFocus={false}
          />

          {/* Character Counter */}
          <View style={styles.footer}>
            <Text style={[
              styles.charCounter,
              remainingChars < 50 && styles.charCounterWarning,
              remainingChars < 0 && styles.charCounterError,
            ]}>
              {remainingChars}
            </Text>
          </View>

          {/* Verified Badge Info */}
          {passportData && (
            <View style={styles.verifiedInfo}>
              <Text style={styles.verifiedIcon}>✓</Text>
              <Text style={styles.verifiedText}>
                {t('proposalCreate.postingAsVerified')}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    color: '#0F1419',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F1419',
  },
  postButton: {
    backgroundColor: '#1D9BF0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 9999,
    minWidth: 80,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#9BD9F0',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  postButtonTextDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  proposalToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
    marginBottom: 16,
  },
  proposalLabel: {
    fontSize: 16,
    color: '#0F1419',
    fontWeight: '500',
  },
  proposalSection: {
    marginBottom: 16,
  },
  proposalTitleInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F1419',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F4',
    paddingVertical: 12,
    marginBottom: 20,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    color: '#0F1419',
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1D9BF0',
    borderRadius: 20,
    shadowColor: '#1D9BF0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionNumber: {
    fontSize: 14,
    color: '#536471',
    marginRight: 8,
    width: 20,
  },
  optionInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F1419',
    borderWidth: 1,
    borderColor: '#EFF3F4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeButton: {
    marginLeft: 8,
    padding: 6,
  },
  removeButtonText: {
    fontSize: 20,
    color: '#EF4444',
  },
  deadlineContainer: {
    marginBottom: 20,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  deadlineInput: {
    width: 60,
    fontSize: 15,
    color: '#0F1419',
    borderWidth: 1,
    borderColor: '#EFF3F4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    textAlign: 'center',
  },
  deadlineText: {
    fontSize: 15,
    color: '#536471',
  },
  restrictionsContainer: {
    marginBottom: 20,
  },
  restrictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  restrictionLabel: {
    fontSize: 14,
    color: '#0F1419',
  },
  ageRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  ageInput: {
    flex: 1,
  },
  ageLabel: {
    fontSize: 13,
    color: '#536471',
    marginBottom: 6,
  },
  ageTextInput: {
    fontSize: 15,
    color: '#0F1419',
    borderWidth: 1,
    borderColor: '#EFF3F4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  nationalitySection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFF3F4',
  },
  nationalityTitle: {
    fontSize: 15,
    color: '#0F1419',
    fontWeight: '600',
    marginBottom: 4,
  },
  nationalityHint: {
    fontSize: 12,
    color: '#536471',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  countryCodesHelper: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#F7F9FA',
    borderRadius: 8,
  },
  helperTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#536471',
    marginBottom: 6,
  },
  countryCodesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  countryCode: {
    fontSize: 11,
    color: '#536471',
  },
  nationalityInputContainer: {
    marginBottom: 16,
  },
  nationalityLabel: {
    fontSize: 13,
    color: '#536471',
    marginBottom: 6,
    fontWeight: '500',
  },
  nationalityInput: {
    fontSize: 14,
    color: '#0F1419',
    borderWidth: 1,
    borderColor: '#EFF3F4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  nationalityNote: {
    fontSize: 11,
    color: '#536471',
    marginTop: 4,
    fontStyle: 'italic',
  },
  restrictionsPreview: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
    borderWidth: 1,
    borderRadius: 8,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#664D03',
    marginBottom: 6,
  },
  previewText: {
    fontSize: 12,
    color: '#664D03',
    lineHeight: 18,
  },
  textInput: {
    fontSize: 17,
    color: '#0F1419',
    lineHeight: 24,
    minHeight: 120,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFF3F4',
    marginTop: 20,
  },
  charCounter: {
    fontSize: 14,
    color: '#536471',
  },
  charCounterWarning: {
    color: '#F59E0B',
  },
  charCounterError: {
    color: '#EF4444',
  },
  verifiedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  verifiedIcon: {
    fontSize: 16,
    color: '#10B981',
    marginRight: 8,
  },
  verifiedText: {
    fontSize: 14,
    color: '#065F46',
  },
});

export default PostCreateScreen;