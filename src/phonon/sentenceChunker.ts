/**
 * Turns streamed text into whole sentences, so Phonon can start speaking a
 * report while the rest of it is still being generated.
 */
export class SentenceChunker {
	private buffer = "";

	/** Adds a delta and returns any sentences it completed. */
	push(delta: string): string[] {
		this.buffer += delta;
		const out: string[] = [];
		// A sentence ends at . ! ? … (plus closing quotes/brackets) followed by
		// whitespace, or at a blank line / list break.
		const boundary = /([.!?…]+["')\]]*)\s+|\n\s*\n|\n(?=\s*(?:[-*•]|\d+\.)\s)/g;
		let start = 0;
		let match: RegExpExecArray | null;
		while ((match = boundary.exec(this.buffer))) {
			const end = match.index + (match[1]?.length ?? 0);
			const sentence = speakable(this.buffer.slice(start, end));
			if (sentence) out.push(sentence);
			start = match.index + match[0].length;
		}
		this.buffer = this.buffer.slice(start);
		return out;
	}

	/** Returns whatever is left once the stream ends. */
	flush(): string[] {
		const rest = speakable(this.buffer);
		this.buffer = "";
		return rest ? [rest] : [];
	}
}

/** Strips Markdown and citation markers that should not be read aloud. */
export function speakable(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/\[(?:S|E)\d+\]/g, "")
		.replace(/^\s{0,3}#{1,6}\s+/gm, "")
		.replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, "")
		.replace(/[*_~>|]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** Splits finished text into sentences, for speaking a stored report. */
export function sentences(text: string): string[] {
	const chunker = new SentenceChunker();
	return [...chunker.push(text), ...chunker.flush()];
}
