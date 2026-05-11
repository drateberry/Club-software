import { Image, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { useMe } from "@/lib/hooks";
import { config } from "@/lib/config";

export default function MemberPass() {
  const me = useMe();

  if (!me.data?.passToken) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Card>
          <Text className="text-sm text-gray-500">
            Your member pass hasn&apos;t been issued yet. Ask club staff to enable
            check-in for your account.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6">
      <Card className="items-center">
        <Text className="mb-1 text-xs uppercase text-gray-500">
          {me.data.clubName}
        </Text>
        <Text className="mb-3 text-xl font-semibold">
          {me.data.member ? `${me.data.member.firstName} ${me.data.member.lastName}` : me.data.email}
        </Text>
        <Image
          source={{ uri: `${config.apiBase}/api/pass/${me.data.passToken}` }}
          style={{ width: 240, height: 240 }}
          resizeMode="contain"
        />
        <Text className="mt-3 text-center text-xs text-gray-500">
          Staff scans this code to check you in.
        </Text>
      </Card>
    </View>
  );
}
