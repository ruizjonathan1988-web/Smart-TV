import {readSnapshot, writeSnapshot, resetSnapshotsForTests} from './vjodSnapshots';

jest.mock('./storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));
const storage = jest.requireMock('./storage');

beforeEach(() => {
	resetSnapshotsForTests();
	storage.getFromStorage.mockImplementation(async () => null);
	storage.saveToStorage.mockImplementation(async () => {});
});

describe('listes gardées', () => {
	test('la dernière liste revient tout de suite, puis la fraîche la remplace', async () => {
		expect(await readSnapshot('cats')).toBe(null);
		await writeSnapshot('cats', [1, 2], 1000);
		expect(await readSnapshot('cats', 2000)).toEqual([1, 2]);
		await writeSnapshot('cats', [3], 3000);
		expect(await readSnapshot('cats', 4000)).toEqual([3]);
	});
	test('trop vieille ou vide : rien', async () => {
		await writeSnapshot('x', [1], 0);
		expect(await readSnapshot('x', 15 * 24 * 3600 * 1000)).toBe(null);
		await writeSnapshot('y', [], 0);
		expect(await readSnapshot('y', 0)).toBe(null);
	});
});
