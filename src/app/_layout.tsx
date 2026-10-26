import "@/polyfills";

import { setAudioModeAsync } from "expo-audio";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { PhononStatusPill } from "@/components/PhononStatusPill";
import { PhononProvider } from "@/phonon/PhononProvider";
import { colors } from "@/theme";

export default function RootLayout() {
	useEffect(() => {
		// Phonon plays through the WebView's WebAudio, which shares the app's
		// audio session: without this the iOS silent switch mutes it.
		setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
	}, []);

	return (
		<PhononProvider>
			<StatusBar style="light" />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: colors.page },
					headerTintColor: colors.text,
					headerTitleStyle: { fontWeight: "400" },
					headerShadowVisible: false,
					contentStyle: { backgroundColor: colors.page },
					headerRight: () => <PhononStatusPill />,
				}}
			>
				<Stack.Screen name="index" options={{ title: "Research agent" }} />
				<Stack.Screen name="project/[id]/index" options={{ title: "Notes" }} />
				<Stack.Screen name="project/[id]/research" options={{ title: "Research" }} />
				<Stack.Screen name="project/[id]/report" options={{ title: "Findings" }} />
			</Stack>
		</PhononProvider>
	);
}
