import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Note } from "@/store/projects";
import { colors, space, type } from "@/theme";
import { Badge, Card } from "./ui";

export function NoteRow({ note, onRetry, onRemove }: { note: Note; onRetry(): void; onRemove(): void }) {
	const entities = note.extracted?.entities ?? [];
	return (
		<Card>
			<Text style={type.body}>{note.text}</Text>
			<View style={styles.meta}>
				{note.status === "saving" ? (
					<View style={styles.saving}>
						<ActivityIndicator size="small" color={colors.textSecondary} />
						<Text style={type.muted}>Storing in Agent Memory…</Text>
					</View>
				) : note.status === "stored" ? (
					<>
						<Badge tone="success">Stored</Badge>
						{note.extracted ? <Badge>{`${note.extracted.facts} ${note.extracted.facts === 1 ? "fact" : "facts"}`}</Badge> : null}
						{entities.slice(0, 6).map((e) => (
							<Badge key={`${e.type}:${e.name}`} tone="accent">
								{`${e.type} · ${e.name}`}
							</Badge>
						))}
					</>
				) : (
					<>
						<Badge tone="error">Not stored</Badge>
						<Pressable onPress={onRetry} hitSlop={8}>
							<Text style={[type.muted, { color: colors.accentText }]}>Retry</Text>
						</Pressable>
						<Pressable onPress={onRemove} hitSlop={8}>
							<Text style={type.muted}>Remove</Text>
						</Pressable>
					</>
				)}
			</View>
			{note.error ? <Text style={[type.muted, { color: colors.error }]}>{note.error}</Text> : null}
		</Card>
	);
}

const styles = StyleSheet.create({
	meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
	saving: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
