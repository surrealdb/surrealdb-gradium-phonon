import { Platform, StyleSheet } from "react-native";

/**
 * Dark theme after the SurrealDB brand guide: Obsidian surfaces, Slate text,
 * hairline borders instead of shadows, and Violet (the Agent Memory product
 * colour) spent on one action per screen.
 */
export const colors = {
	page: "#191723",
	surface: "#242132",
	raised: "#2E2A3F",
	sunken: "#111018",
	line: "rgba(112,109,143,0.30)",
	text: "#F5F7FA",
	textSecondary: "#8F99AC",
	textMuted: "#79849A",
	textDisabled: "#777A87",
	accent: "#8034FF",
	accentTint: "rgba(128,52,255,0.16)",
	accentText: "#B794FF",
	success: "#3FCF8E",
	warning: "#F2A93B",
	error: "#FF5C7A",
	info: "#46B9EF",
};

export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const type = StyleSheet.create({
	h1: { color: colors.text, fontSize: 28, lineHeight: 32, fontWeight: "400", letterSpacing: -0.6 },
	h2: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "400", letterSpacing: -0.3 },
	body: { color: colors.text, fontSize: 15, lineHeight: 22 },
	secondary: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
	muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
	eyebrow: {
		color: colors.accentText,
		fontFamily: mono,
		fontSize: 11,
		letterSpacing: 1.4,
		textTransform: "uppercase",
	},
	label: { color: colors.textSecondary, fontFamily: mono, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" },
});

/** Styles for react-native-markdown-display. */
export const markdownStyles = StyleSheet.create({
	body: { color: colors.text, fontSize: 15, lineHeight: 22 },
	heading1: { color: colors.text, fontSize: 22, fontWeight: "400", marginTop: space.md, marginBottom: space.sm },
	heading2: { color: colors.text, fontSize: 18, fontWeight: "400", marginTop: space.lg, marginBottom: space.sm },
	heading3: { color: colors.text, fontSize: 16, fontWeight: "500", marginTop: space.md },
	strong: { fontWeight: "500" },
	bullet_list: { marginVertical: space.xs },
	list_item: { marginVertical: 2 },
	code_inline: { fontFamily: mono, backgroundColor: colors.sunken, color: colors.accentText },
	link: { color: colors.accentText },
	blockquote: { backgroundColor: colors.sunken, borderLeftColor: colors.accent, borderLeftWidth: 2 },
	hr: { backgroundColor: colors.line },
});
