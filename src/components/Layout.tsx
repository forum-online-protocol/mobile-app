import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
  navigation?: any;
  currentScreen?: string;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  navigation, 
  currentScreen = 'Feed',
 
}) => {
  const { width } = Dimensions.get('window');
  const isMobile = width < 768;

  // On mobile, return children without layout
  if (Platform.OS !== 'web' || isMobile) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <Header navigation={navigation} currentScreen={currentScreen} />
      <View style={styles.body}>
        <View style={styles.mainContent}>
          <ScrollView 
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    marginTop: 60, // Height of header
    justifyContent: 'center',
  },
  mainContent: {
    width: '100%',
    maxWidth: 600,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#EFF3F4',
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
  },
});

export default Layout;