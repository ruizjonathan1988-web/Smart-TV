// « Chercher sur mes trackers » (_TrackerSheet de l'APK, VJOD 4.25) : ce que Prowlarr trouve via
// Ma TV, les plus partagés d'abord ; un appui, puis un oui, envoie la version au téléchargement.
import {useCallback, useEffect, useState} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import {Scroller} from '@enact/sandstone/Scroller';
import SpottableInput from '../../components/SpottableInput/SpottableInput';
import {grabRelease, queryFor, releaseDetail, searchTrackers} from '../../services/replayKeep';
import {R, Button, SheetContainer} from './ReplayParts';

import css from './Replay.module.less';

const SpottableDiv = Spottable('div');

const ReleaseRow = ({release, index, mayGrab, onPick}) => {
	const handleClick = useCallback(() => onPick(release), [onPick, release]);
	return (
		<SpottableDiv className={css.trackerRow} style={{background: R.card}} spotlightId={`replay-tracker-${index}`} onClick={handleClick}>
			<div className={css.trackerTitle} style={{color: R.ink}}>{release.title}</div>
			<div className={css.trackerDetail} style={{color: R.mute}}>{releaseDetail(release)}{mayGrab ? '' : ' · 🔒'}</div>
		</SpottableDiv>
	);
};

const TrackerSheet = ({item, server, onDone, onSay}) => {
	const [query, setQuery] = useState(() => queryFor(item));
	const [found, setFound] = useState(null);
	const [busy, setBusy] = useState(false);
	const [pick, setPick] = useState(null);

	const search = useCallback(async (text) => {
		setBusy(true);
		setPick(null);
		const got = await searchTrackers(server, String(text || '').trim());
		setFound(got);
		setBusy(false);
	}, [server]);

	useEffect(() => {
		search(queryFor(item));
	}, [item, search]);

	useEffect(() => {
		if (busy) return undefined;
		const target = pick ? 'replay-tracker-confirm' : found && found.results.length ? 'replay-tracker-0' : 'replay-tracker-query';
		const t = setTimeout(() => Spotlight.focus(target), 0);
		return () => clearTimeout(t);
	}, [busy, found, pick]);

	const handleChange = useCallback((e) => setQuery(e && e.target ? e.target.value : e), []);
	const handleSearch = useCallback(() => search(query), [search, query]);
	const handleKeyDown = useCallback((e) => {
		if (e && (e.keyCode === 13 || e.key === 'Enter')) search(query);
	}, [search, query]);

	const handlePick = useCallback((release) => {
		if (!found || !found.mayGrab) {
			onSay('Seul un administrateur de Jellyfin peut lancer un téléchargement.');
			return;
		}
		setPick(release);
	}, [found, onSay]);
	const handleCancelPick = useCallback(() => setPick(null), []);
	const handleGrab = useCallback(async () => {
		if (!pick) return;
		setBusy(true);
		const said = await grabRelease(server, pick, item.show);
		onSay(said);
		onDone();
	}, [pick, server, item, onSay, onDone]);

	let body;
	if (pick) {
		body = (
			<>
				<div className={css.sheetShow} style={{color: R.ink}}>Télécharger cette version ?</div>
				<div className={css.sheetDesc} style={{color: R.ink}}>{pick.title}</div>
				<div className={css.trackerDetail} style={{color: R.mute}}>{releaseDetail(pick)}</div>
				<div className={css.sheetButtons}>
					<Button primary onClick={handleGrab} spotlightId="replay-tracker-confirm">Télécharger</Button>
					<Button onClick={handleCancelPick}>Annuler</Button>
				</div>
			</>
		);
	} else {
		let list = null;
		if (busy) list = <div className={css.trackerNote} style={{color: R.mute}}>Recherche sur les trackers…</div>;
		else if (found && found.error) list = <div className={css.trackerNote} style={{color: R.mute}}>{found.error}</div>;
		else if (found && !found.results.length) list = <div className={css.trackerNote} style={{color: R.mute}}>Rien trouvé. Essaie sans le numéro d’épisode, ou avec la date.</div>;
		else if (found) {
			list = (
				<Scroller className={css.trackerList} direction="vertical" verticalScrollbar="hidden">
					{found.results.map((r, i) => <ReleaseRow key={r.id || i} release={r} index={i} mayGrab={found.mayGrab} onPick={handlePick} />)}
				</Scroller>
			);
		}
		body = (
			<>
				<div className={css.sheetShow} style={{color: R.ink}}>Chercher sur mes trackers</div>
				<div className={css.sheetMeta} style={{color: R.mute}}>
					{found && !found.mayGrab && !found.error
						? 'Tu peux regarder ce qui existe ; le téléchargement est réservé aux administrateurs.'
						: 'Rien ne part sans ton appui. Les plus partagés d’abord.'}
				</div>
				<div className={css.trackerSearch}>
					<SpottableInput
						className={css.trackerInput}
						data-spotlight-id="replay-tracker-query"
						value={query}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
					/>
					<Button onClick={handleSearch}>Chercher</Button>
				</div>
				{list}
			</>
		);
	}

	return (
		<div className={css.sheetBackdrop}>
			<SheetContainer className={css.sheet} style={{background: R.sheet}} spotlightId="replay-trackers">
				{body}
			</SheetContainer>
		</div>
	);
};

export default TrackerSheet;
