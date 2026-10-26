#!/usr/bin/env node
/**
 * Puts a Phonon checkpoint in `public/models/phonon/` and writes `spec.json`, a
 * phonon-tts ModelSpec the bridge loads instead of reading from Hugging Face.
 *
 * Use it when the browser cannot load the model straight from the Hub, for
 * example because the repo is gated or private and the browser has no token.
 *
 *   HF_TOKEN=hf_xxx node scripts/fetch-model.mjs                 # gradium/phonon-31m-en
 *   HF_TOKEN=hf_xxx node scripts/fetch-model.mjs gradium/phonon-40m-en@main
 *   node scripts/fetch-model.mjs --from ~/path/to/checkpoint-folder
 *
 * The file picking follows phonon-tts's own Hub loader (hub.js).
 */
import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../public/models/phonon");
const HUB = "https://huggingface.co";
const WEIGHTS = ["model.q8.gguf", "model.safetensors"];
const VOICE_DIRS = ["voices", "embeddings"];
const DEFAULT_VOICE_FILE = "default-voice.safetensors";

const args = process.argv.slice(2);
const fromIndex = args.indexOf("--from");

async function listLocal(dir, prefix = "") {
	const out = [];
	for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) out.push(...(await listLocal(dir, rel)));
		else out.push(rel);
	}
	return out;
}

/** Picks the files the model needs, as phonon-tts does for a Hub repo. */
function pick(files) {
	const set = new Set(files);
	const weights = WEIGHTS.filter((name) => set.has(name));
	const missing = ["config.json", "tokenizer.json"].filter((name) => !set.has(name));
	if (weights.length === 0) missing.push(`weights (${WEIGHTS.join(" or ")})`);
	if (missing.length > 0) throw new Error(`checkpoint has no ${missing.join(", ")}`);

	const voices = new Map();
	for (const dir of VOICE_DIRS) {
		for (const file of files) {
			if (!file.startsWith(`${dir}/`) || !file.endsWith(".safetensors")) continue;
			const name = file.slice(dir.length + 1, -".safetensors".length);
			if (name && !name.includes("/") && !voices.has(name)) voices.set(name, file);
		}
	}
	if (!voices.has("default") && set.has(DEFAULT_VOICE_FILE)) voices.set("default", DEFAULT_VOICE_FILE);
	return { weights, voices };
}

async function main() {
	await rm(OUT, { recursive: true, force: true });
	await mkdir(OUT, { recursive: true });

	let files;
	let fetchFile;
	let source;

	if (fromIndex >= 0) {
		const dir = resolve(args[fromIndex + 1] ?? "");
		if (!(await stat(dir).catch(() => null))?.isDirectory()) throw new Error(`--from needs a folder, got ${dir}`);
		source = dir;
		files = await listLocal(dir);
		fetchFile = async (file, dest) => copyFile(join(dir, file), dest);
	} else {
		const [repo, revision = "main"] = (args[0] ?? "gradium/phonon-31m-en").split("@");
		const headers = process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {};
		const res = await fetch(`${HUB}/api/models/${repo}/revision/${encodeURIComponent(revision)}`, { headers });
		if (!res.ok) {
			throw new Error(
				`Hugging Face answered ${res.status} for ${repo}. ` +
					(process.env.HF_TOKEN ? "Check the token has access to the repo." : "Set HF_TOKEN to a token with access."),
			);
		}
		const info = await res.json();
		source = `hf://${repo}@${info.sha}`;
		files = (info.siblings ?? []).map((s) => s.rfilename);
		fetchFile = async (file, dest) => {
			const url = `${HUB}/${repo}/resolve/${info.sha}/${file.split("/").map(encodeURIComponent).join("/")}`;
			const r = await fetch(url, { headers });
			if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
			await writeFile(dest, Buffer.from(await r.arrayBuffer()));
		};
	}

	const { weights, voices } = pick(files);
	const wanted = ["config.json", "tokenizer.json", ...weights, ...voices.values()];
	for (const file of wanted) {
		const dest = join(OUT, file);
		await mkdir(join(dest, ".."), { recursive: true });
		process.stdout.write(`  ${file} … `);
		await fetchFile(file, dest);
		console.log(`${((await stat(dest)).size / 1e6).toFixed(1)} MB`);
	}

	const names = [...voices.keys()].sort();
	const spec = {
		source,
		// As hub.js: q8 prefers the GGUF, f32 the safetensors, each falling back to the other.
		weights: {
			q8: `models/phonon/${weights.find((f) => f.endsWith(".gguf")) ?? weights[0]}`,
			f32: `models/phonon/${weights.find((f) => f.endsWith(".safetensors")) ?? weights[0]}`,
		},
		tokenizer: "models/phonon/tokenizer.json",
		config: "models/phonon/config.json",
		voices: Object.fromEntries(names.map((name) => [name, `models/phonon/${voices.get(name)}`])),
		...(names.length ? { defaultVoice: voices.has("default") ? "default" : names[0] } : {}),
	};
	await writeFile(join(OUT, "spec.json"), `${JSON.stringify(spec, null, "\t")}\n`);
	console.log(`\nWrote ${join(OUT, "spec.json")} (${names.length} voices) from ${source}`);
}

main().catch((err) => {
	console.error(`fetch-model: ${err.message}`);
	process.exit(1);
});
