import { useEffect, useState } from "react";
import ApiService, { AppFeatureFlags } from "../services/ApiService";

const DEFAULT_FEATURE_FLAGS: AppFeatureFlags = {
  lotteryEnabled: false,
  biometricsEnabled: false,
  avatarUploadEnabled: false,
  commentsEnabled: true,
  anonymousPostingEnabled: false,
};

export const useServerFeatureFlags = () => {
  const [featureFlags, setFeatureFlags] = useState<AppFeatureFlags>(
    DEFAULT_FEATURE_FLAGS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      const result = await ApiService.getInstance().getAppConfig();
      if (!mounted) {
        return;
      }

      if (result.data?.featureFlags) {
        setFeatureFlags({
          ...DEFAULT_FEATURE_FLAGS,
          ...result.data.featureFlags,
        });
      }
      setError(
        result.success ? null : result.error || "Failed to load app config",
      );
      setIsLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    featureFlags,
    isLoading,
    error,
  };
};

export default useServerFeatureFlags;
