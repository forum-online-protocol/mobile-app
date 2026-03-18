const FORUM_WEB_BASE_URL =
  process.env.EXPO_PUBLIC_FORUM_WEB_URL ||
  process.env.REACT_APP_FORUM_WEB_URL ||
  "https://forum.online";
const FORUM_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.REACT_APP_API_URL ||
  "https://dev-api.votta.vote";

const isDevShareSource = (): boolean => {
  const normalizedApiBaseUrl = String(FORUM_API_BASE_URL || "")
    .trim()
    .toLowerCase();

  return (
    normalizedApiBaseUrl.includes("dev-api.votta.vote") ||
    normalizedApiBaseUrl.includes("localhost") ||
    normalizedApiBaseUrl.includes("127.0.0.1")
  );
};

export const buildPostShareUrl = (postId: string): string => {
  const normalizedPostId = String(postId || "").trim();
  const baseUrl = String(FORUM_WEB_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const path = `/feed/post/${encodeURIComponent(normalizedPostId)}`;
  const query = isDevShareSource() ? "?source=dev" : "";
  return `${baseUrl}${path}${query}`;
};

export const buildProfileShareUrl = (address: string): string => {
  const normalizedAddress = String(address || "").trim();
  const baseUrl = String(FORUM_WEB_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  return `${baseUrl}/u/${encodeURIComponent(normalizedAddress)}`;
};

export const extractPostIdFromSharedUrl = (rawUrl: string): string | null => {
  const url = String(rawUrl || "").trim();
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    const feedMatch = path.match(/^\/feed\/post\/([^/]+)$/i);
    if (feedMatch?.[1]) {
      return decodeURIComponent(feedMatch[1]);
    }

    const legacyMatch = path.match(/^\/p\/([^/]+)$/i);
    if (legacyMatch?.[1]) {
      return decodeURIComponent(legacyMatch[1]);
    }
  } catch {
    const feedMatch = url.match(/\/feed\/post\/([^/?#]+)/i);
    if (feedMatch?.[1]) {
      return decodeURIComponent(feedMatch[1]);
    }

    const legacyMatch = url.match(/\/p\/([^/?#]+)/i);
    if (legacyMatch?.[1]) {
      return decodeURIComponent(legacyMatch[1]);
    }
  }

  return null;
};
