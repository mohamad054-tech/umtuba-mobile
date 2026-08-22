import { describe, expect, it } from "vitest";

import {
  FOLLOW_LIST_PAGE_SIZE,
  FOLLOW_LIST_TABLE,
  listFollowRelations,
  planFollowListQuery,
  resolveFollowListOpenTarget,
  resolveFollowListTargetUserId,
} from "./followLists";

const OWN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ADA = "33333333-3333-4333-8333-333333333333";
const SAM = "44444444-4444-4444-8444-444444444444";

function mockFollowClient(opts: {
  followData: Array<Record<string, unknown>>;
  profileData?: Array<Record<string, unknown>>;
  followError?: { message: string } | null;
  profileError?: { message: string } | null;
}) {
  const follows = {
    eqCalls: [] as Array<[string, string]>,
    orderCalls: [] as string[],
    rangeCalls: [] as Array<[number, number]>,
    selectCalls: [] as string[],
  };
  const profiles = {
    inCalls: [] as Array<[string, string[]]>,
    fromCount: 0,
  };

  const followBuilder = {
    select(cols: string) {
      follows.selectCalls.push(cols);
      return followBuilder;
    },
    eq(col: string, val: string) {
      follows.eqCalls.push([col, val]);
      return followBuilder;
    },
    order(col: string) {
      follows.orderCalls.push(col);
      return followBuilder;
    },
    range(from: number, to: number) {
      follows.rangeCalls.push([from, to]);
      return Promise.resolve({
        data: opts.followData,
        error: opts.followError ?? null,
      });
    },
  };

  const profileBuilder = {
    select() {
      return profileBuilder;
    },
    in(col: string, ids: string[]) {
      profiles.inCalls.push([col, ids]);
      return Promise.resolve({
        data: opts.profileData ?? [],
        error: opts.profileError ?? null,
      });
    },
  };

  return {
    follows,
    profiles,
    client: {
      from(table: string) {
        if (table === "profile_follows") return followBuilder;
        if (table === "profiles") {
          profiles.fromCount += 1;
          return profileBuilder;
        }
        throw new Error(`unexpected table ${table}`);
      },
    },
  };
}

describe("planFollowListQuery", () => {
  it("sources followers from profile_follows.following_id = target", () => {
    expect(planFollowListQuery("followers")).toEqual({
      table: FOLLOW_LIST_TABLE,
      targetColumn: "following_id",
      memberColumn: "follower_id",
    });
  });

  it("sources following from profile_follows.follower_id = target", () => {
    expect(planFollowListQuery("following")).toEqual({
      table: FOLLOW_LIST_TABLE,
      targetColumn: "follower_id",
      memberColumn: "following_id",
    });
  });
});

describe("resolveFollowListTargetUserId", () => {
  it("never falls back to the signed-in user", () => {
    expect(
      resolveFollowListTargetUserId({
        queryUserId: null,
        signedInUserId: OWN,
      })
    ).toBeNull();
    expect(
      resolveFollowListTargetUserId({
        queryUserId: "not-a-uuid",
        signedInUserId: OWN,
      })
    ).toBeNull();
    expect(
      resolveFollowListTargetUserId({
        queryUserId: OTHER,
        signedInUserId: OWN,
      })
    ).toBe(OTHER);
  });
});

describe("resolveFollowListOpenTarget", () => {
  it("uses own id only for own profile, never other→own swap", () => {
    expect(
      resolveFollowListOpenTarget({
        isOwn: true,
        ownUserId: OWN,
        otherUserId: OTHER,
      })
    ).toBe(OWN);
    expect(
      resolveFollowListOpenTarget({
        isOwn: false,
        ownUserId: OWN,
        otherUserId: OTHER,
      })
    ).toBe(OTHER);
    expect(
      resolveFollowListOpenTarget({
        isOwn: false,
        ownUserId: OWN,
        otherUserId: null,
      })
    ).toBeNull();
  });
});

describe("listFollowRelations", () => {
  it("queries followers of the explicit target and batches profiles", async () => {
    const mock = mockFollowClient({
      followData: [
        { follower_id: ADA, created_at: "2026-08-22T10:00:00Z" },
        { follower_id: ADA, created_at: "2026-08-22T09:00:00Z" },
        { follower_id: SAM, created_at: "2026-08-21T10:00:00Z" },
      ],
      profileData: [
        {
          id: SAM,
          username: "sam",
          display_name: "Sam",
          full_name: "Sam",
          avatar_url: null,
          avatar_initial: "S",
        },
        {
          id: ADA,
          username: "ada",
          display_name: "Ada",
          full_name: "Ada",
          avatar_url: "https://cdn.example/a.png",
          avatar_initial: "A",
        },
      ],
    });

    const page = await listFollowRelations(mock.client as never, {
      targetUserId: OTHER,
      kind: "followers",
    });

    expect(mock.follows.eqCalls).toEqual([["following_id", OTHER]]);
    expect(mock.follows.eqCalls[0]?.[1]).not.toBe(OWN);
    expect(mock.follows.orderCalls).toEqual(["created_at", "follower_id"]);
    expect(mock.follows.rangeCalls[0]).toEqual([0, FOLLOW_LIST_PAGE_SIZE]);
    expect(mock.profiles.fromCount).toBe(1);
    expect(mock.profiles.inCalls).toHaveLength(1);
    expect(page.members.map((row) => row.userId)).toEqual([ADA, SAM]);
    expect(page.members[0]?.username).toBe("ada");
  });

  it("queries accounts the explicit target follows", async () => {
    const mock = mockFollowClient({
      followData: [{ following_id: ADA, created_at: "2026-08-22T10:00:00Z" }],
      profileData: [
        {
          id: ADA,
          username: "ada",
          display_name: "Ada",
          full_name: "Ada",
          avatar_url: null,
          avatar_initial: "A",
        },
      ],
    });
    const page = await listFollowRelations(mock.client as never, {
      targetUserId: OWN,
      kind: "following",
    });
    expect(mock.follows.eqCalls).toEqual([["follower_id", OWN]]);
    expect(page.members).toHaveLength(1);
    expect(page.members[0]?.userId).toBe(ADA);
  });

  it("does not query when the target id is missing", async () => {
    const mock = mockFollowClient({ followData: [] });
    const page = await listFollowRelations(mock.client as never, {
      targetUserId: "",
      kind: "followers",
    });
    expect(page.failed).toBe(true);
    expect(page.members).toEqual([]);
    expect(mock.follows.eqCalls).toEqual([]);
    expect(mock.profiles.fromCount).toBe(0);
  });

  it("omits private or missing public profiles", async () => {
    const mock = mockFollowClient({
      followData: [{ follower_id: ADA, created_at: "2026-08-22T10:00:00Z" }],
      profileData: [],
    });
    const page = await listFollowRelations(mock.client as never, {
      targetUserId: OTHER,
      kind: "followers",
    });
    expect(page.members).toEqual([]);
    expect(page.failed).toBeUndefined();
  });
});

describe("no mock or counter-only list source", () => {
  it("plans an authoritative profile_follows query instead of counts", () => {
    const followers = planFollowListQuery("followers");
    const following = planFollowListQuery("following");
    expect(followers.table).toBe("profile_follows");
    expect(following.table).toBe("profile_follows");
    expect(followers.targetColumn).not.toBe(following.targetColumn);
    expect(FOLLOW_LIST_PAGE_SIZE).toBeGreaterThan(0);
  });
});
