import { ScrollView, Text, View, Alert } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useMe, useHouseBalance, useOpenCustomerPortal } from "@/lib/hooks";
import { signOut } from "@/lib/auth";
import { formatMoney } from "@/lib/format";

export default function MemberProfile() {
  const me = useMe();
  const balance = useHouseBalance();
  const portal = useOpenCustomerPortal();

  const onPortal = async () => {
    try {
      const { url } = await portal.mutateAsync({});
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      Alert.alert("Portal error", (err as Error).message);
    }
  };

  const onSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  if (!me.data) return null;
  const m = me.data.member;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="space-y-3 p-4">
        <Card>
          <Text className="text-xs uppercase text-gray-500">Welcome</Text>
          <Text className="text-2xl font-semibold">
            {m ? `${m.firstName} ${m.lastName}` : me.data.email}
          </Text>
          {m?.memberNumber && (
            <Text className="text-sm text-gray-500">#{m.memberNumber}</Text>
          )}
          {m && (
            <View className="mt-2 flex-row">
              <Text className="rounded bg-gray-100 px-2 py-1 text-[11px] uppercase text-gray-700">
                {m.membershipStatus}
                {m.membershipClass ? ` · ${m.membershipClass}` : ""}
              </Text>
            </View>
          )}
        </Card>

        {balance.data && (
          <Card>
            <Text className="text-xs uppercase text-gray-500">House account</Text>
            <Text className="mt-1 text-2xl font-semibold">
              {formatMoney(balance.data.totalCents, me.data.currency, me.data.locale)}
            </Text>
            <Text className="text-xs text-gray-500">
              {balance.data.charges.length} unbilled charges
            </Text>
          </Card>
        )}

        <Card>
          <Text className="text-xs uppercase text-gray-500">Payments</Text>
          <Text className="mt-1 mb-3 text-sm text-gray-600">
            Add or remove cards, see receipts in Stripe&apos;s Customer Portal.
          </Text>
          <Button
            title={portal.isPending ? "Opening…" : "Open Customer Portal"}
            variant="secondary"
            onPress={onPortal}
            disabled={portal.isPending}
          />
        </Card>

        <Button title="Sign out" variant="secondary" onPress={onSignOut} />
      </View>
    </ScrollView>
  );
}
