import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ResearchStep } from "@/agent/types";
import { colors, mono, space, type } from "@/theme";
import { Badge, Card } from "./ui";

const statusLabel: Record<ResearchStep["status"], string> = {
	pending: "Queued",
	recalling: "Recalling",
	answering: "Reasoning",
	saving: "Remembering",
	done: "Done",
	failed: "Failed",
};

/** One research question: recalled evidence → streamed answer → finding saved back to memory. */
export function StepCard({ step, index }: { step: ResearchStep; index: number }) {
	const [showEvidence, setShowEvidence] = useState(false);
	const busy = step.status === "recalling" || step.status === "answering" || step.status === "saving";
	const tone = step.status === "done" ? "success" : step.status === "failed" ? "error" : busy ? "accent" : "neutral";

	return (
		<Card style={step.status === "pending" && { opacity: 0.6 }}>
			<View style={styles.head}>
				<Text style={styles.index}>{`Q${index + 1}`}</Text>
				<Text style={[type.body, styles.grow]}>{step.question}</Text>
			</View>

			<View style={styles.meta}>
				<Badge tone={tone}>{statusLabel[step.status]}</Badge>
				{busy ? <ActivityIndicator size="small" color={colors.accentText} /> : null}
				{step.hits ? (
					<Pressable onPress={() => setShowEvidence((v) => !v)} hitSlop={8}>
						<Badge tone="info">{`recall · ${step.hits.length} hits · ${step.recallMs}ms`}</Badge>
					</Pressable>
				) : null}
				{step.saved ? <Badge tone="success">{`remembered · ${step.saved.facts} ${step.saved.facts === 1 ? "fact" : "facts"}`}</Badge> : null}
			</View>

			{showEvidence && step.hits ? (
				<View style={styles.evidence}>
					{step.hits.length === 0 ? <Text style={type.muted}>Nothing relevant recalled.</Text> : null}
					{step.hits.map((hit, i) => (
						<View key={hit.id} style={styles.hit}>
							<Text style={styles.hitMeta}>{`E${i + 1} · ${hit.source} · ${hit.score.toFixed(2)}`}</Text>
							<Text style={type.muted} numberOfLines={4}>
								{hit.text}
							</Text>
						</View>
					))}
				</View>
			) : null}

			{step.answer ? <Text style={type.secondary}>{step.answer}</Text> : null}
			{step.error ? <Text style={[type.muted, { color: colors.error }]}>{step.error}</Text> : null}
		</Card>
	);
}

const styles = StyleSheet.create({
	head: { flexDirection: "row", gap: space.md },
	index: { color: colors.accentText, fontFamily: mono, fontSize: 13, lineHeight: 22 },
	grow: { flex: 1 },
	meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
	evidence: { gap: space.sm, padding: space.md, backgroundColor: colors.sunken },
	hit: { gap: 2 },
	hitMeta: { color: colors.info, fontFamily: mono, fontSize: 10 },
});
