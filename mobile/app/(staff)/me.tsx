import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useMe } from "@/lib/hooks";
import { signOut } from "@/lib/auth";

export default function StaffMe() {
  const me = useMe();

  if (!me.data) return null;
  const m = me.data.member;

  const onSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="space-y-3 p-4">
        <Card>
          <Text className="text-xs uppercase text-gray-500">Signed in</Text>
          <Text className="mt-1 text-lg font-semibold">{me.data.email}</Text>
          <Text className="text-xs text-gray-500">
            {me.data.role}
            {m ? ` · linked to ${m.firstName} ${m.lastName}` : ""}
          </Text>
        </Card>

        <Card>
          <Text className="text-xs uppercase text-gray-500">Granted scopes</Text>
          <Text className="mt-1 text-xs leading-5 text-gray-600">
            {me.data.tokenScopes.join("\n")}
          </Text>
        </Card>

        <Card>
          <Text className="text-xs uppercase text-gray-500">Club</Text>
          <Text className="mt-1 text-base font-semibold">{me.data.clubName}</Text>
          <Text className="text-xs text-gray-500">
            {me.data.locale} · {me.data.currency} · {me.data.timezone}
          </Text>
        </Card>

        <Button title="Sign out" variant="secondary" onPress={onSignOut} />
      </View>
    </ScrollView>
  );
}
