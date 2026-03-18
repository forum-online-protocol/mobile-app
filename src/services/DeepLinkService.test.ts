jest.mock("react-native", () => {
  const addEventListener = jest.fn();
  const getInitialURL = jest.fn();

  return {
    Alert: {
      alert: jest.fn(),
    },
    Linking: {
      addEventListener,
      getInitialURL,
    },
  };
});

jest.mock("../localization/i18n", () => ({
  t: (key: string) => key,
}));

import { Linking } from "react-native";
import { ROUTES } from "../navigation/routes";
import {
  DeepLinkService,
  resolveDeepLinkTarget,
} from "./DeepLinkService";

const mockedLinking = Linking as jest.Mocked<typeof Linking>;

describe("resolveDeepLinkTarget", () => {
  it("resolves custom post deep links", () => {
    expect(resolveDeepLinkTarget("forumapp://post/test-id")).toEqual({
      type: "post",
      postId: "test-id",
    });
  });

  it("resolves custom profile deep links", () => {
    expect(resolveDeepLinkTarget("forumapp://profile/0x123")).toEqual({
      type: "profile",
      address: "0x123",
    });
  });

  it("resolves universal links for posts and legacy aliases", () => {
    expect(
      resolveDeepLinkTarget("https://forum.online/feed/post/test-id"),
    ).toEqual({
      type: "post",
      postId: "test-id",
    });

    expect(resolveDeepLinkTarget("https://forum.online/p/legacy-id")).toEqual({
      type: "post",
      postId: "legacy-id",
    });
  });

  it("resolves universal links for profiles", () => {
    expect(resolveDeepLinkTarget("https://votta.vote/u/0xabc")).toEqual({
      type: "profile",
      address: "0xabc",
    });
  });
});

describe("DeepLinkService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLinking.addEventListener.mockReturnValue({
      remove: jest.fn(),
    } as any);
    mockedLinking.getInitialURL.mockResolvedValue(null);
  });

  it("queues cold-start URLs until navigation is ready", async () => {
    const navigate = jest.fn();
    const service = new DeepLinkService();

    mockedLinking.getInitialURL.mockResolvedValue("forumapp://post/cold-start");

    await service.initialize();
    expect(navigate).not.toHaveBeenCalled();

    service.setNavigationRef({ navigate });

    expect(navigate).toHaveBeenCalledWith(ROUTES.POST_DETAIL, {
      postId: "cold-start",
    });
  });

  it("handles warm-start profile links through the Linking event", async () => {
    const navigate = jest.fn();
    const service = new DeepLinkService();

    await service.initialize();
    service.setNavigationRef({ navigate });

    const handler = mockedLinking.addEventListener.mock.calls[0]?.[1] as
      | ((event: { url: string }) => void)
      | undefined;

    expect(handler).toBeDefined();

    handler?.({ url: "https://votta.vote/u/0xfeed" });

    expect(navigate).toHaveBeenCalledWith(ROUTES.USER_PROFILE, {
      userAddress: "0xfeed",
    });
  });

  it("suppresses duplicate events for the same URL", async () => {
    const navigate = jest.fn();
    const service = new DeepLinkService();

    await service.initialize();
    service.setNavigationRef({ navigate });

    const handler = mockedLinking.addEventListener.mock.calls[0]?.[1] as
      | ((event: { url: string }) => void)
      | undefined;

    handler?.({ url: "forumapp://post/dup-id" });
    handler?.({ url: "forumapp://post/dup-id" });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(ROUTES.POST_DETAIL, {
      postId: "dup-id",
    });
  });
});
