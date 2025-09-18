import { useTranslation } from 'react-i18next';
import { supportedLanguages, saveLanguagePreference } from '../localization/i18n';

export const useLocalization = () => {
  const { t, i18n } = useTranslation();

  const changeLanguage = async (language: string) => {
    if (Object.keys(supportedLanguages).includes(language)) {
      await saveLanguagePreference(language);
    }
  };

  const currentLanguage = i18n.language;
  const availableLanguages = supportedLanguages;

  return {
    t,
    currentLanguage,
    availableLanguages,
    changeLanguage
  };
};

export default useLocalization;