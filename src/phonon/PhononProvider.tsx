/**
 * Gradium Phonon, on-device, inside the app.
 *
 * phonon-tts is a WebAssembly build of Phonon that needs workers and the Cache
 * API, which Hermes does not have. So a hidden WebView hosts the phonon-bridge
 * page: it loads the model, generates speech and plays it through WebAudio.
 * React Native only sends `speak`/`stop` and listens for status messages.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { BRIDGE_GLOBAL, type BridgeInfo, type FromBridge, type ToBridge } from "../../phonon-bridge/src/protocol";
import { config } from "@/config";

export type PhononStatus = "connecting" | "loading" | "ready" | "speaking" | "error";

export interface PhononState {
	status: PhononStatus;
	/** Download progress of the model files, 0–1, while loading. */
	progress: number;
	info?: BridgeInfo;
	error?: string;
	/** Milliseconds from the last request to its first audio. */
	firstAudioMs?: number;
}

interface PhononApi extends PhononState {
	/** Stops anything playing and speaks `text`. */
	speak(text: string): string;
	/** Queues `text` after whatever is already playing. */
	enqueue(text: string): string;
	stop(): void;
	reload(): void;
}

/**
 * react-native-webview types its class as `Component<WebViewProps & P>` with
 * `P = undefined`; TypeScript 6 reduces that intersection to `never`. Pinning
 * `P` to `object` restores the real props.
 */
type BridgeWebView = WebView<object>;

const PhononContext = createContext<PhononApi | null>(null);

export function usePhonon(): PhononApi {
	const api = useContext(PhononContext);
	if (!api) throw new Error("usePhonon must be used inside <PhononProvider>");
	return api;
}

let nextId = 0;

export function PhononProvider({ children }: { children: ReactNode }) {
	const webview = useRef<BridgeWebView>(null);
	const [key, setKey] = useState(0);
	const [state, setState] = useState<PhononState>({ status: "connecting", progress: 0 });
	const files = useRef(new Map<string, { loaded: number; total: number }>());
	const pending = useRef(new Set<string>());

	const send = useCallback((message: ToBridge) => {
		const js = `window.${BRIDGE_GLOBAL} && window.${BRIDGE_GLOBAL}.handle(${JSON.stringify(message)}); true;`;
		webview.current?.injectJavaScript(js);
	}, []);

	const onMessage = useCallback((event: WebViewMessageEvent) => {
		let message: FromBridge;
		try {
			message = JSON.parse(event.nativeEvent.data);
		} catch {
			return;
		}
		switch (message.type) {
			case "boot":
				setState((s) => ({ ...s, status: "loading", error: undefined }));
				break;
			case "progress": {
				files.current.set(message.file, { loaded: message.loaded, total: message.total ?? message.loaded });
				let loaded = 0;
				let total = 0;
				for (const f of files.current.values()) {
					loaded += f.loaded;
					total += f.total;
				}
				setState((s) => ({ ...s, status: "loading", progress: total ? loaded / total : 0 }));
				break;
			}
			case "ready": {
				const { type: _type, ...info } = message;
				setState((s) => ({ ...s, status: pending.current.size ? "speaking" : "ready", progress: 1, info }));
				break;
			}
			case "speaking":
				setState((s) => ({ ...s, status: "speaking", firstAudioMs: message.firstAudioMs }));
				break;
			case "done":
				pending.current.delete(message.id);
				break;
			case "idle":
				pending.current.clear();
				setState((s) => (s.status === "speaking" ? { ...s, status: "ready" } : s));
				break;
			case "error":
				if (message.id) pending.current.delete(message.id);
				setState((s) => ({
					...s,
					// A failed request leaves a loaded model usable.
					status: message.id && s.info ? "ready" : "error",
					error: message.message,
				}));
				break;
		}
	}, []);

	const api = useMemo<PhononApi>(() => {
		const enqueue = (text: string) => {
			const id = `s${++nextId}`;
			if (!text.trim()) return id;
			pending.current.add(id);
			send({ type: "speak", id, text });
			return id;
		};
		const stop = () => {
			pending.current.clear();
			send({ type: "stop" });
		};
		return {
			...state,
			enqueue,
			stop,
			speak(text) {
				stop();
				return enqueue(text);
			},
			reload() {
				files.current.clear();
				pending.current.clear();
				setState({ status: "connecting", progress: 0 });
				setKey((k) => k + 1);
			},
		};
	}, [state, send]);

	const uri = `${config.phonon.bridgeUrl}/?lang=en&device=cpu`;

	return (
		<PhononContext.Provider value={api}>
			{children}
			<View pointerEvents="none" style={styles.host}>
				<WebView<object>
					key={key}
					ref={webview}
					source={{ uri }}
					originWhitelist={["*"]}
					javaScriptEnabled
					mediaPlaybackRequiresUserAction={false}
					allowsInlineMediaPlayback
					onMessage={onMessage}
					onError={(e) =>
						setState((s) => ({
							...s,
							status: "error",
							error: `Cannot open the Phonon bridge at ${uri}: ${e.nativeEvent.description}`,
						}))
					}
					onHttpError={(e) =>
						setState((s) => ({
							...s,
							status: "error",
							error: `Phonon bridge answered HTTP ${e.nativeEvent.statusCode} at ${uri}`,
						}))
					}
					onContentProcessDidTerminate={() => api.reload()}
					style={styles.webview}
				/>
			</View>
		</PhononContext.Provider>
	);
}

const styles = StyleSheet.create({
	// Kept on screen (but invisible) so the OS does not suspend the page.
	host: { position: "absolute", left: 0, bottom: 0, width: 2, height: 2, opacity: 0.01 },
	webview: { width: 2, height: 2, backgroundColor: "transparent" },
});
