/**
 * The research agent: plan → (recall → answer → remember) per question → report.
 *
 * Every step runs against SurrealDB Agent Memory: notes come back through
 * `recall`, reasoning happens in memory-grounded `chat`, and each finding is
 * written back with `remember`, so the memory grows while the agent works.
 */
import {
	chatOnce,
	chatStream,
	describeError,
	recallEvidence,
	saveFinding,
	type Citation,
	type ProjectRef,
} from "@/memory/memory";
import type { Finding } from "@/store/projects";
import { parseQuestions, planPrompt, questionPrompt, reportPrompt } from "./prompts";
import type { AgentEvent } from "./types";

export interface ResearchInput {
	project: ProjectRef;
	topic: string;
	noteCount: number;
	signal?: AbortSignal;
}

export async function* runResearch({ project, topic, noteCount, signal }: ResearchInput): AsyncGenerator<AgentEvent> {
	const aborted = () => signal?.aborted === true;

	// 1. Plan
	yield { type: "planning" };
	let questions: string[];
	let fallback = false;
	try {
		const { reply } = await chatOnce(project, planPrompt(topic, noteCount));
		questions = parseQuestions(reply) ?? [];
		if (__DEV__ && questions.length === 0) console.warn("[agent] could not parse plan:", JSON.stringify(reply));
	} catch (err) {
		yield { type: "error", message: `Planning failed: ${describeError(err)}` };
		return;
	}
	if (questions.length === 0) {
		questions = [`What do my notes say about ${topic}?`];
		fallback = true;
	}
	yield { type: "plan", questions, fallback };

	// 2. Research each question
	const findings: Finding[] = [];
	for (const [index, question] of questions.entries()) {
		if (aborted()) return;
		try {
			yield { type: "recalling", index };
			const started = Date.now();
			const hits = await recallEvidence(project, question, 6);
			yield { type: "evidence", index, hits, ms: Date.now() - started };

			let answer = "";
			let citations: Citation[] = [];
			for await (const event of chatStream(project, questionPrompt(topic, question, hits))) {
				if (aborted()) return;
				if (event.type === "delta") {
					yield { type: "answer-delta", index, text: event.text };
				} else {
					answer = event.reply.trim();
					citations = event.citations;
				}
			}
			yield { type: "answer", index, answer, citations };
			findings.push({ question, answer });

			const saved = await saveFinding(project, question, answer);
			yield { type: "saved", index, entities: saved.entities.length, facts: saved.facts };
		} catch (err) {
			yield { type: "error", index, message: describeError(err) };
		}
	}

	if (aborted()) return;
	if (findings.length === 0) {
		yield { type: "error", message: "No question could be answered, so there is nothing to report." };
		return;
	}

	// 3. Synthesize
	yield { type: "synthesizing" };
	try {
		let markdown = "";
		let citations: Citation[] = [];
		for await (const event of chatStream(project, reportPrompt(topic, findings))) {
			if (aborted()) return;
			if (event.type === "delta") {
				yield { type: "report-delta", text: event.text };
			} else {
				markdown = event.reply.trim();
				citations = event.citations;
			}
		}
		yield { type: "report", markdown, citations };
	} catch (err) {
		yield { type: "error", message: `Writing the report failed: ${describeError(err)}` };
	}
}
