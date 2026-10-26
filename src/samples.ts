/** Ready-made notes so a demo can go from topic to findings in one tap. */
export const SAMPLE_NOTES: Record<string, string[]> = {
	"On-device speech for mobile apps": [
		"Gradium's Phonon is a small text-to-speech model, about 31M parameters for the English version. It streams 24 kHz audio in 80 ms frames.",
		"Phonon has a browser build (npm package phonon-tts) compiled to WebAssembly. It runs the model in a Web Worker and keeps the downloaded weights in the Cache API, so later loads work offline.",
		"On-device TTS means no audio leaves the phone and there is no per-character API cost. The trade-off is a one-off model download and CPU use on the device.",
		"For React Native, phonon-tts needs WebAssembly workers that Hermes does not have, so we host it in a hidden WebView. Native options are a Swift package on iOS and a Rust FFI library on Android.",
		"Open question from the team: is first-audio latency on a mid-range Android phone good enough to read answers aloud as they stream in?",
	],
	"Agent memory architectures": [
		"Agents need two kinds of memory: short-term conversation context and long-term knowledge that survives across sessions.",
		"SurrealDB Agent Memory stores facts, entities and relations extracted from text, plus the raw passages, and recall mixes vector, keyword and graph retrieval.",
		"Scopes like project/alpha or team/eng partition memory, so one agent can keep separate clients or projects apart while sharing one store.",
		"Writing findings back to memory lets an agent build on its own earlier work instead of starting from zero each run.",
		"Risk to watch: contradictory facts over time. Agent Memory flags uncertainty instead of silently overwriting.",
	],
	"Remote team rituals": [
		"Our weekly demo day works best when each person shows something running, not slides.",
		"Async stand-ups in a shared channel replaced the daily call; people post by 10:00 their local time.",
		"New joiners said the hardest part was knowing who owns what. A simple ownership map in the wiki helped.",
		"Monthly in-person days are popular but travel costs are rising; we may move to quarterly.",
	],
};
