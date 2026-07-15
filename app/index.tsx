import { Redirect } from "expo-router";

import { useAuth } from "@/src/lib/auth/AuthContext";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (session) {
    return <Redirect href="/(tabs)/watch" />;
  }

  return <Redirect href="/(auth)/login" />;
}
