import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Toast from '../utils/Toast';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import Icon from './Icon';
import { voteOnPostAsync } from '../store/socialSlice';
import { checkVotingEligibility, formatRestrictions, formatMerkleRestrictions } from '../utils/votingEligibility';
import { useNavigation } from '../contexts/NavigationContext';
import PassportVerificationService from '../services/PassportVerificationService';
import ApiService from '../services/ApiService';
import { useLocalization } from '../hooks/useLocalization';

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
}

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
  proposalContent
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t } = useLocalization();
  const passportData = useSelector((state: RootState) => state.auth.passportData);
  const wallet = useSelector((state: RootState) => state.auth.wallet);
  const [localVote, setLocalVote] = useState<string | number | null>(userVote || voteData.userVote || null);
  const [localVoteData, setLocalVoteData] = useState(voteData); // Track updated vote data
  const [isVoting, setIsVoting] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | number | null>(null);
  const [votingStatus, setVotingStatus] = useState<'preparing' | 'submitting' | 'success' | 'error'>('preparing');
  const [isEligible, setIsEligible] = useState<boolean>(true);
  const [eligibilityReason, setEligibilityReason] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const voteAnonymously = true; // All votes are anonymous

  // Check voting eligibility based on passport data and restrictions
  useEffect(() => {
    if (passportData && (allowedCountries || minAgeRange)) {
      try {
        // Use server-provided restrictions, fallback to legacy, then defaults
        const restrictions = {
          minAgeRange: minAgeRange || voteData.restrictions?.minAgeRange || 1,
          allowedCountries: allowedCountries || voteData.restrictions?.allowedCountries || ['RUS', 'UKR', 'KAZ', 'BLR', 'USA', 'GBR']
        };

        // Convert passport data to expected format for eligibility check
        const passportForVerification = {
          personalData: {
            firstName: passportData.personalData?.firstName || passportData.firstName,
            lastName: passportData.personalData?.lastName || passportData.lastName,
            nationality: passportData.personalData?.nationality || passportData.nationality,
            issuingState: passportData.personalData?.issuingState || passportData.issuingState,
            dateOfBirth: passportData.personalData?.dateOfBirth || passportData.dateOfBirth,
            dateOfExpiry: passportData.personalData?.dateOfExpiry || passportData.dateOfExpiry,
            gender: passportData.personalData?.gender || passportData.gender,
            documentNumber: passportData.personalData?.documentNumber || passportData.documentNumber,
            documentType: passportData.personalData?.documentType || passportData.documentType || 'P',
          }
        };

        // Check eligibility using PassportVerificationService
        const eligibilityCheck = PassportVerificationService.checkEligibility(
          passportForVerification,
          restrictions
        );

        setIsEligible(eligibilityCheck.eligible);
        if (!eligibilityCheck.eligible) {
          setEligibilityReason(eligibilityCheck.reason || 'Not eligible to vote');
        }
      } catch (error) {
        setIsEligible(false);
        setEligibilityReason('Error verifying eligibility');
      }
    } else if (!passportData) {
      setIsEligible(false);
      setEligibilityReason('Passport verification required');
    }
  }, [passportData, allowedCountries, minAgeRange, voteData.restrictions]);

  // Initialize vote state from server data (no more local storage)
  useEffect(() => {
    // Priority: component userVote prop -> voteData.userVote -> null
    const serverVote = userVote || voteData.userVote || null;
    
    if (serverVote) {
      setLocalVote(serverVote);
    } else {
      setLocalVote(null);
    }
  }, [postId, userVote, voteData.userVote]);

  // Sync local vote data when prop changes (for feed refreshes)
  useEffect(() => {
    setLocalVoteData(voteData);
  }, [voteData]);

  // Calculate totals and percentages using local data
  const totalVotes = localVoteData.totalVotes || localVoteData.options.reduce((sum, opt) => sum + (opt.count || 0), 0);
  
  // Function to translate common voting option labels
  const translateOptionLabel = (label: string): string => {
    // Check if the label (lowercase) matches a translation key
    const labelKey = label.toLowerCase();
    const translationKey = `voting.options.${labelKey}`;

    // Try to get translation, fall back to original label if not found
    const translated = t(translationKey);

    // If translation exists and is different from the key, use it
    if (translated && !translated.includes('voting.options.')) {
      return translated;
    }

    // Return original label if no translation found
    return label;
  };

  // Ensure percentages are calculated and labels are localized
  const optionsWithPercentages = localVoteData.options.map(option => ({
    ...option,
    count: option.count || 0,
    label: translateOptionLabel(option.label),
    percentage: option.percentage || (totalVotes > 0 ? Math.round(((option.count || 0) / totalVotes) * 100) : 0)
  }));

  const handleVoteClick = (voteOption: string | number) => {
    if (Platform.OS === 'web') {
      Toast.info(t('voting.webDemoDisabled'));
      return;
    }

    // Check voting eligibility
    const eligibility = checkVotingEligibility(passportData, voteData.restrictions);
    
    if (!eligibility.eligible) {
      Toast.error(eligibility.details || t('voting.notEligible'));
      return;
    }

    if (!passportData) {
      Toast.warning(t('voting.needPassportVerification'));
      return;
    }

    if (localVote) {
      Toast.info(t('voting.alreadyVoted'));
      return;
    }

    // Show approval dialog
    setSelectedVote(voteOption);
    setVotingStatus('preparing');
    setShowApprovalDialog(true);
  };

  const handleConfirmVote = async () => {
    if (!selectedVote) return;

    setIsVoting(true);
    setVotingStatus('submitting');
    
    try {
      // Find the label for the vote option
      let voteLabel = String(selectedVote);
      if (localVoteData.options) {
        const option = localVoteData.options.find(opt => String(opt.id) === String(selectedVote));
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
              minAgeRange: minAgeRange || voteData.restrictions?.minAgeRange || 1,
              allowedCountries: allowedCountries || voteData.restrictions?.allowedCountries || ['RUS', 'UKR', 'KAZ', 'BLR', 'USA', 'GBR']
            };
            
            // Convert passport data to expected format
            const passportForVerification = {
              personalData: {
                firstName: passportData.personalData?.firstName || passportData.firstName,
                lastName: passportData.personalData?.lastName || passportData.lastName,
                nationality: passportData.personalData?.nationality || passportData.nationality,
                issuingState: passportData.personalData?.issuingState || passportData.issuingState,
                dateOfBirth: passportData.personalData?.dateOfBirth || passportData.dateOfBirth,
                dateOfExpiry: passportData.personalData?.dateOfExpiry || passportData.dateOfExpiry,
                gender: passportData.personalData?.gender || passportData.gender,
                documentNumber: passportData.personalData?.documentNumber || passportData.documentNumber,
                documentType: passportData.personalData?.documentType || passportData.documentType || 'P',
              }
            };

            // Get API nonce for verification proof
            const apiService = ApiService.getInstance();
            const apiNonce = await apiService.getNonce(wallet.address);

            // Generate Merkle proof using PassportVerificationService with API nonce
            verificationProof = await PassportVerificationService.generateVerificationProof(
              passportForVerification,
              restrictions,
              wallet, // Will use WalletService internally
              apiNonce, // Pass API nonce for proper string formatting
              postId, // Pass postId for EIP-712 signing
              selectedVote.toString() // Pass voteOption for EIP-712 signing
            );
          } catch (proofError) {
            throw new Error(t('errors.privacyProofFailed'));
          }
        } else {
          // Server requires age and nationality proofs for all votes
          throw new Error(t('errors.passportRequired'));
        }
        
        // Vote using ApiService directly with verification proof
        const apiService = ApiService.getInstance();
        
        const voteResult = await apiService.voteOnPost(
          postId, 
          selectedVote,
          verificationProof
        );
        
        if (!voteResult.success) {
          throw new Error(voteResult.error || t('errors.voteSubmissionFailed'));
        }
        
        // Use server's verification proof if available
        if (voteResult.data && voteResult.data.verificationProof) {
          verificationProof = voteResult.data.verificationProof;
        }
      }
      
      // Only update local state AFTER server confirmation (no local storage)
      setLocalVote(selectedVote);
      
      // Update local vote counts immediately for better UX
      const updatedOptions = localVoteData.options.map(option => {
        if (String(option.id) === String(selectedVote)) {
          return {
            ...option,
            count: option.count + 1
          };
        }
        return option;
      });
      
      const updatedTotalVotes = localVoteData.totalVotes + 1;
      const updatedVoteData = {
        ...localVoteData,
        options: updatedOptions.map(option => ({
          ...option,
          percentage: Math.round((option.count / updatedTotalVotes) * 100)
        })),
        totalVotes: updatedTotalVotes
      };
      
      setLocalVoteData(updatedVoteData);
      setVotingStatus('success');
      Toast.success(t('voting.voteRecorded', { option: voteLabel }));
      
      // Close dialog after a brief delay
      setTimeout(() => {
        setShowApprovalDialog(false);
        setSelectedVote(null);
      }, 1500);
      
    } catch (error: any) {
      // No need to revert localVote since we never set it until success
      setVotingStatus('error');
      
      // Show user-friendly error messages
      if (error.message.includes('privacy proof')) {
        Toast.error(t('errors.privacyVerificationFailed'));
      } else if (error.message.includes('eligible')) {
        Toast.error(t('voting.notEligible'));
      } else {
        Toast.error(t('errors.voteRecordFailed'));
      }
    } finally {
      setIsVoting(false);
    }
  };

  const handleCancelVote = () => {
    setShowApprovalDialog(false);
    setSelectedVote(null);
    setVotingStatus('preparing');
  };

  const formatDeadline = (deadline?: string) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diff < 0) return t('voting.votingClosed');
    if (days > 0) {
      // Direct access to the translation based on count for better compatibility
      const translationKey = days === 1 ? 'voting.daysRemaining.one' : 'voting.daysRemaining.other';
      return t(translationKey, { count: days });
    }
    if (hours > 0) {
      // Direct access to the translation based on count for better compatibility
      const translationKey = hours === 1 ? 'voting.hoursRemaining.one' : 'voting.hoursRemaining.other';
      return t(translationKey, { count: hours });
    }
    return t('voting.closingSoon');
  };

  // Truncate text if needed
  const MAX_LENGTH = 200;
  const shouldTruncate = proposalContent && proposalContent.length > MAX_LENGTH;
  const displayedContent = proposalContent && !isExpanded && shouldTruncate
    ? proposalContent.substring(0, MAX_LENGTH) + '...'
    : proposalContent;

  return (
    <View style={styles.container}>
      {/* Proposal Content with Read More */}
      {proposalContent && (
        <View style={styles.proposalContentContainer}>
          <Text style={styles.proposalContentText}>
            {displayedContent}
          </Text>
          {shouldTruncate && (
            <TouchableOpacity
              onPress={() => setIsExpanded(!isExpanded)}
              style={styles.readMoreButton}
            >
              <Text style={styles.readMoreText}>
                {isExpanded ? t('common.showLess') || 'Show Less' : t('common.readMore') || 'Read More'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Voting Restrictions */}
      {(requiresVerification || minAgeRange || allowedCountries || voteData.restrictions) && (
        <View style={styles.restrictionsContainer}>
          <Icon name="info" size={14} color="#6B7280" variant="outline" />
          <Text style={styles.restrictionsText}>
            {requiresVerification && (minAgeRange || allowedCountries) 
              ? formatMerkleRestrictions(minAgeRange, allowedCountries)
              : voteData.restrictions 
                ? formatRestrictions(voteData.restrictions)
                : t('voting.verificationRequired')
            }
          </Text>
        </View>
      )}
      
      {/* Options with Progress Bars */}
      <View style={styles.optionsContainer}>
        {optionsWithPercentages.map((option, index) => {
          const isLeading = option.percentage === Math.max(...optionsWithPercentages.map(o => o.percentage));
          const isUserVote = localVote === option.id;
          
          return (
            <View key={option.id} style={styles.optionItem}>
              {/* Option Header */}
              <View style={styles.optionHeader}>
                <Text style={[styles.optionLabel, isUserVote && styles.optionLabelActive]}>
                  {option.label}{isUserVote ? ` • ${t('voting.yourChoice')}` : ''}
                </Text>
                <Text style={[styles.optionStats, isUserVote && styles.optionStatsActive]}>
                  {(option.count || 0).toLocaleString()} ({option.percentage}%)
                </Text>
              </View>
              
              {/* Progress Bar */}
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    isLeading && styles.progressFillLeading,
                    isUserVote && styles.progressFillActive,
                    { width: `${option.percentage}%` }
                  ]} 
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Anonymous Voting Note */}
     


      {/* Vote Stats Row */}
      <View style={styles.voteStatsRow}>
        <Text style={styles.totalVotesCount}>
          {totalVotes.toLocaleString()} {totalVotes === 1 ? t('voting.singleVote') : t('voting.multipleVotes')}
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

      {/* Voting Interface */}
      {!wallet ? (
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => {
            navigation.navigate('Auth');
          }}
        >
          <Icon name="passport" variant="outline" size={16} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.signInButtonText}>{t('auth.signInWithPassport')}</Text>
        </TouchableOpacity>
      ) : !localVote && passportData && Platform.OS !== 'web' && !isEligible ? (
        null // Hide ineligible block
      ) : !localVote && passportData && Platform.OS !== 'web' && isEligible ? (
        <>
          <View style={styles.voteButtons}>
            {optionsWithPercentages.map((option) => (
              <TouchableOpacity 
                key={option.id}
                style={[
                  styles.voteButton,
                  optionsWithPercentages.length > 2 && styles.voteButtonMulti
                ]}
                onPress={() => handleVoteClick(option.id)}
                disabled={isVoting}
              >
                <Text style={styles.voteButtonText}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Anonymous voting notice - only shown with voting buttons */}
          <View style={styles.anonymousContainer}>
            <Icon name="shield-checkmark" size={12} color="#10B981" variant="filled" />
            <Text style={styles.anonymousNotice}>
              {t('voting.anonymousVoting')} • {t('voting.privacyProtected')}
            </Text>
          </View>
        </>
      ) : !localVote && !passportData && Platform.OS !== 'web' ? (
        <View style={styles.ineligibleContainer}>
          <Text style={styles.ineligibleTitle}>{t('voting.verifyToVote')}</Text>
          <Text style={styles.ineligibleReason}>{t('voting.scanPassportToVote')}</Text>
          <TouchableOpacity 
            style={styles.scanPassportButton}
            onPress={() => navigation.navigate('PassportScan' as never)}
          >
            <Text style={styles.scanPassportButtonText}>{t('auth.verifyIdentity')}</Text>
          </TouchableOpacity>
        </View>
      ) : !localVote && !passportData && Platform.OS !== 'web' ? (
        <View style={styles.ineligibleContainer}>
          <Text style={styles.ineligibleTitle}>{t('voting.verifyToVote')}</Text>
          <Text style={styles.ineligibleReason}>{t('voting.scanPassportToVote')}</Text>
          <TouchableOpacity 
            style={styles.scanPassportButton}
            onPress={() => navigation.navigate('PassportScan' as never)}
          >
            <Text style={styles.scanPassportButtonText}>{t('auth.verifyIdentity')}</Text>
          </TouchableOpacity>
        </View>
      ) : localVote ? (
        null // User vote info is now shown in the option label
      ) : Platform.OS === 'web' ? (
        <View style={styles.webNotice}>
          <Text style={styles.webNoticeText}>
            {t('voting.mobileOnly')}
          </Text>
        </View>
      ) : (
        <View style={styles.noWalletNotice}>
          <Text style={styles.noWalletText}>
            {t('voting.connectWallet')}
          </Text>
        </View>
      )}

      {/* Voting Approval Modal */}
      <Modal
        visible={showApprovalDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelVote}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t('voting.confirmVote')}</Text>
            
            {/* Proposal Content */}
            {proposalContent && (
              <View style={styles.proposalContainer}>
                <Text style={styles.proposalText}>
                  {proposalContent.length > 300 ? proposalContent.substring(0, 300) + '...' : proposalContent}
                </Text>
              </View>
            )}
            
            {selectedVote && (
              <View style={styles.selectedVoteContainer}>
                <Text style={styles.selectedVoteLabel}>
                  {t('voting.youAreVotingFor')}
                </Text>
                <Text style={styles.selectedVoteOption}>
                  {optionsWithPercentages.find(o => String(o.id) === String(selectedVote))?.label || String(selectedVote)}
                </Text>
              </View>
            )}

            {/* Voting Status */}
            <View style={styles.statusContainer}>
              
              
              {votingStatus === 'submitting' && (
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" color="#1D9BF0" />
                  <Text style={styles.statusText}>{t('voting.submittingVote')}</Text>
                </View>
              )}
              
              {votingStatus === 'success' && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusIcon}>✅</Text>
                  <Text style={[styles.statusText, styles.statusSuccess]}>{t('voting.voteRecordedSuccess')}</Text>
                </View>
              )}
              
              {votingStatus === 'error' && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusIcon}>❌</Text>
                  <Text style={[styles.statusText, styles.statusError]}>{t('voting.voteFailed')}</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.modalButtons}>
              {votingStatus === 'preparing' && (
                <>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={handleCancelVote}
                  >
                    <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handleConfirmVote}
                  >
                    <Text style={styles.confirmButtonText}>{t('voting.confirmVote')}</Text>
                  </TouchableOpacity>
                </>
              )}
              
              {votingStatus === 'submitting' && (
                <TouchableOpacity 
                  style={[styles.modalButton, styles.disabledButton]}
                  disabled={true}
                >
                  <Text style={styles.disabledButtonText}>{t('voting.processing')}</Text>
                </TouchableOpacity>
              )}
              
              {(votingStatus === 'success' || votingStatus === 'error') && (
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleCancelVote}
                >
                  <Text style={styles.confirmButtonText}>{t('common.close')}</Text>
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

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingTop: 0,
  },
  optionsContainer: {
    marginBottom: 12,
  },
  optionItem: {
    marginBottom: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  optionLabel: {
    fontSize: 14,
    color: '#0F1419',
    fontWeight: '500',
    flex: 1,
  },
  optionLabelActive: {
    fontWeight: '700',
    color: '#1D9BF0',
  },
  optionStats: {
    fontSize: 13,
    color: '#536471',
    marginLeft: 8,
  },
  optionStatsActive: {
    fontWeight: '600',
    color: '#1D9BF0',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#EFF3F4',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B98A5',
    borderRadius: 4,
  },
  progressFillLeading: {
    backgroundColor: '#1D9BF0',
  },
  progressFillActive: {
    backgroundColor: '#00BA7C',
  },
  voteButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  voteButton: {
    flexGrow: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 9999,
    alignItems: 'center',
    backgroundColor: '#1D9BF0',
  },
  voteButtonMulti: {
    minWidth: '30%',
  },
  voteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: '#1D9BF0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  voteStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalVotesCount: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  statsDot: {
    fontSize: 13,
    color: '#9CA3AF',
    marginHorizontal: 8,
  },
  deadlineText: {
    fontSize: 13,
    color: '#6B7280',
  },
  restrictionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  restrictionsText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  verificationNote: {
    fontSize: 11,
    color: '#065F46',
    marginTop: 4,
    fontStyle: 'italic',
  },
  anonymousNote: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  anonymousText: {
    fontSize: 13,
    color: '#0369A1',
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: '#1D9BF0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D9BF0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    minWidth: '90%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F1419',
    textAlign: 'center',
    marginBottom: 16,
  },
  proposalContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#1D9BF0',
  },
  proposalText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  selectedVoteContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  selectedVoteLabel: {
    fontSize: 14,
    color: '#0369A1',
    marginBottom: 8,
    textAlign: 'center',
  },
  selectedVoteOption: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0C4A6E',
    textAlign: 'center',
  },
  statusContainer: {
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  statusIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#536471',
    fontWeight: '500',
  },
  statusSuccess: {
    color: '#059669',
  },
  statusError: {
    color: '#DC2626',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  confirmButton: {
    backgroundColor: '#1D9BF0',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  anonymousContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 6,
  },
  anonymousNotice: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
  },
  ineligibleContainer: {
    padding: 16,
    backgroundColor: '#F7F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFF3F4',
    alignItems: 'center',
  },
  ineligibleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1419',
    marginBottom: 6,
    textAlign: 'center',
  },
  ineligibleReason: {
    fontSize: 14,
    color: '#536471',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    maxWidth: 280,
  },
  scanPassportButton: {
    backgroundColor: '#1D9BF0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
    shadowColor: '#1D9BF0',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  scanPassportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  proposalContentContainer: {
    marginBottom: 8,
    paddingBottom: 0,
  },
  proposalContentText: {
    fontSize: 15,
    color: '#0F1419',
    lineHeight: 22,
  },
  readMoreButton: {
    marginTop: 8,
  },
  readMoreText: {
    fontSize: 15,
    color: '#1D9BF0',
    fontWeight: '600',
  },
});

export default VotingCard;