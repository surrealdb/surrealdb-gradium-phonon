import { Pressable, StyleSheet, Text } from "react-native";
import { usePhonon } from "@/phonon/PhononProvider";
import { colors, mono, space } from "@/theme";
import { Dot } from "./ui";

/** Shows where on-device speech is at; tap to reload after an error. */
export function PhononStatusPill() {
	const phonon = usePhonon();
	const { status, progress, info } = phonon;

	const label =
		status === "connecting"
			? "Phonon · connecting"
			: status === "loading"
				? `Phonon · loading ${Math.round(progress * 100)}%`
				: status === "speaking"
					? "Phonon · speaking"
					: status === "error"
						? "Phonon · offline"
						: `Phonon · ready${info ? ` (${info.device}${info.threads > 1 ? ` ×${info.threads}` : ""})` : ""}`;

	const tone = status === "error" ? "error" : status === "speaking" ? "accent" : status === "ready" ? "success" : "warning";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${label}. ${status === "error" ? "Tap to retry." : ""}`}
			onPress={status === "error" ? phonon.reload : status === "speaking" ? phonon.stop : undefined}
			style={styles.pill}
		>
			<Dot tone={tone} />
			<Text style={styles.text}>{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingHorizontal: space.md,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.line,
		backgroundColor: colors.surface,
	},
	text: { color: colors.textSecondary, fontFamily: mono, fontSize: 11 },
});
