import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, mono, space, type } from "@/theme";

type Tone = "neutral" | "accent" | "success" | "warning" | "error" | "info";

const toneColor: Record<Tone, string> = {
	neutral: colors.textSecondary,
	accent: colors.accentText,
	success: colors.success,
	warning: colors.warning,
	error: colors.error,
	info: colors.info,
};

/** Pill button. `filled` is the one call to action per screen. */
export function Button({
	title,
	onPress,
	filled,
	disabled,
	busy,
	style,
}: {
	title: string;
	onPress?: () => void;
	filled?: boolean;
	disabled?: boolean;
	busy?: boolean;
	style?: StyleProp<ViewStyle>;
}) {
	const off = disabled || busy;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled: off, busy }}
			onPress={onPress}
			disabled={off}
			style={({ pressed }) => [
				styles.button,
				filled && !off ? styles.buttonFilled : styles.buttonQuiet,
				off && styles.buttonDisabled,
				pressed && { transform: [{ scale: 0.97 }] },
				style,
			]}
		>
			{busy ? <ActivityIndicator size="small" color={colors.text} style={{ marginRight: space.sm }} /> : null}
			<Text style={[styles.buttonText, off && { color: colors.textDisabled }]}>{title}</Text>
		</Pressable>
	);
}

/** Square, monospace, tinted label. */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
	const color = toneColor[tone];
	return (
		<View style={[styles.badge, { borderColor: color }]}>
			<Text style={[styles.badgeText, { color }]}>{children}</Text>
		</View>
	);
}

/** Square surface card with a hairline edge. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
	return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
	return <Text style={type.eyebrow}>{children}</Text>;
}

export function Dot({ tone }: { tone: Tone }) {
	return <View style={[styles.dot, { backgroundColor: toneColor[tone] }]} />;
}

const styles = StyleSheet.create({
	button: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: space.lg,
		paddingVertical: 10,
		borderRadius: 999,
	},
	buttonFilled: { backgroundColor: colors.accent },
	buttonQuiet: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.surface },
	buttonDisabled: { opacity: 0.6 },
	buttonText: { color: colors.text, fontSize: 15, fontWeight: "500" },
	badge: {
		alignSelf: "flex-start",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderWidth: StyleSheet.hairlineWidth,
		backgroundColor: "rgba(255,255,255,0.03)",
	},
	badgeText: { fontFamily: mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" },
	card: {
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.line,
		padding: space.lg,
		gap: space.sm,
	},
	dot: { width: 8, height: 8, borderRadius: 4 },
});
