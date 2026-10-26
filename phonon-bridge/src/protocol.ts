/**
 * Message protocol between the Expo app and the Phonon bridge page.
 *
 * This file is the single source of truth: the bridge imports it directly and
 * the app imports it from `phonon-bridge/src/protocol.ts`. Keep it free of
 * runtime imports so both bundlers can consume it.
 */

/** App → bridge. Delivered by calling `window.phononBridge.handle(msg)`. */
export type ToBridge =
	| { type: "speak"; id: string; text: string; voice?: string }
	| { type: "stop" }
	| { type: "ping" };

export interface BridgeInfo {
	device: "webgpu" | "cpu";
	deviceReason: string;
	threads: number;
	threadsReason: string;
	voices: string[];
	sampleRate: number;
	loadMs: number;
}

/** Bridge → app. Posted through `window.ReactNativeWebView.postMessage`. */
export type FromBridge =
	| { type: "boot"; userAgent: string; crossOriginIsolated: boolean }
	| { type: "progress"; file: string; loaded: number; total: number | null; cached: boolean }
	| ({ type: "ready" } & BridgeInfo)
	| { type: "speaking"; id: string; firstAudioMs: number }
	| { type: "done"; id: string; cancelled: boolean }
	| { type: "idle" }
	| { type: "pong" }
	| { type: "error"; id?: string; message: string };

export const BRIDGE_GLOBAL = "phononBridge";
