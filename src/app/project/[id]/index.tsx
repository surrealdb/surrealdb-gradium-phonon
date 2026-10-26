import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NoteRow } from "@/components/NoteRow";
import { Button, Card, Eyebrow } from "@/components/ui";
import { addNote, describeError } from "@/memory/memory";
import { SAMPLE_NOTES } from "@/samples";
import { useProject, useProjects, type Project } from "@/store/projects";
import { colors, space, type } from "@/theme";

/** Collect → store: every note goes straight into Agent Memory under the project's scope. */
export default function NotesScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const project = useProject(id);
	const store = useProjects();
	const [draft, setDraft] = useState("");

	if (!project) return <Text style={[type.body, { padding: space.lg }]}>Project not found.</Text>;

	async function save(p: Project, text: string, existingId?: string) {
		const noteId = existingId ?? store.addNote(p.id, text).id;
		if (existingId) store.updateNote(p.id, noteId, { status: "saving", error: undefined });
		try {
			const extracted = await addNote({ id: p.id, sessionId: p.sessionId }, text);
			store.updateNote(p.id, noteId, { status: "stored", extracted });
		} catch (err) {
			store.updateNote(p.id, noteId, { status: "failed", error: describeError(err) });
		}
	}

	function submit() {
		const text = draft.trim();
		if (!text || !project) return;
		setDraft("");
		void save(project, text);
	}

	async function addSamples() {
		if (!project) return;
		// One at a time keeps extraction order stable and the list readable.
		for (const text of SAMPLE_NOTES[project.topic] ?? []) await save(project, text);
	}

	const stored = project.notes.filter((n) => n.status === "stored").length;
	const saving = project.notes.some((n) => n.status === "saving");
	const samples = SAMPLE_NOTES[project.topic];

	return (
		<SafeAreaView edges={["bottom"]} style={styles.flex}>
			<Stack.Screen options={{ title: project.topic }} />
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				keyboardVerticalOffset={100}
			>
				<FlatList
					contentContainerStyle={styles.content}
					data={project.notes}
					keyExtractor={(n) => n.id}
					ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
					ListHeaderComponent={
						<View style={styles.header}>
							<Eyebrow>Step 1 · Collect</Eyebrow>
							<Text style={type.secondary}>
								Each note is written to Agent Memory with scope{" "}
								<Text style={{ color: colors.text }}>{`project/${project.id}`}</Text>. Agent Memory extracts entities
								and facts as it stores it.
							</Text>
							<Card>
								<TextInput
									value={draft}
									onChangeText={setDraft}
									placeholder="Paste a quote, a link summary, an idea…"
									placeholderTextColor={colors.textMuted}
									style={styles.input}
									multiline
								/>
								<View style={styles.row}>
									<Button title="Add note" disabled={!draft.trim()} onPress={submit} />
									{samples && project.notes.length === 0 ? (
										<Button title={`Add ${samples.length} sample notes`} onPress={addSamples} />
									) : null}
								</View>
							</Card>
						</View>
					}
					ListEmptyComponent={<Text style={type.muted}>No notes yet.</Text>}
					renderItem={({ item }) => (
						<NoteRow
							note={item}
							onRetry={() => save(project, item.text, item.id)}
							onRemove={() => store.removeNote(project.id, item.id)}
						/>
					)}
				/>
				<View style={styles.footer}>
					{project.report ? (
						<Button
							title="Findings"
							onPress={() => router.push({ pathname: "/project/[id]/report", params: { id: project.id } })}
						/>
					) : null}
					<Button
						title={stored ? `Research ${stored} notes` : "Research"}
						filled
						style={styles.grow}
						disabled={stored === 0 || saving}
						onPress={() => router.push({ pathname: "/project/[id]/research", params: { id: project.id } })}
					/>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, backgroundColor: colors.page },
	content: { padding: space.lg, paddingBottom: space.xxl },
	header: { gap: space.md, marginBottom: space.md },
	input: {
		minHeight: 88,
		color: colors.text,
		fontSize: 15,
		padding: space.md,
		borderRadius: 4,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.line,
		backgroundColor: colors.sunken,
		textAlignVertical: "top",
	},
	row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
	footer: {
		flexDirection: "row",
		gap: space.sm,
		padding: space.lg,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.line,
		backgroundColor: colors.sunken,
	},
	grow: { flex: 1 },
});
