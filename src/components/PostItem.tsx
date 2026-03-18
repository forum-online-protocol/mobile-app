import React, { useState } from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ActionSheetIOS, Platform} from 'react-native';
import {Post} from '../types/Post';
import {colors} from '../styles/globalStyles';
import { useLocalization } from '../hooks/useLocalization';
import {
  getPostDisplayContent,
  getPostDisplayTitle,
} from "../utils/localizedPost";

interface PostItemProps {
  post: Post;
}

const PostItem: React.FC<PostItemProps> = ({post}) => {
  const { t, currentLanguage } = useLocalization();
  const [showReportModal, setShowReportModal] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const displayTitle = getPostDisplayTitle(post, currentLanguage);
  const displayContent = getPostDisplayContent(post, currentLanguage);
  const REPORT_REASONS = [
    { id: 'spam', label: t('postItem.reasons.spam') },
    { id: 'harassment', label: t('postItem.reasons.harassment') },
    { id: 'hate', label: t('postItem.reasons.hate') },
    { id: 'violence', label: t('postItem.reasons.violence') },
    { id: 'csae', label: t('postItem.reasons.csae') },
    { id: 'nudity', label: t('postItem.reasons.nudity') },
    { id: 'false', label: t('postItem.reasons.false') },
    { id: 'other', label: t('postItem.reasons.other') },
  ];
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return t('common.now');
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d`;
    }
  };

  const handleReportPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), ...REPORT_REASONS.map(r => r.label)],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 5, // Child safety concerns
          title: t('postItem.reportPost'),
          message: t('postItem.reportReasonQuestion'),
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            submitReport(REPORT_REASONS[buttonIndex - 1].id);
          }
        }
      );
    } else {
      setShowReportModal(true);
    }
  };

  const submitReport = async (reasonId: string) => {
    setIsReporting(true);

    try {
      // In production, this would send to your backend
      console.log('[PostItem] Reporting post:', post.id, 'Reason:', reasonId);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      Alert.alert(
        t('postItem.reportSubmittedTitle'),
        t('postItem.reportSubmittedMessage'),
        [{ text: t('common.ok') }]
      );
    } catch (error) {
      console.error('[PostItem] Report error:', error);
      Alert.alert(t('common.error'), t('postItem.reportSubmitFailed'));
    } finally {
      setIsReporting(false);
      setShowReportModal(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {post.author ? post.author.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.author}>{post.author || t('userProfile.unknownUser')}</Text>
            <Text style={styles.username}>@{post.username || t('common.user')}</Text>
            <Text style={styles.timestamp}>· {formatDate(post.createdAt)}</Text>
          </View>
          <TouchableOpacity
            style={styles.moreButton}
            onPress={handleReportPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.moreButtonText}>•••</Text>
          </TouchableOpacity>
        </View>
        
        {displayTitle && (
          <Text style={styles.title}>{displayTitle}</Text>
        )}

        <Text style={styles.content}>{displayContent}</Text>
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>💬 {post.replies || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>🔄 {post.reposts || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>❤️ {post.likes || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleReportPress}>
            <Text style={styles.actionText}>🚩</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Report Modal for Android */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('postItem.reportPost')}</Text>
            <Text style={styles.modalSubtitle}>{t('postItem.reportReasonQuestion')}</Text>

            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reportOption,
                  reason.id === 'csae' && styles.reportOptionHighlight
                ]}
                onPress={() => submitReport(reason.id)}
                disabled={isReporting}>
                <Text style={[
                  styles.reportOptionText,
                  reason.id === 'csae' && styles.reportOptionTextHighlight
                ]}>
                  {reason.id === 'csae' ? '⚠️ ' : ''}{reason.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowReportModal(false)}
              disabled={isReporting}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.darkGray,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moreButton: {
    padding: 4,
  },
  moreButtonText: {
    color: colors.gray,
    fontSize: 16,
    fontWeight: 'bold',
  },
  author: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 4,
  },
  username: {
    color: colors.gray,
    fontSize: 16,
    marginRight: 4,
  },
  timestamp: {
    color: colors.gray,
    fontSize: 16,
  },
  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  content: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 300,
  },
  actionButton: {
    padding: 8,
  },
  actionText: {
    color: colors.gray,
    fontSize: 14,
  },
  // Report Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: 20,
  },
  reportOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.darkGray,
  },
  reportOptionHighlight: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
    borderBottomWidth: 0,
    marginVertical: 4,
  },
  reportOptionText: {
    fontSize: 16,
    color: colors.white,
  },
  reportOptionTextHighlight: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 16,
    backgroundColor: colors.darkGray,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.blue,
  },
});

export default PostItem;
