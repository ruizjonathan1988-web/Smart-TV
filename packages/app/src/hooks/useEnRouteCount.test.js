import {waitingCount, STATE} from '../services/myRequests';

describe('waitingCount', () => {
	test('compte en téléchargement, acceptées et en attente, pas le reste', () => {
		const entries = [STATE.ready, STATE.downloading, STATE.approved, STATE.pending, STATE.failed, STATE.declined]
			.map((state) => ({state}));
		expect(waitingCount(entries)).toBe(3);
	});
	test('rien sans demandes', () => {
		expect(waitingCount(null)).toBe(0);
	});
});
