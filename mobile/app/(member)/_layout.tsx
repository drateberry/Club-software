import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function MemberTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: "#000" }}>
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: "Invoices",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="payment-methods"
        options={{
          title: "Payment",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pass"
        options={{
          title: "Pass",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
