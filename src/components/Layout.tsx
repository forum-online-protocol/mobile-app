import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import Header from './Header';
import { useTheme } from '../contexts/ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
  navigation?: any;
  currentScreen?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, navigation, currentScreen = 'Feed' }) => {
  const { width } = Dimensions.get('window');
  const isMobile = width < 768;
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (Platform.OS !== 'web' || isMobile) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <Header navigation={navigation} currentScreen={currentScreen} />
      <View style={styles.body}>
        <View style={styles.mainContent}>
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      marginTop: 60,
      justifyContent: 'center',
    },
    mainContent: {
      width: '100%',
      maxWidth: 600,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    scrollContent: {
      flex: 1,
    },
  });

export default Layout;
