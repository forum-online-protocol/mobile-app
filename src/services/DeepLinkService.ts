import {
  Alert,
  Linking,
  type EmitterSubscription,
} from "react-native";
import i18n from "../localization/i18n";
import { ROUTES } from "../navigation/routes";
import { extractPostIdFromSharedUrl } from "../utils/shareLinks";

type DeepLinkNavigationRef = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
};

type DeepLinkTarget =
  | { type: "post"; postId: string }
  | { type: "profile"; address: string }
  | { type: "home" };

const SUPPORTED_WEB_HOSTS = new Set([
  "forum.online",
  "www.forum.online",
  "votta.vote",
  "www.votta.vote",
]);
const DUPLICATE_SUPPRESSION_WINDOW_MS = 1500;

const decodeSegment = (value: string): string =>
  decodeURIComponent(String(value || "").trim());

const extractProfileAddressFromWebUrl = (rawUrl: string): string | null => {
  const url = String(rawUrl || "").trim();
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    const profileMatch = path.match(/^\/u\/([^/]+)$/i);
    if (profileMatch?.[1]) {
      return decodeSegment(profileMatch[1]);
    }
  } catch {
    const profileMatch = url.match(/\/u\/([^/?#]+)/i);
    if (profileMatch?.[1]) {
      return decodeSegment(profileMatch[1]);
    }
  }

  return null;
};

const resolveCustomSchemeTarget = (rawUrl: string): DeepLinkTarget | null => {
  const url = String(rawUrl || "").trim();
  if (!url.toLowerCase().startsWith("forumapp:")) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();
    const value = decodeSegment(parsed.pathname.replace(/^\/+/, ""));

    if (host === "post" && value) {
      return { type: "post", postId: value };
    }

    if (host === "profile" && value) {
      return { type: "profile", address: value };
    }

    return { type: "home" };
  } catch {
    const postMatch = url.match(/^forumapp:\/\/post\/([^/?#]+)/i);
    if (postMatch?.[1]) {
      return { type: "post", postId: decodeSegment(postMatch[1]) };
    }

    const profileMatch = url.match(/^forumapp:\/\/profile\/([^/?#]+)/i);
    if (profileMatch?.[1]) {
      return { type: "profile", address: decodeSegment(profileMatch[1]) };
    }

    return { type: "home" };
  }
};

const resolveHttpsTarget = (rawUrl: string): DeepLinkTarget | null => {
  const url = String(rawUrl || "").trim();
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();
    if (!SUPPORTED_WEB_HOSTS.has(host)) {
      return null;
    }
  } catch {
    if (
      !url.startsWith("https://forum.online/") &&
      !url.startsWith("https://votta.vote/") &&
      !url.startsWith("https://www.forum.online/") &&
      !url.startsWith("https://www.votta.vote/")
    ) {
      return null;
    }
  }

  const postId = extractPostIdFromSharedUrl(url);
  if (postId) {
    return { type: "post", postId };
  }

  const address = extractProfileAddressFromWebUrl(url);
  if (address) {
    return { type: "profile", address };
  }

  return { type: "home" };
};

export const resolveDeepLinkTarget = (rawUrl: string): DeepLinkTarget | null => {
  const url = String(rawUrl || "").trim();
  if (!url) {
    return null;
  }

  if (url.toLowerCase().startsWith("forumapp:")) {
    return resolveCustomSchemeTarget(url);
  }

  if (url.toLowerCase().startsWith("https://")) {
    return resolveHttpsTarget(url);
  }

  return null;
};

export class DeepLinkService {
  private static instance: DeepLinkService;
  private navigationRef: DeepLinkNavigationRef | null = null;
  private linkingSubscription: EmitterSubscription | null = null;
  private isInitialized = false;
  private pendingUrl: string | null = null;
  private lastHandledUrl: string | null = null;
  private lastHandledAt = 0;

  static getInstance(): DeepLinkService {
    if (!DeepLinkService.instance) {
      DeepLinkService.instance = new DeepLinkService();
    }
    return DeepLinkService.instance;
  }

  setNavigationRef(navigationRef: DeepLinkNavigationRef | null) {
    this.navigationRef = navigationRef;
    this.flushPendingUrl();
  }

  async initialize() {
    if (this.isInitialized) {
      this.flushPendingUrl();
      return;
    }

    try {
      this.isInitialized = true;
      this.linkingSubscription = Linking.addEventListener(
        "url",
        this.handleDeepLink,
      );

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log("[DeepLink] App opened with URL:", initialUrl);
        this.routeIncomingUrl(initialUrl);
      }
    } catch (error) {
      this.isInitialized = false;
      console.error("[DeepLink] Failed to initialize:", error);
    }
  }

  private handleDeepLink = ({ url }: { url: string }) => {
    console.log("[DeepLink] Received URL:", url);
    this.routeIncomingUrl(url);
  };

  private routeIncomingUrl(url: string) {
    if (!url) {
      return;
    }

    if (this.shouldSuppressDuplicate(url)) {
      console.log("[DeepLink] Ignoring duplicate URL:", url);
      return;
    }

    if (!this.navigationRef) {
      console.log("[DeepLink] Navigation not ready, queueing URL:", url);
      this.pendingUrl = url;
      return;
    }

    try {
      const target = resolveDeepLinkTarget(url);
      if (!target) {
        console.warn("[DeepLink] Unknown URL scheme:", url);
        return;
      }

      this.lastHandledUrl = url;
      this.lastHandledAt = Date.now();
      this.pendingUrl = null;

      switch (target.type) {
        case "post":
          console.log("[DeepLink] Opening post:", target.postId);
          this.navigateToPost(target.postId);
          return;
        case "profile":
          console.log("[DeepLink] Opening profile:", target.address);
          this.navigateToProfile(target.address);
          return;
        case "home":
          console.log("[DeepLink] Opening main app");
          this.navigateToHome();
          return;
      }
    } catch (error) {
      console.error("[DeepLink] Error handling URL:", error);
      Alert.alert(i18n.t("common.error"), i18n.t("deepLink.failedToOpenLink"));
    }
  }

  private flushPendingUrl() {
    if (!this.navigationRef || !this.pendingUrl) {
      return;
    }

    const pendingUrl = this.pendingUrl;
    this.pendingUrl = null;
    this.routeIncomingUrl(pendingUrl);
  }

  private shouldSuppressDuplicate(url: string): boolean {
    return (
      this.lastHandledUrl === url &&
      Date.now() - this.lastHandledAt < DUPLICATE_SUPPRESSION_WINDOW_MS
    );
  }

  private navigateToPost(postId: string) {
    if (this.navigationRef) {
      console.log("[DeepLink] Navigating to post:", postId);
      this.navigationRef.navigate(ROUTES.POST_DETAIL, { postId });
    } else {
      console.warn(
        "[DeepLink] Navigation ref not set, cannot navigate to post",
      );
    }
  }

  private navigateToProfile(address: string) {
    if (this.navigationRef) {
      console.log("[DeepLink] Navigating to profile:", address);
      this.navigationRef.navigate(ROUTES.USER_PROFILE, {
        userAddress: address,
      });
    }
  }

  private navigateToHome() {
    if (this.navigationRef) {
      console.log("[DeepLink] Navigating to home");
      this.navigationRef.navigate(ROUTES.FEED);
    }
  }

  cleanup() {
    this.linkingSubscription?.remove();
    this.linkingSubscription = null;
    this.isInitialized = false;
  }
}

export default DeepLinkService;
