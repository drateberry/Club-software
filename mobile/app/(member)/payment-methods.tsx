import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { AddCardButton } from "@/components/AddCardSheet";
import { usePaymentMethods, useMe, useOpenCustomerPortal } from "@/lib/hooks";
import { formatDate } from "@/lib/format";

export default function PaymentMethodsScreen() {
  const me = useMe();
  const memberId = me.data?.member?.id;
  const methods = usePaymentMethods(memberId);
  const portal = useOpenCustomerPortal();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onPortal = async () => {
    try {
      const { url } = await portal.mutateAsync({});
      await WebBrowser.openBrowserAsync(url);
      // Best-effort refresh after the user returns to the app.
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
    } catch (err) {
      Alert.alert("Portal error", (err as Error).message);
    }
  };

  const onAdded = () => {
    setRefreshing(true);
    qc.invalidateQueries({ queryKey: ["payment-methods"] });
    setTimeout(() => setRefreshing(false), 1500);
  };

  if (!me.data) return null;

  const list = methods.data?.data ?? [];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="space-y-3 p-4">
        <Card>
          <Text className="text-xs uppercase text-gray-500">Saved methods</Text>
          {list.length === 0 ? (
            <Text className="mt-2 text-sm text-gray-500">
              No payment methods yet. Add a card below.
            </Text>
          ) : (
            <View className="mt-2 space-y-2">
              {list.map((pm) => {
                const expiry =
                  pm.expMonth && pm.expYear
                    ? `${String(pm.expMonth).padStart(2, "0")}/${String(pm.expYear).slice(-2)}`
                    : null;
                return (
                  <View
                    key={pm.id}
                    className="flex-row items-center justify-between rounded border border-gray-200 px-3 py-2"
                  >
                    <View>
                      <Text className="text-sm font-medium">
                        {(pm.brand ?? pm.kind).toUpperCase()} •••• {pm.last4}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {expiry ? `Exp ${expiry} · ` : ""}Added {formatDate(pm.createdAt)}
                      </Text>
                    </View>
                    {pm.isDefault && (
                      <Text className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] uppercase text-green-900">
                        Default
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <Card>
          <Text className="mb-1 text-xs uppercase text-gray-500">Add a card</Text>
          <Text className="mb-3 text-sm text-gray-600">
            Card details enter Stripe&apos;s native sheet and never touch the
            club&apos;s servers. {refreshing && "Refreshing…"}
          </Text>
          <AddCardButton onDone={onAdded} />
        </Card>

        <Card>
          <Text className="mb-1 text-xs uppercase text-gray-500">
            More options
          </Text>
          <Text className="mb-3 text-sm text-gray-600">
            Manage receipts, default cards, and billing history in Stripe&apos;s
            hosted portal.
          </Text>
          <Button
            title={portal.isPending ? "Opening…" : "Open Customer Portal"}
            variant="secondary"
            onPress={onPortal}
            disabled={portal.isPending}
          />
        </Card>
      </View>
    </ScrollView>
  );
}
