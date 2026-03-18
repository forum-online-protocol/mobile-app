import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, saveLanguagePreference } from '../localization/i18n';
import { useTheme } from '../contexts/ThemeContext';

interface LanguageSelectorProps {
  style?: any;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  style, 
  size = 'medium', 
  showLabel = true 
}) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const currentLanguage = i18n.language;

  const handleLanguageSelect = async (languageCode: string) => {
    await saveLanguagePreference(languageCode);
    setIsModalVisible(false);
  };

  const getButtonSize = () => {
    switch (size) {
      case 'small':
        return { padding: 8, fontSize: 12 };
      case 'large':
        return { padding: 16, fontSize: 16 };
      default:
        return { padding: 12, fontSize: 14 };
    }
  };

  const buttonSize = getButtonSize();

  const getCurrentLanguageDisplay = () => {
    const langKey = currentLanguage as keyof typeof supportedLanguages;
    return supportedLanguages[langKey] || supportedLanguages.en;
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.languageButton, { padding: buttonSize.padding }, style]}
        onPress={() => setIsModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.languageIcon, { fontSize: buttonSize.fontSize + 2 }]}>
          🌐
        </Text>
        {showLabel && (
          <Text style={[styles.languageText, { fontSize: buttonSize.fontSize }]}>
            {getCurrentLanguageDisplay()}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.language')}</Text>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.languageList}>
              {Object.entries(supportedLanguages).map(([code, name]) => (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.languageOption,
                    currentLanguage === code && styles.selectedLanguage,
                  ]}
                  onPress={() => handleLanguageSelect(code)}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      currentLanguage === code && styles.selectedLanguageText,
                    ]}
                  >
                    {name}
                  </Text>
                  {currentLanguage === code && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.text,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  languageIcon: {
    marginRight: 6,
  },
  languageText: {
    color: theme.text,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.modalBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  languageList: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: 2,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  selectedLanguage: {
    backgroundColor: theme.surface,
  },
  languageOptionText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  selectedLanguageText: {
    color: theme.primary,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: '600',
  },
});

export default LanguageSelector;
