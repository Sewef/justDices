import { CalcError } from "./errors.js";

function decorateRoll(roll, minVal, maxVal) {
	if (minVal === maxVal) return String(roll);
	if (roll === minVal) return `<span class="min">${roll}</span>`;
	if (roll === maxVal) return `<span class="max">${roll}</span>`;
	return String(roll);
}

export class Token {
	constructor(start, end) {
		this.start = start; // index début dans la source
		this.end = end;     // index fin exclu
	}
	diceRoll(faces) { return Math.floor(Math.random() * faces) + 1; }
	get display() { throw new Error("abstract: display"); }
	get value() { throw new Error("abstract: value"); }
	get expanded() { 
		try {
			return this.value || "";
		} catch {
			return "";
		}
	}
	get allFumble() { return true; }
	get allCrit() { return true; }
}

/** Nombre littéral */
export class DigitToken extends Token {
	constructor(num, start, end) {
		super(start, end);
		this.num = num.startsWith(".") ? `0.${num}` : num;
	}
	get display() { return String(this.num); }
	get value() { return String(this.num); }
}

/** Texte (affiché seulement) — renvoie 0 pour value */
export class TextToken extends Token {
	constructor(text, start, end) { super(start, end); this.text = text; }
	get display() { return this.text; }
	get value() { return ""; }
}

/** Opérateur binaire */
export class OperatorToken extends Token {
	constructor(op, start, end) { super(start, end); this.op = op; }
	get display() { return this.op; }
	get value() { return this.op }
}

/** Parentheses pour grouping */
export class ParenToken extends Token {
	constructor(kind, start, end) { super(start, end); this.kind = kind; } // '(' ou ')'
	get display() { return this.kind; }
	get value() { return this.kind; }
}

/** Dés : NdX */
export class DiceToken extends Token {
	constructor(n, faces, start, end, mode = "normal") {
		super(start, end);
		this.n = parseInt(n, 10) || 1;
		this.faces = parseInt(faces, 10);
		this.mode = mode;
		this.min = 1;
		this.max = this.faces;
		this._rolls = null;
		this._value = 0;
	}
	_ensureRolled() {
		if (this._rolls && this._value) return;
		if (this.mode === "min") {
			this._rolls = Array(this.n).fill(this.min);
			this._value = this.n * this.min;
			return;
		}
		if (this.mode === "max") {
			this._rolls = Array(this.n).fill(this.max);
			this._value = this.n * this.max;
			return;
		}
		this._rolls = Array.from({ length: this.n }, () => this.diceRoll(this.faces));
		this._value = this._rolls.reduce((acc, current) => acc + current);
		return;
	}
	get display() {
		this._ensureRolled();
		const rolls_decorated = this._rolls.map((roll) => decorateRoll(roll, this.min, this.max));
		const rolls = `[ ${rolls_decorated.join(", ")} ]`;
		return rolls;
	}
	get value() {
		this._ensureRolled();
		return String(this._value);
	}
	get allFumble() { return this._rolls.every(roll => roll === this.min); }
	get allCrit() { return this._rolls.every(roll => roll === this.max); }
	get expanded() { return `${this.n}d${this.faces}`; }
}

/** Fudge Dice : NdF */
export class FudgeDiceToken extends DiceToken {
	constructor(n, start, end, mode) { super(n, 3, start, end, mode); this.min = -1; this.max = 1; }
	_ensureRolled() {
		if (this._rolls) { return true; }
		super._ensureRolled()
		if (this.mode !== "normal") return;
		this._rolls = this._rolls.map((roll) => roll - 2)
		this._value -= this.n * 2
	}
	get expanded() { return `${this.n}dF`; }
}

