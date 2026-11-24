// Sports (ma_tv_sports_screen.dart de l'APK) : les matchs du jour des sports
// suivis, le score en direct, les cotes, et « Regarder » sur la chaîne qui
// diffuse le match. OK sur un match ouvre ses choix (regarder sur une
// chaîne, être prévenu au coup d'envoi, suivre une équipe). Relu chaque
// minute tant que l'écran est ouvert. Retour est géré par l'hôte (backRef).
import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';

import LoadingSpinner from '../../components/LoadingSpinner';
import {
	parseSports, isLive, isFinished, scoreText, clockText, momentLabel, oddText, followsAny, kickOffs,
	loadSportsChoices, sportsChoices, setSportsOdds, toggleSportKind, setAllSportKinds, toggleSportTeam, toggleSportReminder
} from '../../services/maTvSports';
import {maTvColors as C} from './maTvTheme';
import {Page, FocusRow, SectionHeader, Empty, Toast, ChoiceDialog, SpottableDiv} from './MaTvPageParts';

import css from './MaTvPages.module.less';

const REFRESH_MS = 60000;
const TOAST_MS = 6000;

const SportCard = ({event, showOdds, reminded, followed, onOpen, onPrimary}) => {
	const handleOpen = useCallback(() => onOpen(event), [onOpen, event]);
	const handlePrimary = useCallback(() => onPrimary(event), [onPrimary, event]);
	const live = isLive(event);
	const done = isFinished(event);
	const sets = event.sets && event.sets[0].length ? event.sets : null;
	const recent = event.last && Date.now() / 1000 - event.last.at < 600;
	const label = event.channels.length
		? `▶ ${$L('Regarder')} · ${event.channels[0].name}`
		: (!live && !done)
			? (reminded ? `${$L('Prévenu au coup d’envoi')}` : `${$L('Me prévenir')}`)
			: `⌕ ${$L('Chercher la chaîne')}`;
	return (
		<div className={css.card} style={{borderColor: live ? C.live : 'transparent'}}>
			<SpottableDiv className={css.cardTap} onClick={handleOpen}>
				<div className={css.cardTop}>
					{followed ? <span style={{color: C.accent, marginRight: '0.25rem'}}>★</span> : null}
					<span className={css.cardComp} style={{color: C.mute}}>
						{[event.sportName, event.competition].filter(Boolean).join(' · ')}
					</span>
					{live ? <span style={{color: C.live}}>●</span> : null}
					<span className={css.cardClock} style={{color: live ? C.live : C.mute}}>{clockText(event)}</span>
				</div>
				<div className={css.side}>
					<span className={css.sideName} style={{color: C.ink}}>{event.home}</span>
					<span className={css.sideScore} style={{color: C.ink}}>{sets ? sets[0].join(' ') : (event.score ? event.score[0] : '')}</span>
				</div>
				<div className={css.side}>
					<span className={css.sideName} style={{color: C.ink}}>{event.away}</span>
					<span className={css.sideScore} style={{color: C.ink}}>{sets ? sets[1].join(' ') : (event.score ? event.score[1] : '')}</span>
				</div>
				{showOdds && Object.keys(event.odds).length ? (
					<div className={css.odds}>
						{['1', 'N', '2'].filter((k) => event.odds[k] !== undefined).map((k) => (
							<span key={k} className={css.odd} style={{background: C.row, color: C.ink}}>{`${k} · ${oddText(event.odds[k])}`}</span>
						))}
					</div>
				) : null}
				{recent ? <div className={css.moment} style={{color: C.accent}}>{momentLabel(event.last)}</div> : null}
			</SpottableDiv>
			<SpottableDiv
				className={css.primary}
				style={{background: event.channels.length ? '#E50914' : C.row}}
				onClick={handlePrimary}
			>
				{label}
			</SpottableDiv>
		</div>
	);
};

