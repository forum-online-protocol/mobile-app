import { Alert, Linking, Platform } from 'react-native';
import ApiService from './ApiService';
import i18n from '../localization/i18n';

interface VersionLinks {
  androidApk?: string;
  playStore?: string;
  appStore?: string;
  web?: string;
}

interface VersionInfo {
  currentVersion: string;
  minimumVersion: string;
  downloadUrl?: string;
  links?: VersionLinks;
  releaseNotes?: string;
  forceUpdate?: boolean;
  shouldUpdate?: boolean;
  belowMinimum?: boolean;
  timestamp?: string;
}

type AppPlatform = 'android' | 'ios' | 'web' | 'unknown';

export class VersionCheckService {
  private static instance: VersionCheckService;
  private readonly APP_VERSION = '1.0.3';

  private constructor() {}

  static getInstance(): VersionCheckService {
    if (!VersionCheckService.instance) {
      VersionCheckService.instance = new VersionCheckService();
    }
    return VersionCheckService.instance;
  }

  private getPlatform(): AppPlatform {
    const value = String(Platform.OS || '').trim().toLowerCase();
    if (value === 'android') return 'android';
    if (value === 'ios') return 'ios';
    if (value === 'web') return 'web';
    return 'unknown';
  }

  private compareVersions(version1: string, version2: string): number {
    const left = String(version1 || '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
    const right = String(version2 || '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
    const maxLength = Math.max(left.length, right.length);

    for (let index = 0; index < maxLength; index += 1) {
      const leftValue = left[index] || 0;
      const rightValue = right[index] || 0;
      if (leftValue < rightValue) return -1;
      if (leftValue > rightValue) return 1;
    }

    return 0;
  }

  private resolveDownloadUrl(versionInfo: VersionInfo): string {
    const links = versionInfo.links || {};
    const platform = this.getPlatform();

    if (platform === 'android') {
      return links.playStore || links.androidApk || versionInfo.downloadUrl || '';
    }
    if (platform === 'ios') {
      return links.appStore || versionInfo.downloadUrl || '';
    }
    return versionInfo.downloadUrl || links.web || links.playStore || links.appStore || links.androidApk || '';
  }

  private showUpdateDialog(versionInfo: VersionInfo): void {
    const forceUpdate = Boolean(versionInfo.forceUpdate);
    const downloadUrl = this.resolveDownloadUrl(versionInfo);
    const title = forceUpdate ? i18n.t('version.updateRequired') : i18n.t('version.updateAvailable');
    const message = i18n.t('version.message', {
      version: versionInfo.currentVersion,
      releaseNotes: versionInfo.releaseNotes || '',
    });

    if (forceUpdate) {
      Alert.alert(
        title,
        message,
        [
          {
            text: i18n.t('version.updateNow'),
            onPress: () => this.openDownloadUrl(downloadUrl),
          },
        ],
        { cancelable: false }
      );
      return;
    }

    Alert.alert(title, message, [
      { text: i18n.t('version.later'), style: 'cancel' },
      {
        text: i18n.t('version.updateNow'),
        onPress: () => this.openDownloadUrl(downloadUrl),
      },
    ]);
  }

  private async openDownloadUrl(downloadUrl: string): Promise<void> {
    try {
      if (!downloadUrl) {
        throw new Error('Download URL is not configured');
      }
      await Linking.openURL(downloadUrl);
    } catch (error) {
      console.error('[VersionCheck] Error opening download URL:', error);
      Alert.alert(i18n.t('common.error'), i18n.t('version.failedToOpenDownloadLink'));
    }
  }

  async checkForUpdates(): Promise<void> {
    try {
      const platform = this.getPlatform();
      const apiService = ApiService.getInstance();
      const response = await apiService.checkVersion({
        platform,
        appVersion: this.APP_VERSION,
      });

      if (!response.success || !response.data) {
        console.error('[VersionCheck] Failed to fetch version info:', response.error);
        return;
      }

      const versionInfo: VersionInfo = response.data;
      const currentVersion = String(versionInfo.currentVersion || '').trim();
      const minimumVersion = String(versionInfo.minimumVersion || currentVersion).trim();

      if (!currentVersion) {
        return;
      }

      const shouldUpdateByVersion = this.compareVersions(this.APP_VERSION, currentVersion) < 0;
      const belowMinimum = this.compareVersions(this.APP_VERSION, minimumVersion) < 0;
      const forceUpdate = Boolean(versionInfo.forceUpdate) || belowMinimum;
      const shouldUpdate =
        Boolean(versionInfo.shouldUpdate) || shouldUpdateByVersion || forceUpdate;

      if (!shouldUpdate) {
        return;
      }

      this.showUpdateDialog({
        ...versionInfo,
        currentVersion,
        minimumVersion,
        belowMinimum,
        forceUpdate,
      });
    } catch (error) {
      console.error('[VersionCheck] Error during version check:', error);
    }
  }

  getCurrentVersion(): string {
    return this.APP_VERSION;
  }
}

export default VersionCheckService.getInstance();
