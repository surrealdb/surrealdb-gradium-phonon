/**
 * Runtime configuration from `EXPO_PUBLIC_*` variables (see `.env.example`).
 *
 * Expo inlines these at build time, so anything here ships inside the app
 * bundle. That is fine for a demo key; production apps should put Agent
 * Memory behind their own backend or mint narrowly scoped keys.
 */
export const config = {
	memory: {
		endpoint: process.env.EXPO_PUBLIC_MEMORY_ENDPOINT?.replace(/\/+$/, "") ?? "",
		context: process.env.EXPO_PUBLIC_MEMORY_CONTEXT ?? "",
		apiKey: process.env.EXPO_PUBLIC_MEMORY_API_KEY ?? "",
		/** Optional chat model override passed to Agent Memory's `/chat`. */
		chatModel: process.env.EXPO_PUBLIC_MEMORY_CHAT_MODEL || undefined,
	},
	phonon: {
		/** Where the phonon-bridge page is served. Must be a secure context (https or localhost). */
		bridgeUrl: process.env.EXPO_PUBLIC_PHONON_BRIDGE_URL ?? "http://localhost:5180",
	},
};

/** Names of required variables that are missing, for an on-screen setup hint. */
export function missingConfig(): string[] {
	const missing: string[] = [];
	if (!config.memory.endpoint) missing.push("EXPO_PUBLIC_MEMORY_ENDPOINT");
	if (!config.memory.context) missing.push("EXPO_PUBLIC_MEMORY_CONTEXT");
	if (!config.memory.apiKey) missing.push("EXPO_PUBLIC_MEMORY_API_KEY");
	return missing;
}
