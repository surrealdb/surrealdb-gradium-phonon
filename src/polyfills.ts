/**
 * Web globals @surrealdb/memory expects that Hermes does not ship.
 *
 * - `crypto.subtle.digest`: the SDK hashes each write into an Idempotency-Key.
 * - `crypto.getRandomValues` / `randomUUID`: used for local ids.
 * - `TextDecoder`: the SDK decodes the streaming chat body with it.
 *
 * `fetch` needs nothing: Expo's runtime already installs `expo/fetch`, whose
 * responses expose a streaming `body`.
 */
import * as ExpoCrypto from "expo-crypto";

type CryptoLike = {
	subtle?: { digest?: (algorithm: AlgorithmIdentifier, data: BufferSource) => Promise<ArrayBuffer> };
	getRandomValues?: typeof ExpoCrypto.getRandomValues;
	randomUUID?: () => string;
};

const g = globalThis as unknown as { crypto?: CryptoLike; TextDecoder?: unknown };
const crypto: CryptoLike = g.crypto ?? (g.crypto = {});

crypto.getRandomValues ??= ExpoCrypto.getRandomValues;
crypto.randomUUID ??= ExpoCrypto.randomUUID;

if (!crypto.subtle?.digest) {
	const algorithms: Record<string, ExpoCrypto.CryptoDigestAlgorithm> = {
		"SHA-1": ExpoCrypto.CryptoDigestAlgorithm.SHA1,
		"SHA-256": ExpoCrypto.CryptoDigestAlgorithm.SHA256,
		"SHA-384": ExpoCrypto.CryptoDigestAlgorithm.SHA384,
		"SHA-512": ExpoCrypto.CryptoDigestAlgorithm.SHA512,
	};
	crypto.subtle = {
		...crypto.subtle,
		digest(algorithm, data) {
			const name = typeof algorithm === "string" ? algorithm : algorithm.name;
			const mapped = algorithms[name.toUpperCase()];
			if (!mapped) return Promise.reject(new Error(`digest: unsupported algorithm ${name}`));
			return ExpoCrypto.digest(mapped, data);
		},
	};
}

if (typeof g.TextDecoder === "undefined") {
	/** Minimal streaming UTF-8 decoder, enough for SSE bodies. */
	class Utf8Decoder {
		private pending: number[] = [];
		readonly encoding = "utf-8";

		decode(input?: ArrayBuffer | ArrayBufferView, options?: { stream?: boolean }): string {
			const bytes = input
				? input instanceof ArrayBuffer
					? new Uint8Array(input)
					: new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
				: new Uint8Array();
			const all = this.pending.length ? Uint8Array.from([...this.pending, ...bytes]) : bytes;
			this.pending = [];

			// Hold back an incomplete trailing sequence when streaming.
			let end = all.length;
			if (options?.stream) {
				let i = all.length - 1;
				let back = 0;
				while (i >= 0 && back < 4 && (all[i] & 0xc0) === 0x80) {
					i--;
					back++;
				}
				if (i >= 0) {
					const lead = all[i];
					const need = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1;
					if (need > all.length - i) {
						end = i;
						this.pending = Array.from(all.subarray(i));
					}
				}
			}

			let out = "";
			for (let i = 0; i < end; ) {
				const b = all[i];
				let cp: number;
				if (b < 0x80) {
					cp = b;
					i += 1;
				} else if (b < 0xe0) {
					cp = ((b & 0x1f) << 6) | (all[i + 1] & 0x3f);
					i += 2;
				} else if (b < 0xf0) {
					cp = ((b & 0x0f) << 12) | ((all[i + 1] & 0x3f) << 6) | (all[i + 2] & 0x3f);
					i += 3;
				} else {
					cp =
						((b & 0x07) << 18) | ((all[i + 1] & 0x3f) << 12) | ((all[i + 2] & 0x3f) << 6) | (all[i + 3] & 0x3f);
					i += 4;
				}
				out += String.fromCodePoint(cp);
			}
			return out;
		}
	}
	g.TextDecoder = Utf8Decoder;
}
