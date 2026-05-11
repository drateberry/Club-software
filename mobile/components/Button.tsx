import { Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "danger";

export function Button({
  title,
  variant = "primary",
  className = "",
  disabled,
  ...rest
}: PressableProps & { title: string; variant?: Variant; className?: string }) {
  const styles = {
    primary: "bg-black",
    secondary: "bg-white border border-gray-300",
    danger: "bg-white border border-red-300",
  }[variant];
  const textStyles = {
    primary: "text-white",
    secondary: "text-gray-900",
    danger: "text-red-700",
  }[variant];
  return (
    <Pressable
      disabled={disabled}
      className={`rounded-lg px-4 py-3 active:opacity-80 ${styles} ${disabled ? "opacity-50" : ""} ${className}`}
      {...rest}
    >
      <Text className={`text-center text-sm font-semibold ${textStyles}`}>{title}</Text>
    </Pressable>
  );
}
