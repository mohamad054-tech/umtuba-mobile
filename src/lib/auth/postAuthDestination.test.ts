import { describe, expect, it } from "vitest";

import { POST_AUTH_HREF, postAuthHref } from "./postAuthDestination";

describe("postAuthHref", () => {
  it("routes successful auth to the Profile tab, not Watch or root Stack profile", () => {
    expect(postAuthHref()).toBe("/(tabs)/profile");
    expect(POST_AUTH_HREF).toBe("/(tabs)/profile");
    expect(POST_AUTH_HREF).not.toBe("/(tabs)/watch");
    expect(POST_AUTH_HREF).not.toBe("/profile");
  });
});
