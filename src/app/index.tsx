import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Badge, Button, Card, Eyebrow } from "@/components/ui";
import { config, missingConfig } from "@/config";
import { describeError, health, openSession } from "@/memory/memory";
import { usePhonon } from "@/phonon/PhononProvider";
import { useProjects } from "@/store/projects";
import { colors, space, type } from "@/theme";

const EXAMPLES = ["On-device speech for mobile apps", "Agent memory architectures", "Remote team rituals"];

export default function ProjectsScreen() {
	const projects = useProjects((s) => s.projects);
	const createProject = useProjects((s) => s.createProject);
	const setSession = useProjects((s) => s.setSession);
	const [topic, setTopic] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const missing = missingConfig();
	const phonon = usePhonon();
	const [memoryStatus, setMemoryStatus] = useState<"checking" | "ok" | "down" | "unset">(() =>
		missing.length ? "unset" : "checking",
	);

	useEffect(() => {
		if (missing.length) return;
		health()
			.then(() => setMemoryStatus("ok"))
			.catch((err) => {
				setMemoryStatus("down");
				setError(describeError(err));
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function start(name = topic) {
		const trimmed = name.trim();
		if (!trimmed) return;
		setBusy(true);
		setError(undefined);
		const project = createProject(trimmed);
		try {
			setSession(project.id, await openSession(project, trimmed));
		} catch (err) {
			// The project still works without a session; remember() opens one itself.
			setError(`Could not open an Agent Memory session: ${describeError(err)}`);
		} finally {
			setBusy(false);
			setTopic("");
		}
		router.push({ pathname: "/project/[id]", params: { id: project.id } });
	}

	return (
		<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
			<FlatList
				contentContainerStyle={styles.content}
				data={projects}
				keyExtractor={(p) => p.id}
				ListHeaderComponent={
					<View style={styles.header}>
						<Eyebrow>Gradium Phonon × SurrealDB Agent Memory</Eyebrow>
						<Text style={type.h1}>
							Collect notes. <Text style={{ color: colors.textSecondary }}>Let the agent research them.</Text>
						</Text>
						<Text style={type.secondary}>
							Notes are stored in Agent Memory, the agent researches over that memory, and Phonon reads the findings
							aloud on your device.
						</Text>

						<View style={styles.statusRow}>
							<Badge tone={memoryStatus === "ok" ? "success" : memoryStatus === "checking" ? "warning" : "error"}>
								{memoryStatus === "ok"
									? "Agent Memory connected"
									: memoryStatus === "checking"
										? "Agent Memory checking"
										: memoryStatus === "unset"
											? "Agent Memory not configured"
											: "Agent Memory unreachable"}
							</Badge>
						</View>

						{phonon.status === "error" ? (
							<Card style={{ borderColor: colors.error }}>
								<Text style={type.body}>Phonon (on-device speech) is offline</Text>
								<Text style={type.muted}>{phonon.error}</Text>
								<Text style={type.muted}>{`Bridge: ${config.phonon.bridgeUrl}`}</Text>
								<Button title="Retry" style={{ alignSelf: "flex-start" }} onPress={phonon.reload} />
							</Card>
						) : null}

						{missing.length ? (
							<Card style={{ borderColor: colors.warning }}>
								<Text style={type.body}>Add these to `.env`, then restart Expo:</Text>
								<Text style={type.muted}>{missing.join("\n")}</Text>
							</Card>
						) : null}

						<Card>
							<Text style={type.label}>New research topic</Text>
							<TextInput
								value={topic}
								onChangeText={setTopic}
								placeholder="What do you want to research?"
								placeholderTextColor={colors.textMuted}
								style={styles.input}
								returnKeyType="go"
								onSubmitEditing={() => start()}
							/>
							<View style={styles.examples}>
								{EXAMPLES.map((example) => (
									<Pressable key={example} onPress={() => setTopic(example)} style={styles.chip}>
										<Text style={type.muted}>{example}</Text>
									</Pressable>
								))}
							</View>
							<Button title="Start collecting" filled busy={busy} disabled={!topic.trim()} onPress={() => start()} />
							{error ? <Text style={[type.muted, { color: colors.error }]}>{error}</Text> : null}
						</Card>

						{projects.length ? <Text style={[type.label, { marginTop: space.md }]}>Your projects</Text> : null}
					</View>
				}
				ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
				renderItem={({ item }) => (
					<Pressable onPress={() => router.push({ pathname: "/project/[id]", params: { id: item.id } })}>
						<Card>
							<Text style={type.h2}>{item.topic}</Text>
							<View style={styles.meta}>
								<Badge>{`${item.notes.length} notes`}</Badge>
								{item.report ? <Badge tone="accent">Report ready</Badge> : null}
								<Badge>{`scope project/${item.id}`}</Badge>
							</View>
						</Card>
					</Pressable>
				)}
			/>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, backgroundColor: colors.page },
	content: { padding: space.lg, paddingBottom: space.xxl * 2 },
	header: { gap: space.md, marginBottom: space.sm },
	statusRow: { flexDirection: "row", gap: space.sm },
	input: {
		color: colors.text,
		fontSize: 16,
		paddingHorizontal: space.md,
		paddingVertical: 10,
		borderRadius: 4,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.line,
		backgroundColor: colors.sunken,
	},
	examples: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
	chip: {
		paddingHorizontal: space.md,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.line,
	},
	meta: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
