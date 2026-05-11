import { useState } from "react";
import { FlatList, Text, TextInput, View, Pressable } from "react-native";
import { Card } from "@/components/Card";
import { useMembers } from "@/lib/hooks";

export default function StaffMembers() {
  const [search, setSearch] = useState("");
  const members = useMembers(search);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white p-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email, or member #"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </View>
      <FlatList
        data={members.data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable>
            <Card>
              <View className="flex-row items-baseline justify-between">
                <Text className="text-base font-semibold">
                  {item.firstName} {item.lastName}
                </Text>
                <Text className="text-xs text-gray-500">
                  {item.memberNumber ? `#${item.memberNumber}` : ""}
                </Text>
              </View>
              <Text className="text-xs text-gray-500">
                {item.membershipStatus}
                {item.membershipClass ? ` · ${item.membershipClass}` : ""}
                {item.twilioOptedOut ? " · opted out of SMS" : ""}
              </Text>
              {item.email && (
                <Text className="mt-1 text-xs text-gray-400">{item.email}</Text>
              )}
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          members.isLoading ? null : (
            <Card>
              <Text className="text-sm text-gray-500">No members.</Text>
            </Card>
          )
        }
      />
    </View>
  );
}
