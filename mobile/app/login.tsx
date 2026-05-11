import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";
import { startSignIn } from "@/lib/auth";
import { Button } from "@/components/Button";
import { config } from "@/lib/config";

export default function Login() {
  const [pending, setPending] = useState(false);

  const onSignIn = async () => {
    setPending(true);
    try {
      await startSignIn();
      router.replace("/");
    } catch (err) {
      Alert.alert("Sign-in failed", (err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <Text className="mb-2 text-3xl font-bold">Club OS</Text>
      <Text className="mb-10 text-center text-sm text-gray-500">
        Sign in to your club using your existing email.
      </Text>
      <Button
        title={pending ? "Opening browser…" : "Sign in"}
        onPress={onSignIn}
        disabled={pending}
        className="w-full"
      />
      <Text className="mt-6 text-center text-[11px] text-gray-400">
        Connecting to {config.apiBase.replace(/^https?:\/\//, "")}
      </Text>
    </View>
  );
}
