import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import DeepLinkService from '../services/DeepLinkService';
import { AppRoute, ROUTES } from '../navigation/routes';

interface NavigationContextType {
  currentScreen: AppRoute;
  navigate: (screenName: AppRoute, params?: any) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  params: any;
  screenHistory: AppRoute[];
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
  initialScreen?: AppRoute;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({
  children,
  initialScreen = ROUTES.FEED,
}) => {
  const [currentScreen, setCurrentScreen] = useState(initialScreen);
  const [params, setParams] = useState<any>({});
  const [screenHistory, setScreenHistory] = useState<AppRoute[]>([initialScreen]);

  const navigate = (screenName: AppRoute, screenParams?: any) => {
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

  // Android system back gesture / button integration for custom navigator.
  // Without this handler Android closes/minimizes the app instead of going back in-app.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screenHistory.length > 1) {
        const newHistory = [...screenHistory];
        newHistory.pop();
        const previousScreen = newHistory[newHistory.length - 1];
        setCurrentScreen(previousScreen);
        setScreenHistory(newHistory);
        setParams({});
        return true;
      }

      if (currentScreen !== ROUTES.FEED) {
        setCurrentScreen(ROUTES.FEED);
        setScreenHistory([ROUTES.FEED]);
        setParams({});
        return true;
      }

      // Keep user inside app when already on root feed.
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [currentScreen, screenHistory]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};
