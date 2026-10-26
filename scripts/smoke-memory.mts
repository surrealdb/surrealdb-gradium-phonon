/**
 * End-to-end check of the Agent Memory calls the app makes, from Node.
 *
 *   npm run smoke            (reads .env)
 *
 * It writes two notes and one finding under a throwaway `project/smoke-<time>`
 * scope, then recalls and chats against them.
 */
import { AgentMemory } from "@surrealdb/memory";

const endpoint = process.env.EXPO_PUBLIC_MEMORY_ENDPOINT?.replace(/\/+$/, "");
const context = process.env.EXPO_PUBLIC_MEMORY_CONTEXT;
const apiKey = process.env.EXPO_PUBLIC_MEMORY_API_KEY;
const model = process.env.EXPO_PUBLIC_MEMORY_CHAT_MODEL || undefined;

if (!endpoint || !context || !apiKey) {
	throw new Error("Set EXPO_PUBLIC_MEMORY_ENDPOINT, _CONTEXT and _API_KEY in .env first.");
}

const client = new AgentMemory({ endpoint, context, apiKey, timeoutMs: 60_000 });
const scope = `project/smoke-${Date.now().toString(36)}`;

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
	const started = Date.now();
	process.stdout.write(`• ${name} … `);
	try {
		const result = await fn();
		console.log(`ok (${Date.now() - started}ms)`);
		return result;
	} catch (err) {
		console.log("FAILED");
		throw err;
	}
}

await step("health", () => client.health());
const me = await step("whoami", () => client.whoami());
console.log("  ", JSON.stringify(me).slice(0, 300));

await step("scopes.register", async () => {
	await client.scopes.register({ path: "project", displayName: "Research projects" });
	await client.scopes.register({ path: scope, displayName: "Smoke test" });
});

const session = await step("sessions.create", () => client.sessions.create({ scopes: scope, metadata: { smoke: true } }));
console.log(`   session ${session.id} in ${scope}`);

const note = await step("remember (note)", () =>
	client.remember("Phonon is Gradium's on-device text-to-speech model; it streams 24 kHz audio in 80 ms frames.", {
		scopes: scope,
		sessionId: session.id,
		role: "user",
		infer: "full",
		labels: ["kind=note"],
	}),
);
console.log(
	"   entities:",
	note.extraction?.entities.map((e) => `${e.entityType}:${e.name}`).join(", ") || "(none yet)",
);

await step("remember (note 2)", () =>
	client.remember("SurrealDB Agent Memory stores facts and passages and recalls them with hybrid search.", {
		scopes: scope,
		sessionId: session.id,
		role: "user",
		labels: ["kind=note"],
	}),
);

const recall = await step("recall", () => client.recall("What does Phonon do?", { k: 5, lens: scope }));
for (const hit of recall.hits) console.log(`   ${hit.score.toFixed(2)} ${hit.source}: ${hit.text.slice(0, 90)}`);

const chat = await step("chat", () =>
	client.chat("In one sentence, what is Phonon according to my notes?", {
		scopes: scope,
		sessionId: session.id,
		model,
		suppressMarkers: true,
	}),
);
console.log(`   reply: ${chat.reply}`);
console.log(`   citations: ${chat.citations.length}`);

await step("chat (stream)", async () => {
	const stream = await client.chat("List the two technologies in my notes.", {
		stream: true,
		scopes: scope,
		sessionId: session.id,
		model,
	});
	process.stdout.write("\n   ");
	for await (const chunk of stream) process.stdout.write(chunk.delta);
	process.stdout.write("\n   ");
});

await step("remember (finding)", () =>
	client.remember("Research finding — What is Phonon?\nAn on-device TTS model from Gradium.", {
		scopes: scope,
		sessionId: session.id,
		role: "assistant",
		labels: ["kind=finding"],
	}),
);
const findings = await step("recall (findings only)", () =>
	client.recall("Phonon", { k: 5, lens: scope, labels: ["kind=finding"] }),
);
console.log(`   ${findings.hits.length} finding hits`);

console.log(`\nAll Agent Memory calls work. Test data is under scope ${scope}.`);
