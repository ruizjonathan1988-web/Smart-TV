// Les modifications non enregistrées d'une page d'admin (admin_draft.dart de
// l'APK). Une page édite un ou plusieurs objets de configuration en entier
// (« cibles ») ; à l'enregistrement, chaque cible est relue sur le serveur et
// seules les clés modifiées sur cette page y sont reportées, pour ne pas
// écraser ce qu'un autre écran ou un autre admin a enregistré entre-temps.

// La configuration est du JSON pur : un aller-retour JSON en fait une copie complète.
export const deepCopy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export const deepEqual = (a, b) => {
	if (a === b) return true;
	if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
		// undefined et absent se valent
		return (a === undefined || a === null) && (b === undefined || b === null) ? a === b : false;
	}
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}
	const ka = Object.keys(a).filter((k) => a[k] !== undefined);
	const kb = Object.keys(b).filter((k) => b[k] !== undefined);
	if (ka.length !== kb.length) return false;
	for (const k of ka) {
		if (!deepEqual(a[k], b[k])) return false;
	}
	return true;
};

// Les clés de premier niveau qui diffèrent entre l'original et la copie de travail.
export const changedKeys = (original, working) => {
	const keys = {};
	Object.keys(original || {}).forEach((k) => {
		keys[k] = true;
	});
	Object.keys(working || {}).forEach((k) => {
		keys[k] = true;
	});
	return Object.keys(keys).filter((k) => !deepEqual(working[k], original[k]));
};

// Reporte les clés modifiées sur la version fraîche du serveur.
export const mergeChanges = (fresh, original, working) => {
	const merged = deepCopy(fresh) || {};
	changedKeys(original, working).forEach((key) => {
		if (Object.prototype.hasOwnProperty.call(working, key) && working[key] !== undefined) {
			merged[key] = deepCopy(working[key]);
		} else {
			delete merged[key];
		}
	});
	return merged;
};

// Lit et écrit une valeur par chemin « A.B.C » (les options de trickplay sont imbriquées).
export const getPath = (obj, path) => {
	const parts = String(path).split('.');
	let cur = obj;
	for (const p of parts) {
		if (cur === null || cur === undefined) return undefined;
		cur = cur[p];
	}
	return cur;
};

export const setPath = (obj, path, value) => {
	const parts = String(path).split('.');
	let cur = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
		cur = cur[parts[i]];
	}
	cur[parts[parts.length - 1]] = value;
	return obj;
};

/**
 * Un brouillon de plusieurs cibles {name: {value, reload, post}}.
 * `onChange()` est appelé à chaque changement d'état (modifié, enregistrement, erreur).
 */
export const createDraft = (targets, onChange) => {
	const state = {};
	Object.keys(targets).forEach((name) => {
		state[name] = {
			original: deepCopy(targets[name].value),
			working: deepCopy(targets[name].value),
			reload: targets[name].reload,
			post: targets[name].post
		};
	});
	const draft = {
		saving: false,
		error: null,
		revision: 0,
		working: (name = 'main') => state[name].working,
		isDirty: () => Object.keys(state).some((n) => changedKeys(state[n].original, state[n].working).length > 0),
		// Modifie une valeur et prévient l'écran.
		set: (path, value, name = 'main') => {
			setPath(state[name].working, path, value);
			draft.error = null;
			if (onChange) onChange();
		},
		// Après une modification en place de la copie de travail.
		touch: () => {
			draft.error = null;
			if (onChange) onChange();
		},
		// Chaque cible modifiée est enregistrée à tour de rôle ; une cible en échec reste modifiée.
		save: async () => {
			if (draft.saving) return false;
			draft.saving = true;
			draft.error = null;
			if (onChange) onChange();
			try {
				for (const name of Object.keys(state)) {
					const t = state[name];
					if (changedKeys(t.original, t.working).length === 0) continue;
					const fresh = t.reload ? await t.reload() : t.original;
					const merged = mergeChanges(fresh, t.original, t.working);
					await t.post(merged);
					t.original = deepCopy(merged);
					t.working = deepCopy(merged);
				}
				return true;
			} catch (e) {
				draft.error = e;
				return false;
			} finally {
				draft.saving = false;
				draft.revision++;
				if (onChange) onChange();
			}
		},
		discard: () => {
			Object.keys(state).forEach((n) => {
				state[n].working = deepCopy(state[n].original);
			});
			draft.revision++;
			draft.error = null;
			if (onChange) onChange();
		}
	};
	return draft;
};
