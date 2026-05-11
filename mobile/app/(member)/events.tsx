import { ScrollView, Text, View, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useEvents, useRsvpEvent, useBuyTicket, useMe } from "@/lib/hooks";
import { formatDateTime, formatMoney } from "@/lib/format";

export default function MemberEvents() {
  const me = useMe();
  const events = useEvents();
  const rsvp = useRsvpEvent();
  const buyTicket = useBuyTicket();

  if (events.isLoading || !me.data) return null;
  const list = events.data?.data ?? [];

  const onRsvp = async (eventId: string, status: "GOING" | "MAYBE" | "DECLINED") => {
    try {
      await rsvp.mutateAsync({ eventId, status });
    } catch (err) {
      Alert.alert("RSVP failed", (err as Error).message);
    }
  };

  const onBuy = async (eventId: string) => {
    try {
      const { checkoutUrl } = await buyTicket.mutateAsync({ eventId });
      await WebBrowser.openBrowserAsync(checkoutUrl);
    } catch (err) {
      Alert.alert("Ticket purchase failed", (err as Error).message);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="space-y-3 p-4">
        {list.length === 0 && (
          <Card>
            <Text className="text-sm text-gray-500">No upcoming events.</Text>
          </Card>
        )}
        {list.map((e) => (
          <Card key={e.id}>
            <Text className="text-lg font-semibold">{e.title}</Text>
            <Text className="text-xs text-gray-500">
              {formatDateTime(e.startAt, me.data!.locale)}
              {e.venue ? ` · ${e.venue}` : ""}
            </Text>
            {e.capacity && (
              <Text className="mt-1 text-xs text-gray-500">
                {e._count.attendances} / {e.capacity} going
              </Text>
            )}
            <View className="mt-3 flex-row gap-2">
              {e.isTicketed ? (
                <Button
                  title={`Buy ticket · ${formatMoney(e.memberPriceCents, me.data!.currency)}`}
                  onPress={() => onBuy(e.id)}
                  disabled={buyTicket.isPending}
                />
              ) : (
                <>
                  <Button
                    title="Going"
                    onPress={() => onRsvp(e.id, "GOING")}
                    disabled={rsvp.isPending}
                    className="flex-1"
                  />
                  <Button
                    title="Maybe"
                    variant="secondary"
                    onPress={() => onRsvp(e.id, "MAYBE")}
                    disabled={rsvp.isPending}
                    className="flex-1"
                  />
                </>
              )}
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
