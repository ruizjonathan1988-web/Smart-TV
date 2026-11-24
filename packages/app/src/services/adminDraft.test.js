import {changedKeys, createDraft, deepEqual, getPath, mergeChanges, setPath} from './adminDraft';

describe('comparaison profonde', () => {
	test('objets et listes', () => {
		expect(deepEqual({a: [1, {b: 2}]}, {a: [1, {b: 2}]})).toBe(true);
		expect(deepEqual({a: [1, {b: 2}]}, {a: [1, {b: 3}]})).toBe(false);
		expect(deepEqual({a: 1, b: undefined}, {a: 1})).toBe(true);
		expect(deepEqual([], {})).toBe(false);
	});

	test('clés modifiées de premier niveau', () => {
		expect(changedKeys({A: 1, B: {x: 1}, C: 3}, {A: 1, B: {x: 2}, D: 4})).toEqual(['B', 'C', 'D']);
	});
});

describe('fusion avec la version du serveur', () => {
	test('ne reporte que les clés modifiées sur cette page', () => {
		const original = {ServerName: 'Maison', CachePath: '/a', Other: 1};
		const working = {ServerName: 'Salon', CachePath: '/a', Other: 1};
		const fresh = {ServerName: 'Maison', CachePath: '/b', Other: 2};
		expect(mergeChanges(fresh, original, working)).toEqual({ServerName: 'Salon', CachePath: '/b', Other: 2});
	});

	test('une clé retirée sur la page est retirée', () => {
		expect(mergeChanges({A: 1, B: 2}, {A: 1, B: 2}, {A: 1})).toEqual({A: 1});
	});
});

describe('chemins', () => {
	test('lit et écrit dans un objet imbriqué', () => {
		const o = {};
		setPath(o, 'TrickplayOptions.Interval', 10000);
		expect(o).toEqual({TrickplayOptions: {Interval: 10000}});
		expect(getPath(o, 'TrickplayOptions.Interval')).toBe(10000);
		expect(getPath(o, 'Rien.Ici')).toBeUndefined();
	});
});

describe('brouillon', () => {
	test('modifier, enregistrer en relisant le serveur, annuler', async () => {
		let server = {Name: 'A', Port: 8096};
		const posted = [];
		const changes = jest.fn();
		const draft = createDraft({
			main: {
				value: server,
				reload: async () => ({...server, Port: 9000}),
				post: async (v) => {
					posted.push(v);
					server = v;
				}
			}
		}, changes);
		expect(draft.isDirty()).toBe(false);
		draft.set('Name', 'B');
		expect(draft.isDirty()).toBe(true);
		expect(await draft.save()).toBe(true);
		expect(posted).toEqual([{Name: 'B', Port: 9000}]);
		expect(draft.isDirty()).toBe(false);
		draft.set('Name', 'C');
		draft.discard();
		expect(draft.working().Name).toBe('B');
		expect(changes).toHaveBeenCalled();
	});

	test('une cible en échec reste modifiée et garde l’erreur', async () => {
		const draft = createDraft({
			a: {value: {x: 1}, reload: async () => ({x: 1}), post: async () => {}},
			b: {value: {y: 1}, reload: async () => ({y: 1}), post: async () => {
				throw new Error('non');
			}}
		});
		draft.set('x', 2, 'a');
		draft.set('y', 2, 'b');
		expect(await draft.save()).toBe(false);
		expect(draft.error.message).toBe('non');
		expect(draft.isDirty()).toBe(true);
		draft.set('y', 1, 'b');
		expect(draft.isDirty()).toBe(false);
	});
});
