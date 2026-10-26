import { defineConfig } from "vite";

// Cross-origin isolation lets phonon-tts use its multi-threaded WebAssembly
// build. Hugging Face serves the model files with CORS, so they still load.
const port = Number(process.env.PORT ?? 5180);

const isolation = {
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
	server: { port, strictPort: true, headers: isolation },
	preview: { port, strictPort: true, headers: isolation },
	// phonon-tts resolves its worker and wasm with `new URL(..., import.meta.url)`;
	// pre-bundling would break those relative URLs.
	optimizeDeps: { exclude: ["phonon-tts"] },
	worker: { format: "es" },
	build: { target: "es2022" },
});
