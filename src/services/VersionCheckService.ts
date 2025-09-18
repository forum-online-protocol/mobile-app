import { Alert, Linking, Platform } from 'react-native';
import AsyncStorageService from './AsyncStorageService';
import ApiService from './ApiService';

interface VersionInfo {
  currentVersion: string;
  minimumVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  timestamp: string;
}

export class VersionCheckService {
  private static instance: VersionCheckService;
  private readonly APP_VERSION = '1.0.3'; // Current app version
  // Removed timer-based checks - always check on app load

  private constructor() {}

  static getInstance(): VersionCheckService {
    if (!VersionCheckService.instance) {
      VersionCheckService.instance = new VersionCheckService();
    }
    return VersionCheckService.instance;
  }

  /**
   * Compare version strings (semantic versioning)
   */
  private compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }
    
    return 0;
  }


  /**
   * Show update dialog
   */
  private showUpdateDialog(versionInfo: VersionInfo): void {
    const { currentVersion, releaseNotes, forceUpdate, downloadUrl } = versionInfo;
    
    const title = forceUpdate ? 'Update Required' : 'Update Available';
    const message = `A new version (${currentVersion}) is available.\n\n${releaseNotes}`;
    
    if (forceUpdate) {
      // Force update - only show update button
      Alert.alert(
        title,
        message,
        [
          {
            text: 'Update Now',
            onPress: () => this.openDownloadUrl(downloadUrl),
          },
        ],
        { cancelable: false }
      );
    } else {
      // Optional update - show both options
      Alert.alert(
        title,
        message,
        [
          {
            text: 'Later',
            style: 'cancel',
          },
          {
            text: 'Update Now',
            onPress: () => this.openDownloadUrl(downloadUrl),
          },
        ]
      );
    }
  }

  /**
   * Open download URL
   */
  private async openDownloadUrl(downloadUrl: string): Promise<void> {
    try {
      await Linking.openURL(downloadUrl);
    } catch (error) {
      console.error('[VersionCheck] Error opening download URL:', error);
      Alert.alert('Error', 'Failed to open download link');
    }
  }

  /**
   * Perform version check
   */
  async checkForUpdates(force: boolean = false): Promise<void> {
    try {
      console.log('[VersionCheck] Checking for updates...', { force, currentVersion: this.APP_VERSION });

      // Always fetch version info from API
      const apiService = ApiService.getInstance();
      const response = await apiService.checkVersion();

      if (!response.success || !response.data) {
        console.error('[VersionCheck] Failed to fetch version info:', response.error);
        return;
      }

      const versionInfo: VersionInfo = response.data;
      console.log('[VersionCheck] Version info received:', versionInfo);

      // Compare versions
      const comparison = this.compareVersions(this.APP_VERSION, versionInfo.currentVersion);
      const needsUpdate = comparison < 0; // Current version is lower than server version

      if (needsUpdate) {
        console.log('[VersionCheck] Update available:', {
          current: this.APP_VERSION,
          latest: versionInfo.currentVersion,
          forceUpdate: versionInfo.forceUpdate,
        });

        // Check if current version is below minimum required
        const belowMinimum = this.compareVersions(this.APP_VERSION, versionInfo.minimumVersion) < 0;
        
        if (belowMinimum) {
          console.log('[VersionCheck] Force update required (below minimum version)');
          versionInfo.forceUpdate = true;
        }

        // Show update dialog
        this.showUpdateDialog(versionInfo);
      } else {
        console.log('[VersionCheck] App is up to date');
      }

    } catch (error) {
      console.error('[VersionCheck] Error during version check:', error);
    }
  }

  /**
   * Get current app version
   */
  getCurrentVersion(): string {
    return this.APP_VERSION;
  }
}

export default VersionCheckService.getInstance();