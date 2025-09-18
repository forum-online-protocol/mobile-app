import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import DeepLinkService from '../services/DeepLinkService';

interface NavigationContextType {
  currentScreen: string;
  navigate: (screenName: string, params?: any) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  params: any;
  screenHistory: string[];
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: ReactNode;
  initialScreen?: string;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({
  children,
  initialScreen = 'Feed',
}) => {
  const [currentScreen, setCurrentScreen] = useState(initialScreen);
  const [params, setParams] = useState<any>({});
  const [screenHistory, setScreenHistory] = useState<string[]>([initialScreen]);

  const navigate = (screenName: string, screenParams?: any) => {
    console.log('[NavigationContext] Navigating to:', screenName, 'with params:', screenParams);
    setCurrentScreen(screenName);
    setParams(screenParams || {});
    setScreenHistory(prev => [...prev, screenName]);
  };

  const goBack = () => {
    if (screenHistory.length > 1) {
      const newHistory = [...screenHistory];
      newHistory.pop(); // Remove current screen
      const previousScreen = newHistory[newHistory.length - 1];
      setCurrentScreen(previousScreen);
      setScreenHistory(newHistory);
      setParams({});
    }
  };

  const canGoBack = () => {
    return screenHistory.length > 1;
  };

  const value: NavigationContextType = {
    currentScreen,
    navigate,
    goBack,
    canGoBack,
    params,
    screenHistory,
  };

  // Set navigation reference for deep linking
  useEffect(() => {
    const deepLinkService = DeepLinkService.getInstance();
    deepLinkService.setNavigationRef({ navigate });
  }, []);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};