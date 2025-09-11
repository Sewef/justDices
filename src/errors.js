export class CalcError extends Error {
	constructor(message, { index = -1, snippet = "" } = {}) {
		super(message);
		this.name = "CalcError";
		this.index = index;
		this.snippet = snippet;
	}
	withContext(src) {
		if (this.index < 0) return this;
		const caret = " ".repeat(this.index) + "^";
		this.message = `${this.message}\n${src}\n${caret}`;
		return this;
	}
}