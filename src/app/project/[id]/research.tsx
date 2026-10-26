import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View, type ScrollViewInstance } from "react-native";
import Markdown from "react-native-markdown-display";
import { SafeAreaView } from "react-native-safe-area-context";
import { runResearch } from "@/agent/researchAgent";
import { emptyRun, reduceRun, type AgentEvent } from "@/agent/types";
import { StepCard } from "@/components/StepCard";
import { Badge, Button, Card, Eyebrow } from "@/components/ui";
import { usePhonon } from "@/phonon/PhononProvider";
import { SentenceChunker } from "@/phonon/sentenceChunker";
import { useProject, useProjects } from "@/store/projects";
import { colors, markdownStyles, space, type } from "@/theme";

/** Steps 2 and 3: the agent researches over Agent Memory, narrated by Phonon. */
export default function ResearchScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const project = useProject(id);
	const setReport = useProjects((s) => s.setReport);
	const phonon = usePhonon();
	const [run, dispatch] = useReducer(reduceRun, emptyRun);
	const [narrate, setNarrate] = useState(true);
	// Read by the running agent loop, which outlives any one render.
	const narrateRef = useRef(narrate);
	const controller = useRef<AbortController | null>(null);
	const scroll = useRef<ScrollViewInstance>(null);

	const say = useCallback(
		(text: string) => {
			if (narrateRef.current) phonon.enqueue(text);
		},
		[phonon],
	);

	const start = useCallback(async () => {
		if (!project) return;
		controller.current?.abort();
		const abort = new AbortController();
		controller.current = abort;
		phonon.stop();

		const chunker = new SentenceChunker();
		let questions: string[] = [];
		const findings: { question: string; answer: string }[] = [];
		const events = runResearch({
			project: { id: project.id, sessionId: project.sessionId },
			topic: project.topic,
			noteCount: project.notes.filter((n) => n.status === "stored").length,
			signal: abort.signal,
		});

		for await (const event of events as AsyncGenerator<AgentEvent>) {
			if (abort.signal.aborted) break;
			dispatch(event);
			switch (event.type) {
				case "plan":
					questions = event.questions;
					say(`I'll look into ${event.questions.length} questions.`);
					break;
				case "evidence":
					say(`Question ${event.index + 1}. Recalled ${event.hits.length} memories.`);
					break;
				case "answer":
					findings[event.index] = { question: questions[event.index] ?? "", answer: event.answer };
					break;
				case "synthesizing":
					say("Writing up the findings.");
					break;
				case "report-delta":
					for (const sentence of chunker.push(event.text)) say(sentence);
					break;
				case "report": {
					for (const sentence of chunker.flush()) say(sentence);
					setReport(project.id, {
						markdown: event.markdown,
						citations: event.citations,
						findings: findings.filter(Boolean),
						createdAt: new Date().toISOString(),
					});
					break;
				}
				case "error":
					if (event.index === undefined) say("Sorry, the research run failed.");
					break;
			}
			requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [project?.id]);

	useEffect(() => {
		void start();
		return () => controller.current?.abort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	if (!project) return <Text style={[type.body, { padding: space.lg }]}>Project not found.</Text>;

	const running = run.phase === "planning" || run.phase === "researching" || run.phase === "synthesizing";

	return (
		<SafeAreaView edges={["bottom"]} style={styles.flex}>
			<ScrollView ref={scroll} contentContainerStyle={styles.content}>
				<Eyebrow>Step 2 · Research</Eyebrow>
				<Text style={type.h2}>{project.topic}</Text>

				<View style={styles.narrate}>
					<View style={styles.grow}>
						<Text style={type.body}>Narrate with Phonon</Text>
						<Text style={type.muted}>On-device speech, generated on this phone as the agent works.</Text>
					</View>
					<Switch
						value={narrate}
						onValueChange={(v) => {
							setNarrate(v);
							narrateRef.current = v;
							if (!v) phonon.stop();
						}}
						trackColor={{ true: colors.accent, false: colors.raised }}
					/>
				</View>

				<Card>
					<View style={styles.phaseRow}>
						<Badge tone={run.phase === "failed" ? "error" : run.phase === "done" ? "success" : "accent"}>
							{run.phase === "idle" ? "Starting" : run.phase}
						</Badge>
						{running ? <ActivityIndicator size="small" color={colors.accentText} /> : null}
					</View>
					<Text style={type.muted}>
						{run.phase === "planning"
							? "Asking Agent Memory chat to plan questions from your notes…"
							: run.phase === "researching"
								? "For each question: recall from memory, reason over the evidence, then remember the finding."
								: run.phase === "synthesizing"
									? "Writing the brief from the stored findings…"
									: run.phase === "done"
										? "Done. Findings are saved in Agent Memory and on this device."
										: run.error ?? "Getting ready…"}
					</Text>
					{run.planFallback ? <Text style={type.muted}>The plan could not be parsed, so the agent asks one broad question.</Text> : null}
				</Card>

				{run.steps.map((step, i) => (
					<StepCard key={i} step={step} index={i} />
				))}

				{run.report ? (
					<Card style={{ borderColor: colors.accent }}>
						<Eyebrow>Step 3 · Findings</Eyebrow>
						<Markdown style={markdownStyles}>{run.report}</Markdown>
					</Card>
				) : null}
			</ScrollView>

			<View style={styles.footer}>
				{running ? (
					<Button
						title="Stop"
						style={styles.grow}
						onPress={() => {
							controller.current?.abort();
							phonon.stop();
							dispatch({ type: "error", message: "Stopped." });
						}}
					/>
				) : (
					<Button title="Run again" onPress={start} />
				)}
				{run.phase === "done" ? (
					<Button
						title="Open findings"
						filled
						style={styles.grow}
						onPress={() => router.replace({ pathname: "/project/[id]/report", params: { id: project.id } })}
					/>
				) : null}
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, backgroundColor: colors.page },
	content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
	grow: { flex: 1 },
	narrate: { flexDirection: "row", alignItems: "center", gap: space.md },
	phaseRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
	footer: {
		flexDirection: "row",
		gap: space.sm,
		padding: space.lg,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.line,
		backgroundColor: colors.sunken,
	},
});
