import React, { useState } from 'react';
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

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  icon: 'card' | 'wallet' | 'chatbubble' | 'shield';
  title: string;
  description: string;
  color: [string, string];
}

const slides: OnboardingSlide[] = [
  {
    icon: 'card' as const,
    title: 'Passport Authentication',
    description: 'Use your government-issued passport as your secure wallet key. No seed phrases to remember.',
    color: ['#4F46E5', '#7C3AED'],
  },
  {
    icon: 'wallet' as const,
    title: 'Built-in Ethereum Wallet',
    description: 'Send, receive, and manage your crypto assets with a wallet generated from your passport.',
    color: ['#7C3AED', '#EC4899'],
  },
  {
    icon: 'chatbubble' as const,
    title: 'Social Democracy Platform',
    description: 'Join verified discussions, create polls, and vote on proposals with guaranteed one-person-one-vote.',
    color: ['#EC4899', '#F59E0B'],
  },
  {
    icon: 'shield' as const,
    title: 'Privacy First',
    description: 'Your passport data never leaves your device. We use zero-knowledge proofs for verification.',
    color: ['#F59E0B', '#10B981'],
  },
];

const OnboardingScreen: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      console.log('Navigate to: PassportScan');
    }
  };

  const handleSkip = () => {
    navigation.navigate('PassportScan' as never);
  };

  const renderSlide = (slide: OnboardingSlide, index: number) => {
    return (
      <View key={index} style={[styles.slide, { width }]}>
        <View style={[styles.iconContainer, { backgroundColor: slide.color[0] }]}>
          <Icon name={slide.icon} variant="filled" size={80} color="#FFFFFF" />
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
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
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
        >
          <View 
            style={[styles.nextButtonGradient, { backgroundColor: slides[currentSlide].color[0] }]}
          >
            <Text style={styles.nextButtonText}>
              {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Icon name="arrow-forward" size={20} color="#FFFFFF" variant="filled" />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    alignItems: 'flex-end',
  },
  skipText: {
    color: '#6B7280',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: 16,
    color: '#6B7280',
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
    backgroundColor: '#D1D5DB',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#4F46E5',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default OnboardingScreen;