// Mes sports et réglages (MaTvSportsSettingsScreen) : cotes, sports, équipes.
const Settings = ({kinds, teams, choices, onChange}) => {
	const handleOdds = useCallback(() => onChange(setSportsOdds(!choices.odds)), [choices.odds, onChange]);
	const handleAll = useCallback(() => onChange(setAllSportKinds()), [onChange]);
	const handleKind = useCallback((id) => onChange(toggleSportKind(id)), [onChange]);
	const handleTeam = useCallback((t) => onChange(toggleSportTeam(t)), [onChange]);
	const onTeam = (t) => choices.teams.some((x) => x.toLowerCase() === t.toLowerCase());
	return (
		<Page title={$L('Mes sports et réglages')} hint={$L('Gardés sur cette TV.')} spotlightId="matv-sports-settings">
			<FocusRow onClick={handleOdds} spotlightId="matv-sports-settings-first">
				{$L('Afficher les cotes')}
				<span className={css.toggleValue} style={{color: choices.odds ? C.good : C.mute}}>{choices.odds ? $L('Oui') : $L('Non')}</span>
			</FocusRow>
			<SectionHeader>{$L('Sports')}</SectionHeader>
			<FocusRow onClick={handleAll}>
				{$L('Tous les sports')}
				<span className={css.toggleValue} style={{color: C.good}}>{choices.kinds.length ? '' : '✓'}</span>
			</FocusRow>
			{kinds.map((k) => (
				<FocusRow key={k.id} onClick={handleKind} data={k.id}>
					{k.name}
					<span className={css.toggleValue} style={{color: C.good}}>{choices.kinds.indexOf(k.id) >= 0 ? '✓' : ''}</span>
				</FocusRow>
			))}
			<SectionHeader>{$L('Équipes suivies (en premier, prévenu au coup d’envoi)')}</SectionHeader>
			{teams.length ? teams.map((t) => (
				<FocusRow key={t} onClick={handleTeam} data={t}>
					{t}
					<span className={css.toggleValue} style={{color: C.accent}}>{onTeam(t) ? '★' : '☆'}</span>
				</FocusRow>
			)) : <Empty>{$L('Les équipes des matchs du jour apparaîtront ici.')}</Empty>}
		</Page>
	);
};

