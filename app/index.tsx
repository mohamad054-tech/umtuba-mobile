import { Redirect } from "expo-router";

import { useAuth } from "@/src/lib/auth/AuthContext";

export default function Index() {
  const { session, loading, passwordRecoveryPending } = useAuth();

  if (loading) {
    return null;
  }

  if (session && passwordRecoveryPending) {
    return <Redirect href="/(auth)/update-password" />;
  }

  if (session) {
    return <Redirect href="/(tabs)/watch" />;
  }

  return <Redirect href="/(auth)/login" />;
}
