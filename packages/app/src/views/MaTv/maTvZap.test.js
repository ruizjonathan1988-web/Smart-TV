import {wrapIndex, appendDigit, indexOfNumber, programsAt, progressOf} from './maTvZap';

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
