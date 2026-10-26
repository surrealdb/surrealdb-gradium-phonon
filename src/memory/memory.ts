/**
 * The app's only door to SurrealDB Agent Memory.
 *
 * Everything the research agent and the screens need goes through these few
 * functions, so a change in the (alpha) SDK or in how the context is set up
 * touches this file only.
 */
import { AgentMemory, AgentMemoryError, type components, type MemoryHitJson } from "@surrealdb/memory";
import { config } from "@/config";

export type { MemoryHitJson as MemoryHit };
export type Citation = components["schemas"]["CitationJson"];
type ExtractionResultJson = components["schemas"]["ExtractionResultJson"];

let client: AgentMemory | undefined;

export function memory(): AgentMemory {
	client ??= new AgentMemory({
		endpoint: config.memory.endpoint,
		context: config.memory.context,
		apiKey: config.memory.apiKey,
		timeoutMs: 60_000,
	});
	return client;
}

/** Where a project lives in the context. Scope paths are `key/value` pairs. */
export interface ProjectRef {
	id: string;
	sessionId?: string;
}

export const scopeOf = (project: ProjectRef) => `project/${project.id}`;
const label = (key: string, value: string) => `${key}=${value}`;

export function describeError(err: unknown): string {
	if (err instanceof AgentMemoryError) return `${err.name}: ${err.message}`;
	if (err instanceof Error) return err.message;
	return String(err);
}

const registered = new Set<string>();

/**
 * Agent Memory only accepts writes to registered scope nodes, parent first.
 * Registering is idempotent, so this is safe to call before every write.
 */
export async function ensureScope(project: ProjectRef, displayName?: string): Promise<void> {
	const path = scopeOf(project);
	if (registered.has(path)) return;
	if (!registered.has("project")) {
		await memory().scopes.register({ path: "project", displayName: "Research projects" });
		registered.add("project");
	}
	await memory().scopes.register({ path, displayName });
	registered.add(path);
}

export async function health(): Promise<void> {
	await memory().health();
}

/** Opens the session a project's notes, findings and chats are attached to. */
export async function openSession(project: ProjectRef, topic: string): Promise<string> {
	await ensureScope(project, topic);
	const session = await memory().sessions.create({
		scopes: scopeOf(project),
		metadata: { app: "research-agent-demo", topic },
	});
	return session.id;
}

/** What Agent Memory pulled out of a stored note, for display. */
export interface Extracted {
	entities: { name: string; type: string; isNew: boolean }[];
	facts: number;
}

function summarise(extraction: ExtractionResultJson | null | undefined): Extracted {
	return {
		entities: (extraction?.entities ?? []).map((e) => ({ name: e.name, type: e.entityType, isNew: e.isNew })),
		facts:
			(extraction?.attributes.length ?? 0) + (extraction?.relations.length ?? 0) + (extraction?.actions.length ?? 0),
	};
}

/** Collect → store: one user note, with full inference (entities, facts). */
export async function addNote(project: ProjectRef, text: string): Promise<Extracted & { turnId?: string }> {
	await ensureScope(project);
	const res = await memory().remember(text, {
		scopes: scopeOf(project),
		sessionId: project.sessionId,
		role: "user",
		infer: "full",
		labels: [label("kind", "note"), label("project", project.id)],
	});
	return { ...summarise(res.extraction), turnId: res.turnId };
}

/** Research: ranked evidence for a question, read only from this project's scope. */
export async function recallEvidence(project: ProjectRef, query: string, k = 8): Promise<MemoryHitJson[]> {
	const res = await memory().recall(query, { k, lens: scopeOf(project) });
	return res.hits;
}

/** Research: the agent writes what it learned back, so later steps can build on it. */
export async function saveFinding(project: ProjectRef, question: string, answer: string): Promise<Extracted> {
	const res = await memory().remember(`Research finding — ${question}\n${answer}`, {
		scopes: scopeOf(project),
		sessionId: project.sessionId,
		role: "assistant",
		infer: "full",
		labels: [label("kind", "finding"), label("project", project.id)],
	});
	return summarise(res.extraction);
}

/** The findings the agent has stored so far for a project. */
export async function recallFindings(project: ProjectRef, query: string, k = 12): Promise<MemoryHitJson[]> {
	const res = await memory().recall(query, {
		k,
		lens: scopeOf(project),
		labels: [label("kind", "finding")],
	});
	return res.hits;
}

/** One non-streaming chat turn against the project's memory. */
export async function chatOnce(project: ProjectRef, message: string): Promise<{ reply: string; citations: Citation[] }> {
	const res = await memory().chat(message, {
		scopes: scopeOf(project),
		sessionId: project.sessionId,
		model: config.memory.chatModel,
		labels: [label("project", project.id)],
		suppressMarkers: true,
	});
	return { reply: tidyReply(res.reply), citations: res.citations };
}

/** Removing citation markers can leave `word,.` or `word ,` behind; tidy that up. */
export function tidyReply(text: string): string {
	return text
		.replace(/[ \t]+([,.;:!?])/g, "$1")
		.replace(/,+([.;:!?])/g, "$1")
		.replace(/([.;:!?]),+/g, "$1")
		.trim();
}

export type ChatEvent = { type: "delta"; text: string } | { type: "done"; reply: string; citations: Citation[] };

/** A streaming chat turn: token deltas, then the final reply with its citations. */
export async function* chatStream(project: ProjectRef, message: string): AsyncGenerator<ChatEvent> {
	const stream = await memory().chat(message, {
		stream: true,
		scopes: scopeOf(project),
		sessionId: project.sessionId,
		model: config.memory.chatModel,
		labels: [label("project", project.id)],
		suppressMarkers: true,
	});
	let text = "";
	for await (const chunk of stream) {
		if (chunk.delta) {
			text += chunk.delta;
			yield { type: "delta", text: chunk.delta };
		}
		if (chunk.done) {
			yield { type: "done", reply: tidyReply(chunk.reply ?? text), citations: chunk.citations ?? [] };
			return;
		}
	}
	yield { type: "done", reply: tidyReply(text), citations: [] };
}
