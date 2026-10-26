import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge, Button, Card, Eyebrow } from "@/components/ui";
import { usePhonon } from "@/phonon/PhononProvider";
import { sentences } from "@/phonon/sentenceChunker";
import { useProject } from "@/store/projects";
import { colors, markdownStyles, space, type } from "@/theme";

/** Step 3: the findings, readable and listenable (Phonon, on-device). */
export default function ReportScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const project = useProject(id);
	const phonon = usePhonon();
	const report = project?.report;

	if (!project || !report) {
		return (
			<View style={styles.empty}>
				<Text style={type.body}>No findings yet.</Text>
				<Button title="Back to notes" onPress={() => router.back()} />
			</View>
		);
	}

	function listen(text: string) {
		const [first, ...rest] = sentences(text);
		if (!first) return;
		phonon.speak(first);
		for (const sentence of rest) phonon.enqueue(sentence);
	}

	const speaking = phonon.status === "speaking";
	const canSpeak = phonon.status === "ready" || speaking;

	return (
		<SafeAreaView edges={["bottom"]} style={styles.flex}>
			<ScrollView contentContainerStyle={styles.content}>
				<Eyebrow>Step 3 · Findings</Eyebrow>
				<Text style={type.h2}>{project.topic}</Text>
				<View style={styles.meta}>
					<Badge>{new Date(report.createdAt).toLocaleString()}</Badge>
					<Badge>{`${report.findings.length} findings in memory`}</Badge>
					{phonon.firstAudioMs !== undefined ? (
						<Badge tone="accent">{`Phonon first audio ${phonon.firstAudioMs}ms`}</Badge>
					) : null}
				</View>

				<Card>
					<Markdown style={markdownStyles}>{report.markdown}</Markdown>
				</Card>

				{report.findings.length ? <Text style={type.label}>Per-question findings</Text> : null}
				{report.findings.map((f, i) => (
					<Card key={i}>
						<Text style={type.body}>{f.question}</Text>
						<Text style={type.secondary}>{f.answer}</Text>
						<Button title="Listen" style={styles.self} disabled={!canSpeak} onPress={() => listen(f.answer)} />
					</Card>
				))}

				{report.citations.length ? (
					<>
						<Text style={type.label}>Sources cited from memory</Text>
						{report.citations.map((c) => (
							<Card key={c.id}>
								<View style={styles.meta}>
									<Badge tone="info">{c.kind}</Badge>
									{c.role ? <Badge>{c.role}</Badge> : null}
									<Badge>{`score ${c.score.toFixed(2)}`}</Badge>
								</View>
								<Text style={type.muted}>{c.snippet}</Text>
							</Card>
						))}
					</>
				) : null}

				{phonon.status === "error" ? (
					<Card style={{ borderColor: colors.error }}>
						<Text style={type.body}>Phonon is offline</Text>
						<Text style={type.muted}>{phonon.error}</Text>
						<Button title="Retry" style={styles.self} onPress={phonon.reload} />
					</Card>
				) : null}
			</ScrollView>

			<View style={styles.footer}>
				<Button title="Research again" onPress={() => router.replace({ pathname: "/project/[id]/research", params: { id: project.id } })} />
				{speaking ? (
					<Button title="Stop" style={styles.grow} onPress={phonon.stop} />
				) : (
					<Button
						title={phonon.status === "loading" ? `Loading voice ${Math.round(phonon.progress * 100)}%` : "Listen to findings"}
						filled
						style={styles.grow}
						disabled={!canSpeak}
						onPress={() => listen(report.markdown)}
					/>
				)}
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, backgroundColor: colors.page },
	content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
	empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, backgroundColor: colors.page },
	meta: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
	self: { alignSelf: "flex-start" },
	grow: { flex: 1 },
	footer: {
		flexDirection: "row",
		gap: space.sm,
		padding: space.lg,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.line,
		backgroundColor: colors.sunken,
	},
});
