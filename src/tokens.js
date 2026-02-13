import { CalcError } from "./errors.js";

const decorateRoll = (roll, minVal, maxVal) => 
	minVal === maxVal ? String(roll) : 
	roll === minVal ? `<span class="min">${roll}</span>` :
	roll === maxVal ? `<span class="max">${roll}</span>` :
	String(roll);

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
	get display() { return this.num; }
	get value() { return this.num; }
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
	_rollDice() {
		return Array.from({ length: this.n }, () => this.diceRoll(this.faces));
	}
	_ensureRolled() {
		if (this._rolls && this._value) return;
		if (this.mode === "min") {
			this._rolls = Array(this.n).fill(this.min);
			this._value = this.n * this.min;
		} else if (this.mode === "max") {
			this._rolls = Array(this.n).fill(this.max);
			this._value = this.n * this.max;
		} else {
			this._rolls = this._rollDice();
			this._value = this._rolls.reduce((a, b) => a + b, 0);
		}
	}
	get display() {
		this._ensureRolled();
		const decorated = this._rolls.map(r => decorateRoll(r, this.min, this.max));
		return `[ ${decorated.join(", ")} ]`;
	}
	get value() {
		this._ensureRolled();
		return String(this._value);
	}
	get allFumble() { return this._rolls?.every(r => r === this.min) ?? true; }
	get allCrit() { return this._rolls?.every(r => r === this.max) ?? true; }
	get expanded() { return `${this.n}d${this.faces}`; }
}

/** Dés explosifs : NdX! ou NdX!>=N */
export class ExplodeDiceToken extends Token {
	constructor(n, faces, explodeThreshold, start, end, mode = "normal") {
		super(start, end);
		this.n = parseInt(n, 10) || 1;
		this.faces = parseInt(faces, 10);
		this.explodeThreshold = explodeThreshold || this.faces; // Par défaut, explose au max
		this.mode = mode;
		this.min = 1;
		this.max = this.faces;
		this._rolls = null;
		this._value = 0;
	}

	_rollDice() {
		const allRolls = [];
		for (let i = 0; i < this.n; i++) {
			let roll = this.diceRoll(this.faces);
			allRolls.push(roll);
			// Explose si le résultat atteint le threshold
			while (roll >= this.explodeThreshold) {
				roll = this.diceRoll(this.faces);
				allRolls.push(roll);
			}
		}
		return allRolls;
	}

	_ensureRolled() {
		if (this._rolls && this._value) return;
		if (this.mode === "min") {
			this._rolls = Array(this.n).fill(this.min);
			this._value = this.n * this.min;
		} else if (this.mode === "max") {
			// En mode max, on simule l'explosion jusqu'au max possible
			this._rolls = [];
			let totalValue = 0;
			for (let i = 0; i < this.n; i++) {
				this._rolls.push(this.max);
				totalValue += this.max;
				// Continuer à ajouter des max jusqu'à atteindre le seuil
				if (this.max >= this.explodeThreshold) {
					this._rolls.push(this.max);
					totalValue += this.max;
				}
			}
			this._value = totalValue;
		} else {
			this._rolls = this._rollDice();
			this._value = this._rolls.reduce((a, b) => a + b, 0);
		}
	}

	get display() {
		this._ensureRolled();
		const decorated = this._rolls.map(r => decorateRoll(r, this.min, this.max));
		return `[ ${decorated.join(", ")} ]`;
	}

	get value() {
		this._ensureRolled();
		return String(this._value);
	}

	get allFumble() { return this._rolls?.every(r => r === this.min) ?? true; }
	get allCrit() { return this._rolls?.length > this.n; } // Crit si on a des explosions
	get expanded() { 
		const threshold = this.explodeThreshold === this.faces ? "" : `>=${this.explodeThreshold}`;
		return `${this.n}d${this.faces}!${threshold}`; 
	}
}

/** Dés conservés/supprimés : 4d6k3 ou 4d6d1 */
export class KeepDropDiceToken extends Token {
	constructor(n, faces, keepCount, dropCount, start, end, mode = "normal") {
		super(start, end);
		this.n = parseInt(n, 10) || 1;
		this.faces = parseInt(faces, 10);
		this.keepCount = keepCount !== null ? keepCount : this.n;
		this.dropCount = dropCount !== null ? dropCount : 0;
		this.mode = mode;
		this.min = 1;
		this.max = this.faces;
		this._rolls = null;
		this._droppedIndices = null;
		this._value = 0;
	}

