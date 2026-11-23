import {parseRecordings, recordingOf, isPlayable} from './maTvRecordings';

jest.mock('./secureFetch', () => ({platformFetch: () => Promise.resolve(null)}));

describe('maTvRecordings', () => {
	const recs = parseRecordings({
		items: [
			{id: 'a', chan: 'tf1', title: 'JT', start: 100, end: 200, status: 'scheduled'},
			{id: 'b', chan: 'tf1', start: 300, end: 400, status: 'done', size: 1000},
			{id: 'c', chan: 'm6', start: 100, end: 200, status: 'failed'},
			{chan: 'sans-id'}
		],
		rules: [{id: 'r', chan: 'tf1', title: 'JT'}],
		keep_days: 5
	});

	test('lecture du relevé', () => {
		expect(recs.items.length).toBe(3);
		expect(recs.rules[0].title).toBe('JT');
		expect(recs.keepDays).toBe(5);
		expect(parseRecordings(null)).toBeNull();
	});

	test('recordingOf ne prend que le prévu ou en cours', () => {
		expect(recordingOf(recs, 'tf1', 150).id).toBe('a');
		expect(recordingOf(recs, 'tf1', 350)).toBeNull();
		expect(recordingOf(recs, 'm6', 150)).toBeNull();
	});

	test('isPlayable', () => {
		expect(isPlayable(recs.items[1])).toBe(true);
		expect(isPlayable(recs.items[0])).toBe(false);
	});
});
