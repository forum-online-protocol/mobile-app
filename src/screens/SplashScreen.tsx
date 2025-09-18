import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import Logo from '../components/Logo';

interface SplashScreenProps {
  navigation?: any;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (navigation) {
        if (isAuthenticated) {
          navigation.navigate('MainApp');
        } else {
          navigation.navigate('Auth');
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: '#4F46E5' }]}>
      <View style={styles.content}>
        <Logo size="large" color="white" showText={false} />
        
        <Text style={styles.title}>Forum</Text>
        
        
        <ActivityIndicator
          size="large"
          color="#FFFFFF"
          style={styles.loader}
        />
      </View>
      
      <Text style={styles.footer}>Secure • Private • Decentralized</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#17559e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 48,
  },
  loader: {
    marginTop: 32,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default SplashScreen;