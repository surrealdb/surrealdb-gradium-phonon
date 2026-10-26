import { PhononTTS, type Lang, type ModelSpec } from "phonon-tts";
import { BRIDGE_GLOBAL, type FromBridge, type ToBridge } from "./protocol";

/**
 * Phonon bridge: runs Gradium's on-device TTS (phonon-tts, WebAssembly) and
 * plays the audio itself through WebAudio. Inside the Expo app this page lives
 * in a hidden WebView; opened in a desktop browser it shows a small test panel.
 */

declare global {
	interface Window {
		ReactNativeWebView?: { postMessage(message: string): void };
		[BRIDGE_GLOBAL]: { handle(message: ToBridge | string): void };
	}
}

const params = new URLSearchParams(location.search);
const lang = (params.get("lang") ?? "en") as Lang;
const device = (params.get("device") ?? "cpu") as "cpu" | "webgpu" | "auto";
const embedded = Boolean(window.ReactNativeWebView);

// ---------------------------------------------------------------------------
// Outbound messages

function post(message: FromBridge) {
	if (window.ReactNativeWebView) {
		window.ReactNativeWebView.postMessage(JSON.stringify(message));
	}
	log(message);
}

// ---------------------------------------------------------------------------
// Playback

interface Job {
	id: string;
	text: string;
	voice?: string;
}

let tts: PhononTTS | undefined;
let audio: AudioContext | undefined;
const queue: Job[] = [];
const playing = new Set<AudioBufferSourceNode>();
let current: { job: Job; controller: AbortController } | undefined;
let cursor = 0; // AudioContext time the next chunk starts at
let pumping = false;

function audioContext(): AudioContext {
	audio ??= new AudioContext();
	if (audio.state === "suspended") void audio.resume();
	return audio;
}

/** Schedule one PCM chunk right after the previous one, gapless. */
function schedule(pcm: Float32Array, sampleRate: number): AudioBufferSourceNode {
	const ctx = audioContext();
	const buffer = ctx.createBuffer(1, pcm.length, sampleRate);
	buffer.getChannelData(0).set(pcm);
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	source.connect(ctx.destination);
	cursor = Math.max(cursor, ctx.currentTime + 0.02);
	source.start(cursor);
	cursor += buffer.duration;
	playing.add(source);
	source.onended = () => playing.delete(source);
	return source;
}

/** Resolves when the given source finishes playing (or immediately if none). */
function ended(source: AudioBufferSourceNode | undefined): Promise<void> {
	if (!source || !playing.has(source)) return Promise.resolve();
	return new Promise((resolve) => {
		source.addEventListener("ended", () => resolve(), { once: true });
	});
}

async function pump() {
	if (pumping || !tts) return;
	pumping = true;
	try {
		while (queue.length > 0) {
			const job = queue.shift()!;
			const controller = new AbortController();
			current = { job, controller };
			const started = performance.now();
			let last: AudioBufferSourceNode | undefined;
			try {
				const speech = tts.stream(job.text, { voice: job.voice, signal: controller.signal });
				for await (const pcm of speech) {
					if (!last) post({ type: "speaking", id: job.id, firstAudioMs: Math.round(performance.now() - started) });
					last = schedule(pcm, speech.sampleRate);
				}
				await speech.done.catch(() => undefined);
				await ended(last);
				post({ type: "done", id: job.id, cancelled: controller.signal.aborted });
			} catch (err) {
				if (controller.signal.aborted) {
					post({ type: "done", id: job.id, cancelled: true });
				} else {
					post({ type: "error", id: job.id, message: String((err as Error)?.message ?? err) });
				}
			} finally {
				current = undefined;
			}
		}
		post({ type: "idle" });
	} finally {
		pumping = false;
	}
}

function stop() {
	for (const job of queue.splice(0)) post({ type: "done", id: job.id, cancelled: true });
	current?.controller.abort();
	for (const source of playing) {
		try {
			source.stop();
		} catch {
			// already stopped
		}
	}
	playing.clear();
	cursor = 0;
}

// ---------------------------------------------------------------------------
// Inbound messages

function handle(raw: ToBridge | string) {
	const message: ToBridge = typeof raw === "string" ? JSON.parse(raw) : raw;
	switch (message.type) {
		case "speak":
			audioContext();
			queue.push({ id: message.id, text: message.text, voice: message.voice });
			void pump();
			break;
		case "stop":
			stop();
			break;
		case "ping":
			post({ type: "pong" });
			break;
	}
}

window[BRIDGE_GLOBAL] = { handle };

// ---------------------------------------------------------------------------
// Boot

/**
 * Which checkpoint to load: `?model=hf://owner/name` wins, then a self-hosted
 * copy written by `scripts/fetch-model.mjs`, then phonon-tts's default
 * (Phonon 31M English on Hugging Face).
 */
async function resolveModel(): Promise<ModelSpec | string | undefined> {
	const fromQuery = params.get("model");
	if (fromQuery) return fromQuery;
	const res = await fetch("models/phonon/spec.json").catch(() => undefined);
	if (res?.ok && res.headers.get("content-type")?.includes("json")) {
		const { source: _source, ...spec } = (await res.json()) as ModelSpec & { source?: string };
		return spec;
	}
	return undefined;
}

async function boot() {
	post({ type: "boot", userAgent: navigator.userAgent, crossOriginIsolated: self.crossOriginIsolated });
	const started = performance.now();
	try {
		tts = await PhononTTS.load({
			lang,
			device,
			model: await resolveModel(),
			quant: "q8",
			onProgress: ({ file, loaded, total, cached }) => post({ type: "progress", file, loaded, total, cached }),
		});
		post({
			type: "ready",
			device: tts.device,
			deviceReason: tts.deviceReason,
			threads: tts.threads,
			threadsReason: tts.threadsReason,
			voices: tts.voices,
			sampleRate: tts.sampleRate,
			loadMs: Math.round(performance.now() - started),
		});
		void pump();
	} catch (err) {
		post({ type: "error", message: `Phonon failed to load: ${String((err as Error)?.message ?? err)}` });
	}
}

// ---------------------------------------------------------------------------
// Desktop test panel (hidden when embedded in the app)

const logEl = document.querySelector<HTMLPreElement>("#log");
let lastProgress = 0;

function log(message: FromBridge) {
	if (!logEl || embedded) return;
	// Progress fires per chunk; keep the log readable.
	if (message.type === "progress") {
		const now = performance.now();
		if (now - lastProgress < 250 && message.loaded !== message.total) return;
		lastProgress = now;
	}
	logEl.textContent = `${JSON.stringify(message)}\n${logEl.textContent ?? ""}`.slice(0, 8000);
}

if (embedded) {
	document.body.classList.add("embedded");
} else {
	const text = document.querySelector<HTMLTextAreaElement>("#text")!;
	let n = 0;
	document.querySelector("#speak")!.addEventListener("click", () => {
		handle({ type: "speak", id: `test-${++n}`, text: text.value });
	});
	document.querySelector("#stop")!.addEventListener("click", () => handle({ type: "stop" }));
}

void boot();
