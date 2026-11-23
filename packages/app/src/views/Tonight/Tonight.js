// « Ce soir » en plein écran (tonight_screen.dart de l'APK) : trois réponses,
// puis une proposition claire avec la raison du choix et cinq autres idées.
// Lancer, demander (et attendre que ce soit prêt), autre idée, détails.
import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import {useSeerr} from '../../context/SeerrContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as seerrApi from '../../services/seerrApi';
import {getImageUrl} from '../../utils/helpers';
import {loadTonight, loadTonightPicks, suggestAnswers, saveAnswers, rejected, launched, requestTonight, findInLibraryTonight} from '../../services/tonight/tonightService';
import {companyLabel, timeLabel, moodLabel} from '../Browse/TonightSheet';

import css from './Tonight.module.less';

const SpottableDiv = Spottable('div');
const Group = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const Page = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-only'}, 'div');

const KIDS = {under7: 'Moins de 7 ans', from7to12: '7 à 12 ans', teen: '13 ans et plus'};
const kidsLabel = (k) => KIDS[k];
const GENRE_LABELS = {
	action: 'action', adventure: 'aventure', animation: 'animation', comedy: 'comédie', crime: 'policier',
	documentary: 'documentaire', drama: 'drame', family: 'famille', fantasy: 'fantastique', history: 'histoire',
	horror: 'horreur', kids: 'jeunesse', music: 'musique', mystery: 'mystère', reality: 'télé-réalité',
	romance: 'romance', scifi: 'science-fiction', talk: 'talk-shows', thriller: 'thriller', war: 'guerre', western: 'western'
};
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const rating = (r) => r.toFixed(1).replace('.', ',');

