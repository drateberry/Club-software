import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useCheckin, useRecentCheckins } from "@/lib/hooks";
import { formatDateTime } from "@/lib/format";

export default function StaffCheckin() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const checkin = useCheckin();
  const recent = useRecentCheckins();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScanned = async ({ data }: { data: string }) => {
    if (!scanning || checkin.isPending) return;
    setScanning(false);

    const match = /\/checkin\/([a-f0-9]+)$/.exec(data);
    const passToken = match?.[1];
    if (!passToken) {
      Alert.alert("Unrecognized code", "This QR code isn't a member pass.");
      return;
    }

    try {
      const res = await checkin.mutateAsync({ passToken });
      if ("ok" in res && res.ok) {
        setLastResult(`Checked in: ${res.memberName}`);
      } else if ("warning" in res) {
        setLastResult(`${res.memberName}: ${res.warning} (${res.membershipStatus})`);
      } else if ("error" in res) {
        setLastResult(`Error: ${res.error}`);
      }
    } catch (err) {
      Alert.alert("Check-in failed", (err as Error).message);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4">
        <Card>
          <Text className="text-sm font-semibold">Scan member pass</Text>
          {!permission?.granted ? (
            <Button
              title="Allow camera"
              variant="secondary"
              onPress={requestPermission}
              className="mt-3"
            />
          ) : !scanning ? (
            <Button
              title="Start scanner"
              onPress={() => {
                setScanning(true);
                setLastResult(null);
              }}
              className="mt-3"
            />
          ) : (
            <View className="mt-3">
              <View className="aspect-square overflow-hidden rounded-lg">
                <CameraView
                  style={{ flex: 1 }}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={handleScanned}
                />
              </View>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setScanning(false)}
                className="mt-3"
              />
            </View>
          )}
          {lastResult && (
            <Text className="mt-3 rounded bg-green-50 p-2 text-sm text-green-900">
              {lastResult}
            </Text>
          )}
        </Card>
      </View>

      <View className="flex-1 px-4">
        <Text className="mb-2 text-xs uppercase text-gray-500">Recent check-ins</Text>
        {(recent.data?.data ?? []).map((log) => (
          <Card key={log.id} className="mb-2">
            <Text className="text-sm">
              {log.member.firstName} {log.member.lastName}
            </Text>
            <Text className="text-xs text-gray-500">
              {formatDateTime(log.scannedAt)}
            </Text>
          </Card>
        ))}
      </View>
    </View>
  );
}
