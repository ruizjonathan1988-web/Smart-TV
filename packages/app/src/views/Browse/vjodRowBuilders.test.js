import {arrange, buildSignals, themeOfDay, ambianceOfDay, readMood, writeMood, whyText} from './vjodRowBuilders';
import {withVjodHomeRows, DEFAULT_HOME_ROWS} from '../../utils/homeLayout';
import {EMPTY_PROFILE} from '../../services/tonight/tasteProfile';

jest.mock('../../services/storage', () => ({getFromStorage: () => Promise.resolve(null), saveToStorage: () => Promise.resolve()}));

const NOW = Date.parse('2026-11-23T20:00:00');

describe('rangées VJOD', () => {
	test('accueil de l\'APK', () => {
		const rows = withVjodHomeRows(DEFAULT_HOME_ROWS);
		const order = (id) => rows.find((r) => r.id === id).order;
		expect(order('vjod_mood')).toBe(0);
		expect(order('resume')).toBe(1);
		expect(order('seerr_for_you')).toBe(4);
		expect(rows.find((r) => r.id === 'latest-media').enabled).toBe(true);
		expect(order('genres')).toBeGreaterThan(100);
		expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
	});

	test('envie du jour jusqu\'au lendemain 5 h', () => {
		const stored = writeMood('laugh', NOW);
		expect(readMood(stored, NOW + 3600000)).toBe('laugh');
		expect(readMood(stored, NOW + 12 * 3600000)).toBe(null);
	});

	test('thème et ambiance du jour', () => {
		expect(themeOfDay(NOW).family).toBe('themes');
		const a = ambianceOfDay(NOW);
		expect(a.family).toBe('ambiances');
		expect(ambianceOfDay(NOW, new Set([a.id])).id).not.toBe(a.id);
	});

	test('un tiers de découvertes, l\'envie en premier', () => {
		const signals = buildSignals({journal: [{at: NOW - 86400000, genres: ['drama'], title: 'X', finished: true}], profile: EMPTY_PROFILE, mood: 'laugh', now: NOW});
		const c = (k, genres) => ({item: k, key: k, genres, taste: 1});
		const out = arrange([c('a', ['drama']), c('b', ['comedy']), c('c', ['western']), c('d', ['drama']), c('e', ['horror'])], signals, {seed: 1});
		expect(out[0].item).toBe('a');
		expect(whyText(out[0], 'laugh')).toBe('Parce que vous regardez X');
		expect(out[2].why).toBe('discovery');
		expect(out.map((p) => p.item).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(whyText({why: 'mood'}, 'laugh')).toBe('Pour ce soir : Rire');
	});
});
