export interface Post {
  id: string;
  legacySource?: string;
  isReadOnlyLegacy?: boolean;
  title?: string;
  localizedTitle?: string;
  content: string;
  localizedContent?: string;
  localization?: {
    sourceLanguage?: "en" | "ru" | "ua";
    titleTranslations?: Partial<Record<"en" | "ru" | "ua", string>>;
    contentTranslations?: Partial<Record<"en" | "ru" | "ua", string>>;
  } | null;
  author?: string;
  username?: string;
  createdAt: string;
  updatedAt?: string;
  likes?: number;
  replies?: number;
  reposts?: number;
  avatar?: string;
}
