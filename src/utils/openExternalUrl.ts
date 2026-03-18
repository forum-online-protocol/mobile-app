import { Linking, Platform } from "react-native";

export async function openExternalUrl(urls: string[]): Promise<void> {
  const uniqueUrls = Array.from(
    new Set(urls.map((url) => url.trim()).filter(Boolean)),
  );

  let lastError: unknown = null;

  for (const url of uniqueUrls) {
    try {
      if (Platform.OS !== "web") {
        const supported = await Linking.canOpenURL(url);
        if (!supported) {
          continue;
        }
      }

      await Linking.openURL(url);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unsupported URL");
}
