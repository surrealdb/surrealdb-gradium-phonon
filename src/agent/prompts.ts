import type { MemoryHit } from "@/memory/memory";
import type { Finding } from "@/store/projects";

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function planPrompt(topic: string, noteCount: number): string {
	return [
		`I am researching: "${topic}".`,
		`I have stored ${noteCount} notes about it in your memory.`,
		"Based on those notes, list 3 or 4 focused research questions that, once answered, would give me a clear picture of the topic.",
		"Prefer questions my notes can actually answer, plus at most one that exposes a gap.",
		'Reply with only a JSON array of strings, for example ["question one?", "question two?"]. No other text.',
	].join("\n");
}

/** Pulls the question list out of a reply, tolerating prose around the JSON. */
export function parseQuestions(reply: string): string[] | undefined {
	const json = reply.match(/\[[\s\S]*\]/)?.[0];
	if (json) {
		try {
			const parsed = JSON.parse(json);
			if (Array.isArray(parsed)) {
				const questions = parsed.filter((q): q is string => typeof q === "string" && q.trim().length > 0);
				if (questions.length) return questions.slice(0, 5).map((q) => q.trim());
			}
		} catch {
			// Not strict JSON (smart quotes, trailing commas…): take the quoted strings.
			const quoted = [...json.matchAll(/["“]([^"”]{8,})["”]/g)].map((m) => m[1].trim());
			if (quoted.length) return quoted.slice(0, 5);
		}
	}
	const lines = reply
		.split("\n")
		.map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
		.filter((l) => l.endsWith("?"));
	return lines.length ? lines.slice(0, 5) : undefined;
}

export function questionPrompt(topic: string, question: string, hits: MemoryHit[]): string {
	const evidence = hits.length
		? hits.map((h, i) => `[E${i + 1}] ${clip(h.text.replace(/\s+/g, " "), 500)}`).join("\n")
		: "(nothing relevant was recalled)";
	return [
		`Research topic: "${topic}"`,
		`Question: ${question}`,
		"",
		"Evidence recalled from my notes:",
		evidence,
		"",
		"Answer the question in 2 to 4 sentences, grounded in the evidence and in what you remember from my notes on this topic.",
		"If the notes do not answer it, say plainly what is missing. Do not invent facts.",
	].join("\n");
}

export function reportPrompt(topic: string, findings: Finding[]): string {
	return [
		`Write a short research brief on "${topic}" from my notes and these findings:`,
		"",
		...findings.map((f, i) => `${i + 1}. ${f.question}\n${f.answer}`),
		"",
		"Format it as Markdown:",
		"- First, a 2 to 3 sentence summary paragraph, with no heading.",
		"- Then `## Key findings` with 3 to 5 bullets.",
		"- Then `## Open questions` with 1 to 3 bullets.",
		"Keep it under 250 words, in plain spoken English: it will also be read aloud.",
	].join("\n");
}
