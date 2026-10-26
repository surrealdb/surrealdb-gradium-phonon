# Research agent: Gradium Phonon × SurrealDB Agent Memory

An Expo (React Native) demo of a research agent:

1. **Collect.** You type or paste notes about a topic.
2. **Store.** Each note goes into [SurrealDB Agent Memory](https://surrealdb.com/docs/agent-memory) under the project's scope (`project/<id>`). Agent Memory pulls entities and facts out of it.
3. **Research.** The agent plans questions, then for each one it:
   - recalls evidence from memory,
   - reasons over it with Agent Memory chat,
   - writes the finding back into memory.
4. **Output.** The agent writes a brief. [Gradium Phonon](https://github.com/gradium-ai/xn-ptts) reads it aloud **on the device**, sentence by sentence, while the brief is still streaming in.

```
Expo app (expo-router, TypeScript)
 ├─ src/memory/memory.ts ── @surrealdb/memory ──► Agent Memory (HTTPS)
 ├─ src/agent/researchAgent.ts   plan → recall → chat → remember → … → report
 └─ src/phonon/PhononProvider.tsx ── hidden WebView ──► phonon-bridge/ (Vite page)
                                       phonon-tts (WebAssembly) + WebAudio playback
```

Why a WebView: `phonon-tts` is Phonon compiled to WebAssembly. It needs Web Workers and the Cache API, and Hermes has neither. The bridge page generates and plays the audio itself, so no audio passes through the React Native bridge. Everything runs in **Expo Go**, and you need no native build.

## Run it

Requirements: Node 20+, Xcode with an iOS simulator (or Android Studio), and an Agent Memory context with an API key.

```bash
npm install
npm --prefix phonon-bridge install
cp .env.example .env    # fill in the Agent Memory values
```

Check Agent Memory from Node first. This writes test data under a throwaway `project/smoke-…` scope:

```bash
npm run smoke
```

Start the Phonon bridge in one terminal:

```bash
npm run bridge
```

Start the app in another:

```bash
npm run ios
```

You can also open http://localhost:5180 in a desktop browser to test Phonon on its own.

### Phonon model files

You do not need to set anything up. On first start, the bridge downloads Phonon 31M (English, Apache 2.0) from Hugging Face, [`gradium/phonon-31m-en`](https://huggingface.co/gradium/phonon-31m-en), pinned to one commit. The WebView then keeps the files in its cache, so later starts work offline.

To load a different public model, add it to the bridge URL: `?model=hf://owner/name`.

To serve the model files yourself instead (for example, a gated Phonon 40M model, or no Hugging Face requests at run time), copy a checkpoint next to the bridge. The bridge then loads it from there:

```bash
npm run bridge:model                                            # gradium/phonon-31m-en
HF_TOKEN=hf_xxx npm run bridge:model -- gradium/phonon-40m-en   # gated: accept the CC BY-NC terms first
npm run bridge:model -- --from /path/to/checkpoint-folder       # local files
```

The script writes the files to `phonon-bridge/public/models/phonon/`, which git ignores, along with a `spec.json` that the bridge reads at start-up.

### Devices

The bridge must be served from a secure context (https or `localhost`). Otherwise the model cannot be cached and threads are not available.

| Target | `EXPO_PUBLIC_PHONON_BRIDGE_URL` |
| --- | --- |
| iOS simulator | `http://localhost:5180` |
| Android emulator | `http://localhost:5180`, after `adb reverse tcp:5180 tcp:5180` |
| Physical phone | an https deployment of `phonon-bridge/dist` (`npm run bridge:build`) with the COOP/COEP headers from `vite.config.ts`, or an https tunnel |

## How the pieces map to Agent Memory

| App step | SDK call |
| --- | --- |
| New project | `scopes.register({ path: "project" })`, `scopes.register({ path: "project/<id>" })` (writes need a registered scope; registering is idempotent), then `sessions.create({ scopes: "project/<id>" })` |
| Add note | `remember(text, { scopes, sessionId, infer: "full", labels: ["kind=note"] })` |
| Plan | `chat(planPrompt, { scopes, sessionId })` |
| Evidence per question | `recall(question, { k: 6, lens: "project/<id>" })` |
| Answer per question | `chat(prompt, { stream: true, ... })` |
| Save finding | `remember(answer, { role: "assistant", labels: ["kind=finding"] })` |
| Brief | `chat(reportPrompt, { stream: true, ... })` |

All of these live in `src/memory/memory.ts`. If the SDK (still alpha) changes, only that file needs to change.

## Notes and limits

- **API key in the bundle.** `EXPO_PUBLIC_*` values ship inside the app, which is acceptable for a demo only. A real app should put Agent Memory behind its own backend or use narrowly scoped keys.
- **Polyfills.** The SDK hashes each write into an idempotency key with `crypto.subtle.digest`. `src/polyfills.ts` provides it, using `expo-crypto`. Streaming chat works because Expo's runtime installs `expo/fetch`, which has a streaming body.
- **iOS silent switch.** The root layout sets `playsInSilentMode`, so you hear Phonon even when the phone is on silent.
- **First run.** The model download (tens of MB) happens once, then the weights are cached by the WebView. The status pill in the header shows progress.
