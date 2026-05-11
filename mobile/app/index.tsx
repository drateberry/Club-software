import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { getAccessToken } from "@/lib/api";
import { useMe } from "@/lib/hooks";

export default function Index() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    getAccessToken().then(setToken);
  }, []);

  const me = useMe();

  if (token === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }
  if (!token) return <Redirect href="/login" />;
  if (me.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }
  if (me.isError) return <Redirect href="/login" />;
  if (!me.data) return <Redirect href="/login" />;

  if (me.data.role === "MEMBER") return <Redirect href="/(member)/profile" />;
  return <Redirect href="/(staff)/members" />;
}
