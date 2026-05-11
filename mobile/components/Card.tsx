import { View, type ViewProps } from "react-native";

export function Card({ className = "", ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-xl bg-white p-4 shadow-sm border border-gray-100 ${className}`}
      {...rest}
    />
  );
}
