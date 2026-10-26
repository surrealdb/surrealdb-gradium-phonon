import type { Citation, MemoryHit } from "@/memory/memory";

/** Everything the research agent does, as it happens. The UI renders these as a timeline. */
export type AgentEvent =
	| { type: "planning" }
	| { type: "plan"; questions: string[]; fallback: boolean }
	| { type: "recalling"; index: number }
	| { type: "evidence"; index: number; hits: MemoryHit[]; ms: number }
	| { type: "answer-delta"; index: number; text: string }
	| { type: "answer"; index: number; answer: string; citations: Citation[] }
	| { type: "saved"; index: number; entities: number; facts: number }
	| { type: "synthesizing" }
	| { type: "report-delta"; text: string }
	| { type: "report"; markdown: string; citations: Citation[] }
	| { type: "error"; message: string; index?: number };

export type StepStatus = "pending" | "recalling" | "answering" | "saving" | "done" | "failed";

/** One research question as the timeline shows it. */
export interface ResearchStep {
	question: string;
	status: StepStatus;
	hits?: MemoryHit[];
	recallMs?: number;
	answer: string;
	citations?: Citation[];
	saved?: { entities: number; facts: number };
	error?: string;
}

export interface ResearchRun {
	phase: "idle" | "planning" | "researching" | "synthesizing" | "done" | "failed";
	questions: string[];
	planFallback: boolean;
	steps: ResearchStep[];
	report: string;
	reportCitations: Citation[];
	error?: string;
}

export const emptyRun: ResearchRun = {
	phase: "idle",
	questions: [],
	planFallback: false,
	steps: [],
	report: "",
	reportCitations: [],
};

/** Folds agent events into the timeline state. */
export function reduceRun(run: ResearchRun, event: AgentEvent): ResearchRun {
	const step = (index: number, patch: Partial<ResearchStep> | ((s: ResearchStep) => Partial<ResearchStep>)) => ({
		...run,
		steps: run.steps.map((s, i) => (i === index ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s)),
	});

	switch (event.type) {
		case "planning":
			return { ...emptyRun, phase: "planning" };
		case "plan":
			return {
				...run,
				phase: "researching",
				questions: event.questions,
				planFallback: event.fallback,
				steps: event.questions.map((question) => ({ question, status: "pending", answer: "" })),
			};
		case "recalling":
			return step(event.index, { status: "recalling" });
		case "evidence":
			return step(event.index, { status: "answering", hits: event.hits, recallMs: event.ms });
		case "answer-delta":
			return step(event.index, (s) => ({ answer: s.answer + event.text }));
		case "answer":
			return step(event.index, { status: "saving", answer: event.answer, citations: event.citations });
		case "saved":
			return step(event.index, { status: "done", saved: { entities: event.entities, facts: event.facts } });
		case "synthesizing":
			return { ...run, phase: "synthesizing", report: "" };
		case "report-delta":
			return { ...run, report: run.report + event.text };
		case "report":
			return { ...run, phase: "done", report: event.markdown, reportCitations: event.citations };
		case "error":
			if (event.index !== undefined) return step(event.index, { status: "failed", error: event.message });
			return { ...run, phase: "failed", error: event.message };
	}
}