const MaTvSports = ({client, onWatch, onSearch, backRef}) => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [tooOld, setTooOld] = useState(false);
	const [choices, setChoices] = useState(sportsChoices());
	const [toast, setToast] = useState(null);
	const [dialog, setDialog] = useState(null); // {event, choices}
	const [settings, setSettings] = useState(false);
	const states = useRef({});
	const toastTimer = useRef(null);

	const say = useCallback((text) => {
		setToast(text);
		clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
	}, []);

	const load = useCallback(async () => {
		await loadSportsChoices();
		const c = sportsChoices();
		const got = parseSports(await client.sports({kinds: c.kinds, teams: c.teams, limit: 120}));
		if (got) {
			const started = kickOffs({...states.current}, got.events, {reminders: c.reminders, teams: c.teams});
			got.events.forEach((e) => {
				states.current[e.id] = e.state;
			});
			if (started.length) say(`${$L('Coup d’envoi')} : ${started[0].home} – ${started[0].away}`);
			setData(got);
		}
		setChoices(c);
		setLoading(false);
		setTooOld(!got);
	}, [client, say]);

	useEffect(() => {
		load();
		const t = setInterval(load, REFRESH_MS);
		return () => {
			clearInterval(t);
			clearTimeout(toastTimer.current);
		};
	}, [load]);

	// Premier focus sur la première carte.
	const hasEvents = !!(data && data.events.length);
	useEffect(() => {
		if (!hasEvents || settings) return undefined;
		const t = setTimeout(() => Spotlight.focus('matv-sports'), 0);
		return () => clearTimeout(t);
	}, [hasEvents, settings]);

	useEffect(() => {
		if (!settings) return undefined;
		const t = setTimeout(() => Spotlight.focus('matv-sports-settings-first'), 0);
		return () => clearTimeout(t);
	}, [settings]);

	const watch = useCallback(async (event, channelId) => {
		const res = await client.channelsByIds(event.channels.map((c) => c.id));
		const chans = res && Array.isArray(res.chans) ? res.chans : [];
		if (!chans.length) {
			say($L('Ma TV ne répond pas pour le moment'));
			return;
		}
		const at = chans.findIndex((c) => c.id === channelId);
		onWatch({channels: chans, index: at < 0 ? 0 : at});
	}, [client, onWatch, say]);

	const open = useCallback((event) => {
		const reminded = choices.reminders.indexOf(event.id) >= 0;
		const list = event.channels.map((ch) => ({id: `watch:${ch.id}`, icon: '▶', label: `${$L('Regarder sur')} ${ch.name}`, strong: true}));
		if (!event.channels.length) list.push({id: 'search', icon: '⌕', label: $L('Chercher la chaîne')});
		if (!isLive(event) && !isFinished(event)) {
			list.push({id: 'remind', label: reminded ? $L('Ne plus me prévenir') : $L('Me prévenir au coup d’envoi')});
		}
		[event.home, event.away].forEach((team) => {
			const on = choices.teams.some((t) => t.toLowerCase() === team.toLowerCase());
			list.push({id: `team:${team}`, icon: on ? '★' : '☆', iconColor: C.accent, label: on ? `${$L('Ne plus suivre')} ${team}` : `${$L('Suivre')} ${team}`});
		});
		list.push({id: 'none', icon: '✕', label: $L('Retour')});
		setDialog({event, choices: list, reminded});
	}, [choices]);

	const pick = useCallback((id) => {
		const d = dialog;
		setDialog(null);
		setTimeout(() => Spotlight.focus('matv-sports'), 0);
		if (!d || id === 'none') return;
		if (id === 'remind') {
			setChoices(toggleSportReminder(d.event.id));
			say(d.reminded ? $L('Rappel retiré') : $L('Tu seras prévenu au coup d’envoi (sur cet écran ou dans le lecteur)'));
		} else if (id.indexOf('team:') === 0) {
			setChoices(toggleSportTeam(id.slice(5)));
			say($L('Équipes suivies mises à jour'));
		} else if (id === 'search') {
			onSearch(d.event.home);
		} else if (id.indexOf('watch:') === 0) {
			watch(d.event, id.slice(6));
		}
	}, [dialog, say, onSearch, watch]);

	const primary = useCallback((event) => {
		if (event.channels.length) {
			watch(event, event.channels[0].id);
			return;
		}
		if (!isLive(event) && !isFinished(event) && choices.reminders.indexOf(event.id) < 0) {
			setChoices(toggleSportReminder(event.id));
			say($L('Tu seras prévenu au coup d’envoi (sur cet écran ou dans le lecteur)'));
			return;
		}
		onSearch(event.home);
	}, [choices, watch, say, onSearch]);

	const openSettings = useCallback(() => setSettings(true), []);
	const handleSettingsChange = useCallback((c) => setChoices(c), []);

	// Retour : ferme le choix ou les réglages (et relit avec les nouveaux choix).
	useEffect(() => {
		if (!backRef) return undefined;
		const handler = () => {
			if (dialog) {
				setDialog(null);
				return true;
			}
			if (settings) {
				setSettings(false);
				load();
				return true;
			}
			return false;
		};
		backRef.current = handler;
		return () => {
			if (backRef.current === handler) backRef.current = null;
		};
	}, [backRef, dialog, settings, load]);

	if (settings) {
		const teams = [];
		(data ? data.events : []).forEach((e) => [e.home, e.away].forEach((t) => {
			if (t && teams.indexOf(t) < 0) teams.push(t);
		}));
		teams.sort();
		choices.teams.forEach((t) => {
			if (teams.indexOf(t) < 0) teams.unshift(t);
		});
		return <Settings kinds={data ? data.kinds : []} teams={teams} choices={choices} onChange={handleSettingsChange} />;
	}

	const events = data ? data.events : [];
	let body;
	if (loading) body = <div className={css.empty}><LoadingSpinner /></div>;
	else if (tooOld) body = <Empty>{$L('Ma TV ne donne pas encore les sports : mets-la à jour (version 3.55 ou plus).')}</Empty>;
	else if (!events.length) {
		body = (
			<Empty>
				{data && data.source === null
					? $L('Les scores ne répondent pas pour le moment. Réessaie dans quelques minutes.')
					: $L('Aucun match aujourd’hui pour tes sports.')}
			</Empty>
		);
	} else {
		body = (
			<div className={css.cards}>
				{events.map((e) => (
					<SportCard
						key={e.id}
						event={e}
						showOdds={choices.odds}
						reminded={choices.reminders.indexOf(e.id) >= 0}
						followed={followsAny(e, choices.teams)}
						onOpen={open}
						onPrimary={primary}
					/>
				))}
			</div>
		);
	}

	return (
		<div>
			<Page
				title={$L('Sports')}
				subtitle={data && data.source ? `${$L('Scores en direct')} · ${data.source}` : ''}
				spotlightId="matv-sports"
				right={(
					<SpottableDiv className={css.settingsButton} style={{color: C.mute}} onClick={openSettings}>
						⚙ {$L('Mes sports et réglages')}
					</SpottableDiv>
				)}
			>
				{body}
			</Page>
			{dialog ? (
				<ChoiceDialog
					title={`${dialog.event.home} – ${dialog.event.away}`}
					subtitle={[dialog.event.competition, clockText(dialog.event), scoreText(dialog.event)].filter(Boolean).join(' · ')}
					choices={dialog.choices}
					onPick={pick}
				/>
			) : null}
			<Toast text={toast} />
		</div>
	);
};

export default MaTvSports;
