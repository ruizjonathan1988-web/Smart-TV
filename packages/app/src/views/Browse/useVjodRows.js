// Les rangées VJOD de l'accueil (home_view_model.dart de l'APK). Chacune ne
// se montre que si elle a de quoi remplir, et seulement si elle est activée
// dans la disposition de l'accueil.
import {useEffect, useState, useCallback} from 'react';
import $L from '@enact/i18n/$L';

import seerrApi from '../../services/seerrApi';
import {normalizeMediaItem} from '../../utils/seerrHomeRows';
import {myRequestEntries, withLibrary, takeReadyNews, STATE} from '../../services/myRequests';
import {loadForYou, loadBecause, loadGems} from '../../services/tonight/forYou';
import {onTasteChange} from '../../services/tonight/tasteProfile';
import {VJOD_ROW_BUILDERS} from './vjodRowBuilders';
import replayRow from './replayRow';
import {CHART_ROW_BUILDERS} from './chartRowBuilders';
import {rememberHomeRows} from '../../services/vjodIdeas';

const row = (id, title, items, extra = {}) => ({id, title, items, type: 'portrait', isSeerrRow: true, ...extra});
const card = (item, mediaType, reason) => ({...normalizeMediaItem({...item, mediaType}), _vjodReason: reason || null});

// Mes demandes : de la demande au moment où c'est prêt (les prêts restent 14
// jours). Ce que la bibliothèque a déjà passe prêt, et ce qui vient de l'être
// est annoncé une fois.
const myRequests = async (ctx) => {
	const me = await seerrApi.getUser();
	const res = await seerrApi.getMyRequests(me.id, 50);
	const entries = await withLibrary(ctx.api, myRequestEntries(res && res.results));
	if (!entries.length) {
		takeReadyNews(entries).catch(() => {});
		return [];
	}
	const items = await Promise.all(entries.map(async (e) => {
		const media = e.request.media;
		const isTv = e.request.type === 'tv';
		try {
			const d = await (isTv ? seerrApi.getTv(media.tmdbId) : seerrApi.getMovie(media.tmdbId));
			return d ? {...card({...d, mediaInfo: d.mediaInfo || media}, isTv ? 'tv' : 'movie'), _vjodRequestState: e.state, _vjodProgress: e.progress} : null;
		} catch (err) {
			return null;
		}
	}));
	const titles = {};
	entries.forEach((e, i) => {
		if (items[i]) titles[e.key] = items[i].Name;
	});
	takeReadyNews(entries, (e) => titles[e.key]).catch(() => {});
	const list = items.filter(Boolean);
	return list.length ? [row('seerr_my_requests', $L('Mes demandes'), list)] : [];
};

const forYou = async (ctx) => {
	const picks = await loadForYou(ctx);
	const items = picks.map((p) => card(p.item, p.mediaType, p.because.title));
	return items.length ? [row('seerr_for_you', $L('Pour vous'), items)] : [];
};

const because = async (ctx) => {
	const rows = await loadBecause(ctx);
	return rows.map((r) => row(
		`seerr_because_${r.seed.mediaType}_${r.seed.tmdbId}`,
		r.seed.source === 'watched' ? `${$L('Parce que vous avez regardé')} ${r.seed.title}` : `${$L('Parce que vous aimez')} ${r.seed.title}`,
		r.items.map((i) => card(i.item, i.mediaType, r.seed.title)),
		{orderKey: 'seerr_because'}
	));
};

const gemsRow = async (ctx) => {
	const picks = await loadGems(ctx);
	// La pastille « Pépite » est celle de cette rangée, comme dans l'APK.
	const items = picks.map((p) => ({...card(p.item, p.mediaType, p.because.title), _vjodPill: 'Pépite'}));
	return items.length >= 5 ? [row('seerr_gems', $L('Pépites pour vous'), items)] : [];
};

const BUILDERS = {
	seerr_my_requests: myRequests,
	seerr_for_you: forYou,
	seerr_because: because,
	seerr_gems: gemsRow,
	...VJOD_ROW_BUILDERS,
	vjod_replay: replayRow,
	...CHART_ROW_BUILDERS
};

export const VJOD_ROW_IDS = Object.keys(BUILDERS);

const useVjodRows = ({api, serverUrl, accessToken, user, seerrReady, homeRows, kidsMode, blockAdult = true}) => {
	const [rows, setRows] = useState([]);
	const [version, setVersion] = useState(0);

	useEffect(() => onTasteChange(() => setVersion((v) => v + 1)), []);

	useEffect(() => {
		const enabled = (homeRows || []).filter((r) => r.enabled && BUILDERS[r.id]).map((r) => r.id);
		if (kidsMode || !api || !enabled.length) {
			setRows([]);
			return undefined;
		}
		let cancelled = false;
		const ctx = {api, serverUrl, accessToken, user, seerr: seerrReady ? seerrApi : null, blockAdult, enabledIds: new Set(enabled)};
		Promise.all(enabled.map((id) => {
			const build = BUILDERS[id];
			if (!build.library && !ctx.seerr) return Promise.resolve([]);
			return build(ctx).catch(() => []);
		})).then((lists) => {
			if (cancelled) return;
			const built = [].concat(...lists);
			rememberHomeRows(built);
			setRows(built);
		});
		return () => {
			cancelled = true;
		};
	}, [api, serverUrl, accessToken, user, seerrReady, homeRows, kidsMode, blockAdult, version]);

	const refresh = useCallback(() => setVersion((v) => v + 1), []);
	return {rows, refresh};
};

export {STATE as REQUEST_STATE};
export default useVjodRows;
