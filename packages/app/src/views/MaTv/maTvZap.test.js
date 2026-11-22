import {
	wrapIndex, appendDigit, indexOfNumber, programsAt, progressOf,
	fmtDelay, shiftFrom, clampDelay, guideAt
} from './maTvZap';

describe('maTvZap', () => {
	test('wrapIndex boucle dans les deux sens', () => {
		expect(wrapIndex(0, 1, 3)).toBe(1);
		expect(wrapIndex(2, 1, 3)).toBe(0);
		expect(wrapIndex(0, -1, 3)).toBe(2);
		expect(wrapIndex(5, 0, 0)).toBe(0);
	});

	test('appendDigit repart du dernier chiffre au-delà de 5', () => {
		expect(appendDigit('', '1')).toBe('1');
		expect(appendDigit('12', '3')).toBe('123');
		expect(appendDigit('12345', '6')).toBe('6');
	});

	test('indexOfNumber trouve une chaîne par son numéro', () => {
		const list = [{id: 'a', num: 1}, {id: 'b', num: 12}, {id: 'c'}];
		expect(indexOfNumber(list, '12')).toBe(1);
		expect(indexOfNumber(list, '7')).toBe(-1);
		expect(indexOfNumber(list, '')).toBe(-1);
	});

	test('programsAt décale quand le programme en cours est fini', () => {
		const ch = {now: {t: 'JT', s: 100, e: 200}, next: {t: 'Météo', s: 200, e: 300}};
		expect(programsAt(ch, 150).current.t).toBe('JT');
		expect(programsAt(ch, 150).next.t).toBe('Météo');
		expect(programsAt(ch, 250).current.t).toBe('Météo');
		expect(programsAt(ch, 250).next).toBeNull();
		expect(programsAt({}, 0)).toEqual({current: null, next: null});
	});

	test('progressOf reste entre 0 et 1', () => {
		expect(progressOf({s: 100, e: 200}, 150)).toBe(0.5);
		expect(progressOf({s: 100, e: 200}, 50)).toBe(0);
		expect(progressOf({s: 100, e: 200}, 500)).toBe(1);
		expect(progressOf(null, 1)).toBe(0);
	});
});

describe('maTvZap — différé et guide', () => {
	test('fmtDelay', () => {
		expect(fmtDelay(45)).toBe('−45 s');
		expect(fmtDelay(120)).toBe('−2 min');
		expect(fmtDelay(125)).toBe('−2 min 05');
	});

	test('shiftFrom lit la fenêtre ou renvoie null', () => {
		expect(shiftFrom({from: 1000, max_min: 30})).toBe(1000);
		expect(shiftFrom({off: true})).toBeNull();
		expect(shiftFrom(null)).toBeNull();
	});

	test('clampDelay ne recule pas plus loin que le tampon', () => {
		expect(clampDelay(1000, 60, 2000)).toBe(60);
		expect(clampDelay(1000, 5000, 2000)).toBe(997);
		expect(clampDelay(1999, 60, 2000)).toBe(0);
		expect(clampDelay(null, 60, 2000)).toBe(0);
	});

	test('guideAt trouve le programme en cours et les suivants', () => {
		const progs = [
			{t: 'A', s: 0, e: 100}, {t: 'B', s: 100, e: 200},
			{t: 'C', s: 200, e: 300}, {t: 'D', s: 300, e: 400}, {t: 'E', s: 400, e: 500}
		];
		const g = guideAt(progs, {}, 150);
		expect(g.current.t).toBe('B');
		expect(g.later.map((p) => p.t)).toEqual(['C', 'D', 'E']);
		expect(guideAt([], {now: {t: 'X', s: 0, e: 999}}, 10).current.t).toBe('X');
	});
});
