// Ce que la coquille donne aux pages : l'API, l'utilisateur, la navigation
// dans la console (ouvrir une sous-page, revenir), les messages et le
// brouillon de la page à l'écran (barre « non enregistré »).
import {createContext, useContext, useState, useEffect, useCallback, useRef} from 'react';

import {createDraft} from '../../services/adminDraft';
import {describeAdminError} from '../../services/adminApi';

export const AdminContext = createContext(null);

export const useAdmin = () => useContext(AdminContext);

/**
 * Charge une page de réglages éditée en brouillon (AdminDraft de l'APK).
 * `load()` renvoie {targets: {nom: {value, reload, post}}, extra}.
 */
export const useDraftPage = (load) => {
	const admin = useAdmin();
	const [state, setState] = useState({status: 'loading', error: null, draft: null, extra: null});
	const [, setTick] = useState(0);
	const loadRef = useRef(load);
	loadRef.current = load;
	const draftRef = useRef(null);
	const alive = useRef(true);
	useEffect(() => () => {
		alive.current = false;
	}, []);

	const run = useCallback(async () => {
		setState((s) => ({...s, status: 'loading', error: null}));
		try {
			const {targets, extra} = await loadRef.current();
			if (!alive.current) return;
			const draft = createDraft(targets, () => {
				if (alive.current) setTick((n) => n + 1);
				if (admin) admin.draftChanged();
			});
			draftRef.current = draft;
			setState({status: 'ready', error: null, draft, extra});
			if (admin) admin.setDraft(draft);
		} catch (e) {
			if (alive.current) setState({status: 'error', error: describeAdminError(e), draft: null, extra: null});
		}
	}, [admin]);

	useEffect(() => {
		run();
		return () => {
			if (admin && draftRef.current) admin.releaseDraft(draftRef.current);
		};
	}, [run, admin]);

	return {...state, reload: run};
};

/** Charge des données en lecture seule, avec rechargement. */
export const useAdminLoad = (load, key) => {
	const [state, setState] = useState({status: 'loading', data: null, error: null});
	const loadRef = useRef(load);
	loadRef.current = load;
	const alive = useRef(true);
	useEffect(() => () => {
		alive.current = false;
	}, []);
	const run = useCallback(async (quiet) => {
		if (!quiet) setState((s) => ({...s, status: s.data ? 'ready' : 'loading', error: null}));
		try {
			const data = await loadRef.current();
			if (alive.current) setState({status: 'ready', data, error: null});
		} catch (e) {
			if (alive.current) setState((s) => (quiet && s.data ? s : {status: 'error', data: null, error: describeAdminError(e)}));
		}
	}, []);
	useEffect(() => {
		run();
	}, [run, key]);
	return {...state, reload: run};
};

/** Recharge à intervalle tant que la page est affichée (sessions, tâches en cours). */
export const usePoll = (fn, ms, enabled = true) => {
	const fnRef = useRef(fn);
	fnRef.current = fn;
	useEffect(() => {
		if (!enabled) return undefined;
		const id = setInterval(() => fnRef.current(), ms);
		return () => clearInterval(id);
	}, [ms, enabled]);
};
