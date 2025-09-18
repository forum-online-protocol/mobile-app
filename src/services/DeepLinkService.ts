import { Linking, Alert } from 'react-native';

export class DeepLinkService {
  private static instance: DeepLinkService;
  private navigationRef: any = null;

  static getInstance(): DeepLinkService {
    if (!DeepLinkService.instance) {
      DeepLinkService.instance = new DeepLinkService();
    }
    return DeepLinkService.instance;
  }

  setNavigationRef(navigationRef: any) {
    this.navigationRef = navigationRef;
  }

  async initialize() {
    try {
      // Handle deep link when app is already running
      Linking.addEventListener('url', this.handleDeepLink);

      // Handle deep link that opened the app (when app was closed)
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('[DeepLink] App opened with URL:', initialUrl);
        this.handleDeepLink({ url: initialUrl });
      }
    } catch (error) {
      console.error('[DeepLink] Failed to initialize:', error);
    }
  }

  private handleDeepLink = ({ url }: { url: string }) => {
    console.log('[DeepLink] Received URL:', url);

    try {
      if (url.startsWith('forumapp://')) {
        this.handleCustomScheme(url);
      } else if (url.startsWith('https://votta.vote/')) {
        this.handleHttpsScheme(url);
      } else {
        console.warn('[DeepLink] Unknown URL scheme:', url);
      }
    } catch (error) {
      console.error('[DeepLink] Error handling URL:', error);
      Alert.alert('Error', 'Failed to open link');
    }
  };

  private handleCustomScheme(url: string) {
    console.log('[DeepLink] Handling custom scheme:', url);

    if (url.includes('forumapp://post/')) {
      const postId = url.replace('forumapp://post/', '');
      console.log('[DeepLink] Opening post:', postId);
      this.navigateToPost(postId);
    } else if (url.includes('forumapp://profile/')) {
      const address = url.replace('forumapp://profile/', '');
      console.log('[DeepLink] Opening profile:', address);
      this.navigateToProfile(address);
    } else {
      console.log('[DeepLink] Opening main app');
      this.navigateToHome();
    }
  }

  private handleHttpsScheme(url: string) {
    console.log('[DeepLink] Handling HTTPS scheme:', url);

    if (url.includes('/p/')) {
      const postId = url.split('/p/')[1].split('/')[0];
      console.log('[DeepLink] Opening post from web:', postId);
      this.navigateToPost(postId);
    } else if (url.includes('/u/')) {
      const address = url.split('/u/')[1].split('/')[0];
      console.log('[DeepLink] Opening profile from web:', address);
      this.navigateToProfile(address);
    } else {
      console.log('[DeepLink] Opening main app from web');
      this.navigateToHome();
    }
  }

  private navigateToPost(postId: string) {
    if (this.navigationRef) {
      console.log('[DeepLink] Navigating to post:', postId);
      this.navigationRef.navigate('PostDetail', { postId });
    } else {
      console.warn('[DeepLink] Navigation ref not set, cannot navigate to post');
    }
  }

  private navigateToProfile(address: string) {
    if (this.navigationRef) {
      console.log('[DeepLink] Would navigate to profile:', address);
      // Example: this.navigationRef.navigate('UserProfile', { address });
      
      // For now, just show an alert
      Alert.alert('Deep Link', `Opening profile: ${address}`, [
        { text: 'OK', onPress: () => this.navigateToHome() }
      ]);
    }
  }

  private navigateToHome() {
    if (this.navigationRef) {
      console.log('[DeepLink] Navigating to home');
      // Navigate to main feed/home screen
      // Example: this.navigationRef.navigate('Feed');
    }
  }

  cleanup() {
    Linking.removeAllListeners('url');
  }
}

export default DeepLinkService;