const runtimeText = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`);

// tonightSlotLabel
const slotLabel = (slot) => {
	if (!slot) return null;
	const day = slot.band === 'daytime';
	switch (slot.day) {
		case 'friday': return day ? 'en journée' : 'le vendredi soir';
		case 'saturday': return day ? 'le week-end en journée' : 'le samedi soir';
		case 'sunday': return day ? 'le week-end en journée' : 'le dimanche soir';
		default: return {daytime: 'en journée', evening: 'en soirée en semaine', late: 'tard en semaine'}[slot.band] || null;
	}
};

// tonightReasonText : la ligne qui dit pourquoi ce choix.
export const reasonText = (pick, answers) => {
	const r = pick.reason || {};
	const mood = 'Pile dans l’envie du soir';
	switch (r.kind) {
		case 'resume': return 'Tu en étais là';
		case 'because': return r.seedTitle ? `Parce que tu as aimé ${r.seedTitle}` : mood;
		case 'habit': return slotLabel(r.slot) ? `Ce que tu aimes regarder ${slotLabel(r.slot)}` : mood;
		case 'company': return {family: 'Parfait en famille', couple: 'Fait pour un soir à deux', friends: 'Parfait entre amis'}[answers.company] || mood;
		case 'quality': return pick.candidate.rating ? `Très bien noté : ${rating(pick.candidate.rating)}/10` : mood;
		case 'fresh': return 'Tout juste arrivé';
		case 'taste': return r.genre ? `Pour les fans de ${GENRE_LABELS[r.genre] || r.genre}` : mood;
		case 'joker': return 'Hors de tes habitudes, mais très bien noté';
		default: return mood;
	}
};

const Choice = ({field, value, label, on, onPick, spotlightId}) => {
	const handleClick = useCallback(() => onPick(field, value), [onPick, field, value]);
	return <SpottableDiv className={`${css.choice} ${on ? css.choiceOn : ''}`} onClick={handleClick} spotlightId={spotlightId}>{label}</SpottableDiv>;
};

const Question = ({title, field, values, labelOf, current, onPick, first}) => (
	<div className={css.question}>
		<div className={css.questionTitle}>{title}</div>
		<Group className={css.choices}>
			{values.map((v, i) => <Choice key={v} field={field} value={v} label={labelOf(v)} on={current === v} onPick={onPick} spotlightId={first && i === 0 ? 'tonight-page-first' : undefined} />)}
		</Group>
	</div>
);

const Button = ({label, primary, busy, onClick, spotlightId}) => (
	<SpottableDiv className={`${css.button} ${primary ? css.buttonPrimary : ''}`} onClick={onClick} spotlightId={spotlightId}>
		{busy ? '… ' : ''}{label}
	</SpottableDiv>
);

const Other = ({pick, onShow}) => {
	const handleClick = useCallback(() => onShow(pick), [onShow, pick]);
	const c = pick.candidate;
	return (
		<SpottableDiv className={css.other} onClick={handleClick}>
			<div className={css.otherPoster}>{c.posterUrl ? <img src={c.posterUrl} alt="" /> : <span>{c.title}</span>}</div>
			<div className={css.otherTitle}>{c.title}</div>
		</SpottableDiv>
	);
};

const Tonight = ({backHandlerRef, onSelectItem, onSelectSeerrItem}) => {
	const {api, serverUrl} = useAuth();
	const {isEnabled, isAuthenticated} = useSeerr();
	const seerr = isEnabled && isAuthenticated ? seerrApi : null;
	const [phase, setPhase] = useState('questions');
	const [answers, setAnswers] = useState(null);
	const [view, setView] = useState(null);
	const [loading, setLoading] = useState(false);
	const [failed, setFailed] = useState(false);
	const [queue, setQueue] = useState([]);
	const [hero, setHero] = useState(0);
	const [requests, setRequests] = useState({});
	const [readyItems, setReadyItems] = useState({});
	const shown = useRef(new Set());
	const passed = useRef([]);
	const poll = useRef(null);

	useEffect(() => {
		let alive = true;
		loadTonight().then(() => {
			if (alive) setAnswers(suggestAnswers());
		});
		return () => {
			alive = false;
			clearInterval(poll.current);
		};
	}, []);

	const focus = useCallback((id) => setTimeout(() => Spotlight.focus(id) || Spotlight.focus('tonight-page'), 40), []);

	useEffect(() => {
		if (answers && phase === 'questions') focus('tonight-page-first');
	}, [phase, answers === null]); // eslint-disable-line react-hooks/exhaustive-deps

	const go = useCallback(async (more) => {
		const a = {...answers, at: Date.now()};
		saveAnswers(a);
		setAnswers(a);
		setPhase('results');
		setLoading(true);
		setFailed(false);
		if (more !== true) {
			shown.current = new Set();
			passed.current = [];
		}
		try {
			const v = await loadTonightPicks(a, {api, serverUrl, seerr, exclude: new Set(shown.current), full: true});
			const picks = v.result.picks.slice();
			picks.forEach((p) => shown.current.add(p.candidate.key));
			setView(v);
			setQueue(picks);
			setHero(0);
			setLoading(false);
			focus('tonight-primary');
		} catch (e) {
			setLoading(false);
			setFailed(true);
			focus('tonight-change');
		}
	}, [answers, api, serverUrl, seerr, focus]);
	const goFresh = useCallback(() => go(false), [go]);

	const pick = queue.length ? queue[Math.min(hero, queue.length - 1)] : null;

	const another = useCallback(() => {
		if (!pick) return;
		rejected(pick);
		passed.current.push(pick);
		const rest = queue.filter((p) => p !== pick);
		setQueue(rest);
		setHero(0);
		if (!rest.length) go(true);
		else focus('tonight-primary');
	}, [pick, queue, go, focus]);

	const show = useCallback((p) => {
		setHero(queue.indexOf(p));
		focus('tonight-primary');
	}, [queue, focus]);

	const passedOver = useCallback((chosen) => passed.current.concat(queue.length && queue[0] !== chosen ? [queue[0]] : []), [queue]);

	const checkReady = useCallback(async () => {
		const waiting = queue.filter((p) => requests[p.candidate.key] === 'requested');
		if (!waiting.length) {
			clearInterval(poll.current);
			poll.current = null;
			return;
		}
		for (const p of waiting) {
			const id = await findInLibraryTonight(seerr, p.candidate);
			if (!id) continue;
			setReadyItems((cur) => ({...cur, [p.candidate.key]: id}));
			setRequests((cur) => ({...cur, [p.candidate.key]: 'ready'}));
		}
	}, [queue, requests, seerr]);
	const checkRef = useRef(checkReady);
	checkRef.current = checkReady;
	const startPolling = useCallback(() => {
		if (!poll.current) poll.current = setInterval(() => checkRef.current(), 15000);
	}, []);

	const primary = useCallback(async () => {
		if (!pick) return;
		const c = pick.candidate;
		const ready = readyItems[c.key];
		if (ready) {
			if (onSelectItem) onSelectItem({Id: ready, Type: c.mediaType === 'tv' ? 'Series' : 'Movie', Name: c.title}, true);
			return;
		}
		const st = requests[c.key];
		if (st === 'requesting' || st === 'requested') return;
		if (c.availability === 'inLibrary' && (c.playItemId || c.libraryItemId)) {
			launched(pick, passedOver(pick));
			if (onSelectItem) onSelectItem({Id: c.playItemId || c.libraryItemId, Type: c.inProgress ? 'Episode' : (c.mediaType === 'tv' ? 'Series' : 'Movie'), Name: c.title}, true);
			return;
		}
		if (c.availability === 'requested') {
			launched(pick, passedOver(pick));
			setRequests((cur) => ({...cur, [c.key]: 'requested'}));
			startPolling();
			return;
		}
		setRequests((cur) => ({...cur, [c.key]: 'requesting'}));
		const outcome = await requestTonight(seerr, c);
		if (outcome === 'failed') {
			setRequests((cur) => ({...cur, [c.key]: 'failed'}));
			return;
		}
		launched(pick, passedOver(pick));
		setRequests((cur) => ({...cur, [c.key]: 'requested'}));
		startPolling();
	}, [pick, readyItems, requests, passedOver, onSelectItem, seerr, startPolling]);

	const details = useCallback(() => {
		if (!pick) return;
		const c = pick.candidate;
		if (c.availability === 'inLibrary' && c.libraryItemId) {
			if (onSelectItem) onSelectItem({Id: c.libraryItemId, Type: c.mediaType === 'tv' ? 'Series' : 'Movie', Name: c.title});
		} else if (c.tmdbId && onSelectSeerrItem) {
			onSelectSeerrItem(c.seerr || {id: c.tmdbId, mediaType: c.mediaType, title: c.title, name: c.title});
		}
	}, [pick, onSelectItem, onSelectSeerrItem]);

	const change = useCallback(() => setPhase('questions'), []);
	const pickAnswer = useCallback((field, value) => setAnswers((a) => ({...a, [field]: value})), []);

	// Retour : des propositions aux questions, puis on quitte.
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (phase === 'results') {
				setPhase('questions');
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, phase]);

	let body;
	if (!answers) {
		body = <div className={css.center}><LoadingSpinner /></div>;
	} else if (phase === 'questions') {
		body = (
			<div className={css.questions}>
				<div className={css.kicker}>☾ {$L('Ce soir')}</div>
				<div className={css.bigTitle}>{$L('Qu’est-ce qu’on regarde ce soir ?')}</div>
				<div className={css.hint}>{$L('Trois réponses, et je m’occupe du reste.')}</div>
				<Question title={$L('Avec qui ?')} field="company" values={['alone', 'couple', 'family', 'friends']} labelOf={companyLabel} current={answers.company} onPick={pickAnswer} first />
				{answers.company === 'family' ? (
					<Question title={$L('Le plus jeune a…')} field="kidsAge" values={['under7', 'from7to12', 'teen']} labelOf={kidsLabel} current={answers.kidsAge} onPick={pickAnswer} />
				) : null}
				<Question title={$L('Combien de temps ?')} field="time" values={['short', 'evening', 'any']} labelOf={timeLabel} current={answers.time} onPick={pickAnswer} />
				<Question title={$L('Quelle envie ?')} field="mood" values={['laugh', 'chills', 'escape', 'think', 'comfort', 'surprise']} labelOf={moodLabel} current={answers.mood} onPick={pickAnswer} />
				<Group className={css.actions}>
					<Button label={$L('C’est parti')} primary onClick={goFresh} />
				</Group>
			</div>
		);
	} else if (loading) {
		body = (
			<div className={css.center}>
				<LoadingSpinner />
				<div className={css.hint}>{$L('Je cherche ce qui te ressemble…')}</div>
			</div>
		);
	} else if (failed || !pick) {
		body = (
			<div className={css.center}>
				<div className={css.nothing}>{$L('Rien ne colle à ces réponses pour l’instant. Essaie une autre envie.')}</div>
				<Group className={css.actions}>
					<Button label={$L('Changer mes réponses')} primary onClick={change} spotlightId="tonight-change" />
					<Button label={$L('Réessayer')} onClick={goFresh} />
				</Group>
			</div>
		);
	} else {
		const c = pick.candidate;
		const image = c.backdropUrl || (c.libraryItemId ? getImageUrl(serverUrl, c.libraryItemId, 'Backdrop', {maxWidth: 1600}) : null) || c.posterUrl;
		const st = requests[c.key];
		const ready = !!readyItems[c.key];
		let primaryLabel;
		if (ready) primaryLabel = $L('C’est prêt !');
		else if (st === 'requesting') primaryLabel = $L('Demande en cours…');
		else if (st === 'requested') primaryLabel = $L('Déjà demandé');
		else if (c.inProgress) primaryLabel = `${$L('Reprendre')} ${c.nextEpisodeLabel || ''}`.trim();
		else primaryLabel = {inLibrary: $L('Lancer'), requested: $L('Déjà demandé'), requestable: $L('Demander')}[c.availability];
		const meta = [
			c.year,
			c.runtimeMinutes > 0 ? (c.mediaType === 'movie' ? runtimeText(c.runtimeMinutes) : `Épisodes de ${c.runtimeMinutes} min`) : null,
			c.rating > 0 ? `★ ${rating(c.rating)}` : null
		].concat(c.genres.slice(0, 2).map((g) => capital(GENRE_LABELS[g] || g))).filter(Boolean).join('  ·  ');
		const others = queue.filter((p) => p !== pick).slice(0, 5);
		body = (
			<div>
				<Group className={css.header}>
					<div className={css.headerText}>
						<div className={css.headerTitle}>☾ {$L('Ce soir')}</div>
						<div className={css.summary}>{[companyLabel(answers.company), timeLabel(answers.time), moodLabel(answers.mood)].join('  ·  ')}</div>
					</div>
					<Button label={$L('Changer mes réponses')} onClick={change} />
				</Group>
				{view && view.stalled ? <div className={css.banner}>{`⏳ ${view.stalled.title} n'est pas encore arrivé. Voici de quoi patienter.`}</div> : null}
				{view && view.result.relaxedMood ? <div className={css.banner}>{$L('ⓘ Peu de titres collaient pile à l’envie, j’ai élargi un peu.')}</div> : null}
				<div className={css.hero}>
					{image ? <img className={css.heroImage} src={image} alt="" /> : null}
					<div className={css.heroShade} />
					<div className={css.heroDetails}>
						<div className={css.pills}>
							<span className={css.pill}>{{inLibrary: '✓ Sur ton serveur', requested: '◷ Déjà demandé', requestable: '⚡ Dispo en quelques minutes'}[c.availability]}</span>
							{pick.isJoker ? <span className={css.pill}>🎲 Joker</span> : null}
						</div>
						<div className={css.heroTitle}>{c.title}</div>
						<div className={css.meta}>{meta}</div>
						<div className={css.reason}>✦ {reasonText(pick, answers)}</div>
						{c.overview ? <div className={css.overview}>{c.overview}</div> : null}
						<Group className={css.actions}>
							<Button label={primaryLabel} primary busy={st === 'requesting' || (st === 'requested' && !ready)} onClick={primary} spotlightId="tonight-primary" />
							<Button label={$L('Autre idée')} onClick={another} />
							<Button label={$L('Détails')} onClick={details} />
						</Group>
						{st === 'requested' && !ready ? <div className={css.note}>{$L('Demandé. Je te préviens dès que c’est prêt.')}</div> : null}
						{st === 'failed' ? <div className={css.error}>{$L('La demande n’est pas passée.')}</div> : null}
					</div>
				</div>
				{others.length ? (
					<div>
						<div className={css.othersTitle}>{$L('Ou bien…')}</div>
						<Group className={css.others}>{others.map((p) => <Other key={p.candidate.key} pick={p} onShow={show} />)}</Group>
					</div>
				) : null}
				{view && typeof view.precision === 'number' ? <div className={css.precision}>{`Précision sur tes dernières soirées : ${Math.round(view.precision * 100)} %`}</div> : null}
			</div>
		);
	}

	return (
		<div className={css.tonight}>
			<Page spotlightId="tonight-page" className={css.page}>
				<Scroller direction="vertical" verticalScrollbar="hidden">
					<div className={css.inner}>{body}</div>
				</Scroller>
			</Page>
		</div>
	);
};

export default Tonight;
