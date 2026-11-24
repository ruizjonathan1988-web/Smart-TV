// La rangée « Replay » de l'accueil (home_view_model.dart, _loadReplayRowOrFail) :
// « Mes émissions » d'abord, puis chaque chaîne qui a du replay, avec son logo.
import {getMaTvClient} from '../../services/maTvSession';
import {fetchReplayHome, replayRowCards, replayRowLogos} from '../../services/maTvReplayHome';

const replayRow = async (ctx) => {
	const maTv = await getMaTvClient({serverUrl: ctx.serverUrl, accessToken: ctx.accessToken, user: ctx.user});
	if (!maTv) return [];
	const home = await fetchReplayHome(maTv);
	if (!home || home.channels.every((c) => c.count === 0)) return [];
	const all = await maTv.allChannels().catch(() => null);
	const cards = replayRowCards(home, replayRowLogos(home, all && all.chans));
	return [{id: 'vjod_replay', title: 'Replay', type: 'landscape', isTileRow: true, items: cards}];
};
// Ne dépend pas de Seerr.
replayRow.library = true;

export default replayRow;
