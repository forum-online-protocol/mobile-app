import type { Post } from "../types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const normalizeValue = (value: unknown): string => String(value || "").trim();

export const isAnonymousPost = (post: Partial<Post> | null | undefined): boolean =>
  post?.isAnonymous === true;

export const getAnonymousDisplayName = (t: Translate): string =>
  normalizeValue(t("profile.anonymous")) || "Anonymous";

export const getPostAuthorPresentation = (
  post: Partial<Post> | null | undefined,
  t: Translate,
) => {
  if (isAnonymousPost(post)) {
    const displayName = getAnonymousDisplayName(t);
    return {
      displayName,
      username: "",
      avatar: "",
      showVerified: false,
      canOpenProfile: false,
    };
  }

  return {
    displayName:
      normalizeValue(post?.author?.displayName) ||
      normalizeValue(post?.author?.username) ||
      "User",
    username: normalizeValue(post?.author?.username),
    avatar: normalizeValue(post?.author?.avatar),
    showVerified: post?.author?.isVerified === true,
    canOpenProfile: true,
  };
};
