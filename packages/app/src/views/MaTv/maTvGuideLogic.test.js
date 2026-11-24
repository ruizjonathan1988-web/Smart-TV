import {halfHour, rowPrograms, programAt, earliestFor, follow, moveTime, guideAction, dayName, cellBox, SPAN} from './maTvGuideLogic';

const at = (h, m = 0) => Math.floor(new Date(2026, 10, 23, h, m).getTime() / 1000);

describe('maTvGuideLogic', () => {
	test('halfHour', () => {
		expect(halfHour(at(20, 47))).toBe(at(20, 30));
		expect(halfHour(at(20, 12))).toBe(at(20, 0));
	});

	test('rowPrograms retombe sur now/next', () => {
		const ch = {now: {t: 'A', s: 1, e: 2}, next: {t: 'B', s: 2, e: 3}};
		expect(rowPrograms(ch, null).map((p) => p.t)).toEqual(['A', 'B']);
		expect(rowPrograms(ch, [{t: 'X', s: 0, e: 9}])[0].t).toBe('X');
	});

	test('moveTime va de programme en programme', () => {
		const progs = [{s: at(20), e: at(21)}, {s: at(21), e: at(22, 30)}, {s: at(22, 30), e: at(23)}];
		const r = moveTime({progs, cursor: at(20, 10), win: at(20), delta: 1, earliest: at(19), nowSec: at(20, 10)});
		expect(r.cursor).toBe(at(21));
		const back = moveTime({progs, cursor: at(21, 5), win: at(20), delta: -1, earliest: at(19), nowSec: at(20, 10)});
		expect(back.cursor).toBe(at(20));
		const far = moveTime({progs, cursor: at(22, 40), win: at(20), delta: 1, earliest: at(19), nowSec: at(20, 10)});
		expect(far.win).toBeGreaterThan(at(20));
	});

	test('follow et earliestFor', () => {
		expect(follow(at(20), at(19, 40), at(18))).toBe(at(19, 30));
		expect(earliestFor({arc: 0}, at(20, 10))).toBe(at(19));
		expect(earliestFor({arc: 2}, at(20, 10))).toBe(at(20) - 2 * 86400);
	});

	test('guideAction', () => {
		const now = at(20, 10);
		expect(guideAction({s: at(20), e: at(21)}, {}, now)).toBe('live');
		expect(guideAction({s: at(18), e: at(19)}, {arc: 7}, now)).toBe('replay');
		expect(guideAction({s: at(18), e: at(19)}, {arc: 0}, now)).toBe('noreplay');
		expect(guideAction({s: at(22), e: at(23)}, {}, now)).toBe('record');
		expect(programAt([{s: 1, e: 5}], 3).s).toBe(1);
	});

	test('dayName et cellBox', () => {
		expect(dayName(at(20), at(21))).toBe('aujourd’hui');
		expect(dayName(at(20) - 86400, at(21))).toBe('hier');
		expect(dayName(at(20) + 86400, at(21))).toBe('demain');
		const box = cellBox({s: at(20) - 600, e: at(20) + SPAN / 2}, at(20));
		expect(box.left).toBe(0);
		expect(box.width).toBe(50);
		expect(cellBox({s: at(10), e: at(11)}, at(20))).toBeNull();
	});
});
