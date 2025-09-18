import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  // Primary colors
  background: string;
  surface: string;
  card: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Border and divider
  border: string;
  divider: string;
  
  // Brand colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Special
  overlay: string;
  modalBackground: string;
  tabBarBackground: string;
  headerBackground: string;
  
  // Input
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  placeholder: string;
}

const lightTheme: Theme = {
  // Primary colors
  background: '#FFFFFF',
  surface: '#F9FAFB',
  card: '#FFFFFF',
  
  // Text colors
  text: '#0F1419',
  textSecondary: '#536471',
  textTertiary: '#8B98A5',
  
  // Border and divider
  border: '#E5E7EB',
  divider: '#E5E7EB',
  
  // Brand colors
  primary: '#1DA1F2',
  primaryLight: '#71C9F8',
  primaryDark: '#1A8CD8',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Special
  overlay: 'rgba(0, 0, 0, 0.5)',
  modalBackground: '#FFFFFF',
  tabBarBackground: '#FFFFFF',
  headerBackground: '#FFFFFF',
  
  // Input
  inputBackground: '#F7F9FA',
  inputBorder: '#E5E7EB',
  inputText: '#0F1419',
  placeholder: '#8B98A5',
};

const darkTheme: Theme = {
  // Primary colors
  background: '#000000',
  surface: '#0A0A0A',
  card: '#16181C',
  
  // Text colors
  text: '#FFFFFF',
  textSecondary: '#8B98A5',
  textTertiary: '#536471',
  
  // Border and divider
  border: '#2F3336',
  divider: '#2F3336',
  
  // Brand colors
  primary: '#1DA1F2',
  primaryLight: '#71C9F8',
  primaryDark: '#1A8CD8',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Special
  overlay: 'rgba(255, 255, 255, 0.1)',
  modalBackground: '#16181C',
  tabBarBackground: '#000000',
  headerBackground: '#000000',
  
  // Input
  inputBackground: '#16181C',
  inputBorder: '#2F3336',
  inputText: '#FFFFFF',
  placeholder: '#536471',
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Update theme when mode or system preference changes
  useEffect(() => {
    if (themeMode === 'system') {
      setIsDark(systemColorScheme === 'dark');
    } else {
      setIsDark(themeMode === 'dark');
    }
  }, [themeMode, systemColorScheme]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themeMode');
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.log('Failed to load theme preference:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem('themeMode', mode);
      setThemeModeState(mode);
    } catch (error) {
      console.log('Failed to save theme preference:', error);
    }
  };

  const toggleTheme = () => {
    const nextMode = isDark ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        isDark,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;