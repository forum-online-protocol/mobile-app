import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
} from 'react-native';
// import LinearGradient from 'react-native-linear-gradient';
import Icon from '../components/Icon';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalization } from '../hooks/useLocalization';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  icon: 'card' | 'wallet' | 'chatbubble' | 'shield';
  title: string;
  description: string;
  color: [string, string];
}

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides: OnboardingSlide[] = useMemo(
    () => [
      {
        icon: 'card',
        title: t('onboarding.slides.passportAuth.title'),
        description: t('onboarding.slides.passportAuth.description'),
        color: [theme.primaryDark, theme.primary],
      },
      {
        icon: 'wallet',
        title: t('onboarding.slides.wallet.title'),
        description: t('onboarding.slides.wallet.description'),
        color: [theme.primary, theme.info],
      },
      {
        icon: 'chatbubble',
        title: t('onboarding.slides.social.title'),
        description: t('onboarding.slides.social.description'),
        color: [theme.info, theme.warning],
      },
      {
        icon: 'shield',
        title: t('onboarding.slides.privacy.title'),
        description: t('onboarding.slides.privacy.description'),
        color: [theme.warning, theme.success],
      },
    ],
    [theme, t],
  );

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigation.navigate('PassportScan' as never);
    }
  };

  const handleSkip = () => {
    navigation.navigate('PassportScan' as never);
  };

  const renderSlide = (slide: OnboardingSlide, index: number) => {
    return (
        <View key={index} style={[styles.slide, { width }]}>
          <View style={[styles.iconContainer, { backgroundColor: slide.color[0] }]}>
          <Icon name={slide.icon} variant="filled" size={80} color={theme.onPrimary} />
        </View>
        
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideDescription}>{slide.description}</Text>
      </View>
    );
  };

  const renderPagination = () => {
    return (
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === currentSlide && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skipA11y')}
        >
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentSlide(slideIndex);
        }}
        scrollEventThrottle={16}
      >
        {slides.map(renderSlide)}
      </ScrollView>

      {renderPagination()}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel={currentSlide === slides.length - 1 ? t('onboarding.finishA11y') : t('onboarding.nextSlideA11y')}
        >
          <View 
            style={[styles.nextButtonGradient, { backgroundColor: slides[currentSlide].color[0] }]}
          >
            <Text style={styles.nextButtonText}>
              {currentSlide === slides.length - 1 ? t('onboarding.getStarted') : t('onboarding.next')}
            </Text>
            <Icon name="arrow-forward" size={20} color={theme.onPrimary} variant="filled" />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    padding: 20,
    alignItems: 'flex-end',
  },
  skipText: {
    color: theme.textSecondary,
    fontSize: 16,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    elevation: 8,
    shadowColor: theme.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.border,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: theme.primary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  nextButton: {
    width: '100%',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextButtonText: {
    color: theme.onPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default OnboardingScreen;
