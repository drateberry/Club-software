import { ScrollView, Text, View, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useInvoices, useMe } from "@/lib/hooks";
import { config } from "@/lib/config";
import { formatDate, formatMoney } from "@/lib/format";

export default function MemberInvoices() {
  const me = useMe();
  const invoices = useInvoices();

  if (invoices.isLoading || !me.data) return null;

  const openPay = async (paymentToken: string) => {
    try {
      await WebBrowser.openBrowserAsync(`${config.apiBase}/pay/${paymentToken}`);
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    }
  };

  const list = invoices.data?.data ?? [];
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="space-y-3 p-4">
        {list.length === 0 && (
          <Card>
            <Text className="text-sm text-gray-500">No invoices yet.</Text>
          </Card>
        )}
        {list.map((inv) => {
          const nextDue = inv.installments.find((i) => i.status !== "PAID");
          const owingCents = nextDue
            ? nextDue.amountCents
            : inv.totalCents;
          return (
            <Card key={inv.id}>
              <View className="flex-row items-baseline justify-between">
                <Text className="font-semibold">{inv.number}</Text>
                <Text className="text-xs uppercase text-gray-500">{inv.status}</Text>
              </View>
              <Text className="mt-1 text-2xl font-semibold">
                {formatMoney(inv.totalCents, inv.currency, me.data!.locale)}
              </Text>
              {inv.dueDate && (
                <Text className="text-xs text-gray-500">Due {formatDate(inv.dueDate)}</Text>
              )}
              {inv.installments.length > 0 && (
                <View className="mt-3 border-t border-gray-100 pt-3">
                  <Text className="mb-1 text-xs uppercase text-gray-500">Installments</Text>
                  {inv.installments.map((i) => (
                    <View key={i.id} className="flex-row justify-between py-1">
                      <Text className="text-sm">
                        #{i.sequence} · {formatMoney(i.amountCents, inv.currency)}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {i.status === "PAID" ? "Paid" : `Due ${formatDate(i.dueDate)}`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {inv.status !== "PAID" && inv.status !== "VOID" && (
                <Button
                  title={`Pay ${formatMoney(owingCents, inv.currency, me.data!.locale)} now`}
                  className="mt-3"
                  onPress={() => {
                    // Member's pay page URL has no auth gate; pull paymentToken
                    // from invoice detail via /api/v1/invoices/[id] in a future
                    // refinement. For v1, the list endpoint doesn't include the
                    // token, so we open the invoice's web payment page via id.
                    Alert.alert(
                      "Open payment page",
                      "Card payment opens in your browser.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Open",
                          onPress: () => openPay(inv.id),
                        },
                      ]
                    );
                  }}
                />
              )}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}
