import { FlatList, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { useConversations } from "@/lib/hooks";
import { formatDateTime } from "@/lib/format";

export default function StaffMessages() {
  const conversations = useConversations();

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={conversations.data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => (
          <Card>
            <View className="flex-row items-baseline justify-between">
              <Text className="font-medium">
                {item.member
                  ? `${item.member.firstName} ${item.member.lastName}`
                  : item.phone}
              </Text>
              {item.unread && (
                <Text className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  New
                </Text>
              )}
            </View>
            <Text className="mt-0.5 text-xs text-gray-500">
              {formatDateTime(item.lastMessageAt)} · {item._count.messages} messages
            </Text>
            {item.optedOut && (
              <Text className="mt-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] uppercase text-red-900 self-start">
                Opted out
              </Text>
            )}
          </Card>
        )}
        ListEmptyComponent={
          conversations.isLoading ? null : (
            <Card>
              <Text className="text-sm text-gray-500">No conversations.</Text>
            </Card>
          )
        }
      />
    </View>
  );
}