	_rollDice() {
		return Array.from({ length: this.n }, () => this.diceRoll(this.faces));
	}

	_computeDroppedIndices(rolls) {
		// Créer un array avec indices: [{value: 3, index: 0}, ...]
		const indexed = rolls.map((value, index) => ({ value, index }));
		
		// Trier par valeur
		const sorted = [...indexed].sort((a, b) => a.value - b.value);
		
		// Déterminer combien à drop/keep
		const dropCount = this.dropCount > 0 ? this.dropCount : Math.max(0, rolls.length - this.keepCount);
		
		// Les indices à drop sont les 'dropCount' premiers du tri
		const droppedIndices = new Set(sorted.slice(0, dropCount).map(item => item.index));
		
		return droppedIndices;
	}

	_ensureRolled() {
		if (this._rolls && this._droppedIndices) return;
		
		if (this.mode === "min") {
			this._rolls = Array(this.n).fill(this.min);
		} else if (this.mode === "max") {
			this._rolls = Array(this.n).fill(this.max);
		} else {
			this._rolls = this._rollDice();
		}
		
		// Calculer les indices supprimés
		this._droppedIndices = this._computeDroppedIndices(this._rolls);
		
		// Calculer la somme des dés non supprimés
		this._value = this._rolls.reduce((sum, val, idx) => {
			return this._droppedIndices.has(idx) ? sum : sum + val;
		}, 0);
	}

	get display() {
		this._ensureRolled();
		const decorated = this._rolls.map((r, idx) => {
			if (this._droppedIndices.has(idx)) {
				return `<span class="dropped">${r}</span>`;
			} else {
				return decorateRoll(r, this.min, this.max);
			}
		});
		return `[ ${decorated.join(", ")} ]`;
	}

	get value() {
		this._ensureRolled();
		return String(this._value);
	}

	get allFumble() { 
		this._ensureRolled();
		return this._rolls.every((r, idx) => this._droppedIndices.has(idx) || r === this.min); 
	}
	
	get allCrit() { 
		this._ensureRolled();
		return this._rolls.every((r, idx) => this._droppedIndices.has(idx) || r === this.max); 
	}
	
	get expanded() { 
		const modifier = this.keepCount < this.n ? `k${this.keepCount}` : this.dropCount > 0 ? `d${this.dropCount}` : "";
		return `${this.n}d${this.faces}${modifier}`; 
	}
}

/** Fudge Dice : NdF */
export class FudgeDiceToken extends DiceToken {
	constructor(n, start, end, mode) { 
		super(n, 3, start, end, mode); 
		this.min = -1; 
		this.max = 1; 
	}
	_ensureRolled() {
		if (this._rolls) return;
		super._ensureRolled();
		if (this.mode === "normal") {
			this._rolls = this._rolls.map(r => r - 2);
			this._value -= this.n * 2;
		}
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
		const multiplyBonus = this.n;
		
		if (this.mode === "min") {
			this._rolls = Array(this.n).fill(Array(this.dbN).fill(1));
			this._value = multiplyBonus * (this.dbN + this.bonus);
		} else if (this.mode === "max") {
			this._rolls = Array(this.n).fill(Array(this.dbN).fill(this.faces));
			this._value = multiplyBonus * (this.dbN * this.faces + this.bonus);
		} else {
			this._rolls = Array.from({ length: this.n }, () => 
				Array.from({ length: this.dbN }, () => this.diceRoll(this.faces))
			);
			this._value = this._rolls.reduce((sum, subRoll) => 
				sum + subRoll.reduce((a, b) => a + b, 0) + this.bonus, 0
			);
		}
	}

	_allRollsEqualTo(number) {
		return this._rolls.every(subRoll => subRoll.every(r => r === number));
	}

	get display() {
		this._ensureRolled();
		const rollsStr = this._rolls
			.map(subRoll => subRoll.map(r => decorateRoll(r, 1, this.faces)).join(", "))
			.join(` ] + [ `);
		return `[ ${rollsStr} ] + ${this.bonus}`.repeat(this.n);
	}

	get value() {
		this._ensureRolled();
		return String(this._value);
	}

	get allFumble() { return this._allRollsEqualTo(1); }
	get allCrit() { return this._allRollsEqualTo(this.faces); }
	get expanded() {
		const inner = `${this.dbN}d${this.faces}+${this.bonus}`;
		return this.n > 1 ? `${this.n}×(${inner})` : inner;
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
