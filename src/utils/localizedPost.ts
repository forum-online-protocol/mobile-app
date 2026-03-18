import { Post, SupportedAppLanguage } from "../types";

export const normalizeAppLanguage = (
  value: unknown,
  fallback: SupportedAppLanguage = "en",
): SupportedAppLanguage => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  const short = normalized.split("-")[0]?.trim() || normalized;

  if (short === "uk" || short === "ua") return "ua";
  if (short === "ru") return "ru";
  if (short === "en") return "en";
  return fallback;
};

const pickLocalizedValue = (
  translations: Partial<Record<SupportedAppLanguage, string>> | undefined,
  requestedLanguage: SupportedAppLanguage,
  sourceLanguage: SupportedAppLanguage,
  fallbackValue?: string,
): string => {
  const candidates: SupportedAppLanguage[] = [
    requestedLanguage,
    sourceLanguage,
    "en",
  ];

  for (const candidate of candidates) {
    const value = String(translations?.[candidate] || "").trim();
    if (value) {
      return value;
    }
  }

  return String(fallbackValue || "").trim();
};

export const getPostDisplayContent = (
  post: Pick<Post, "content" | "localizedContent" | "localization">,
  requestedLanguage?: string,
): string => {
  const direct = String(post.localizedContent || "").trim();
  if (direct) {
    return direct;
  }

  const language = normalizeAppLanguage(requestedLanguage, "en");
  const sourceLanguage = normalizeAppLanguage(
    post.localization?.sourceLanguage,
    "en",
  );

  return pickLocalizedValue(
    post.localization?.contentTranslations,
    language,
    sourceLanguage,
    post.content,
  );
};

export const getPostDisplayTitle = (
  post: Pick<Post, "title" | "localizedTitle" | "localization">,
  requestedLanguage?: string,
): string => {
  const direct = String(post.localizedTitle || "").trim();
  if (direct) {
    return direct;
  }

  const language = normalizeAppLanguage(requestedLanguage, "en");
  const sourceLanguage = normalizeAppLanguage(
    post.localization?.sourceLanguage,
    "en",
  );

  return pickLocalizedValue(
    post.localization?.titleTranslations,
    language,
    sourceLanguage,
    post.title,
  );
};
