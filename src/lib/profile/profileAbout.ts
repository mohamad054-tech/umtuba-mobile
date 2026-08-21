/**
 * Optional About extras. Mobile SELECT has no website / links / roles /
 * specialties / achievements columns — callers must pass empty extras
 * rather than inventing labels.
 */

import type { ProfileAboutLink } from "@/src/lib/profile/profileHeroSocialLinks";

export type ProfileAboutExtras = {
  website: string | null;
  links: ProfileAboutLink[];
  achievements: string[];
  roles: string[];
  interests: string[];
  specialties: string[];
};

export function emptyProfileAboutExtras(): ProfileAboutExtras {
  return {
    website: null,
    links: [],
    achievements: [],
    roles: [],
    interests: [],
    specialties: [],
  };
}