/** Damage Base (PTU): NDbX */
export class DBToken extends Token {
	static damageBases = [
		null,                // index 0 -> inutilisé
		{ n: 1, faces: 6, bonus: 1 },   // db1
		{ n: 1, faces: 6, bonus: 3 },   // db2
		{ n: 1, faces: 6, bonus: 5 },   // db3
		{ n: 1, faces: 8, bonus: 6 },   // db4
		{ n: 1, faces: 8, bonus: 8 },   // db5
		{ n: 2, faces: 6, bonus: 8 },   // db6
		{ n: 2, faces: 6, bonus: 10 },  // db7
		{ n: 2, faces: 8, bonus: 10 },  // db8
		{ n: 2, faces: 10, bonus: 10 },  // db9
		{ n: 3, faces: 8, bonus: 10 },  // db10
		{ n: 3, faces: 10, bonus: 10 },  // db11
		{ n: 3, faces: 12, bonus: 10 },  // db12
		{ n: 4, faces: 10, bonus: 10 },  // db13
		{ n: 4, faces: 10, bonus: 15 },  // db14
		{ n: 4, faces: 10, bonus: 20 },  // db15
		{ n: 5, faces: 10, bonus: 20 },  // db16
		{ n: 5, faces: 12, bonus: 25 },  // db17
		{ n: 6, faces: 12, bonus: 25 },  // db18
		{ n: 6, faces: 12, bonus: 30 },  // db19
		{ n: 6, faces: 12, bonus: 35 },  // db20
		{ n: 6, faces: 12, bonus: 40 },  // db21
		{ n: 6, faces: 12, bonus: 45 },  // db22
		{ n: 6, faces: 12, bonus: 50 },  // db23
		{ n: 6, faces: 12, bonus: 55 },  // db24
		{ n: 6, faces: 12, bonus: 60 },  // db25
		{ n: 7, faces: 12, bonus: 65 },  // db26
		{ n: 8, faces: 12, bonus: 70 },  // db27
		{ n: 8, faces: 12, bonus: 80 },  // db28
	]

	constructor(number, code, start, end, mode = "normal") {
		super(start, end);
		this.n = number || 1;
		this.code = parseInt(code, 10);
		if (this.code < 1 || this.code > 28) {
			throw CalcError(`DB${this.code} doesn't exist in PTU`, { index: start });
		}
		const { n, faces, bonus } = DBToken.damageBases[this.code];
		this.mode = mode;
		this.dbN = n;
		this.faces = faces;
		this.bonus = bonus;
		this._rolls = Array(this.n);
		this._value = 0;
	}

	_ensureRolled() {
		if (this._rolls && this._value) return;
		if (this.mode === "min") {
			for (let i = 0; i < this.n; i++) {
				this._rolls[i] = Array(this.dbN).fill(1);
				this._value += this.dbN + this.bonus;
			}
			return;
		}
		if (this.mode === "max") {
			for (let i = 0; i < this.n; i++) {
				this._rolls[i] = Array(this.dbN).fill(this.faces);
				this._value += this.dbN * this.faces + this.bonus;
			}
			return;
		}
		for (let i = 0; i < this.n; i++) {
			this._rolls[i] = Array.from({ length: this.dbN }, () => this.diceRoll(this.faces));
			this._value += this._rolls[i].reduce((acc, current) => acc + current);
			this._value += this.bonus;
		}
		return;
	}

	_allRollsEqualTo(number) {
		for (const subRoll of this._rolls) {
			if (subRoll.some(roll => roll !== number)) {
				return false
			}
		}
		return true
	}

	get display() {
		this._ensureRolled();
		const decorateRollCB = (roll) => decorateRoll(roll, 1, this.faces)
		const rolls_decorated = this._rolls.map((subRoll) => subRoll.map(decorateRollCB).join(", "))
		const rolls = `[ ${rolls_decorated.join(" ] + [ ")} ]`;
		const rollsAndBonuses = rolls + ` + ${this.bonus}`.repeat(this.n);
		return rollsAndBonuses;
	}

	get value() {
		this._ensureRolled();
		return String(this._value);
	}

	get allFumble() { return this._allRollsEqualTo(1) }
	get allCrit() { return this._allRollsEqualTo(this.faces) }
	get expanded() {
		const diceNotation = `${this.n > 1 ? this.n + '×(' : ''}${this.dbN}d${this.faces}+${this.bonus}${this.n > 1 ? ')' : ''}`;
		return diceNotation;
	}
}

/** Fonction : Mathjs */
export class FunctionToken extends Token {
	constructor(name, start, end) {
		super(start, end);
		this.name = name;
	}
	get display() { return this.name; }
	get value() { return this.name; }
}
