// Le point du mois (taste_check_in_screen.dart) : quelques cartes tirées de
// ce qui a vraiment été regardé, une réponse chacune, puis on revient.
import {useState, useEffect, useCallback} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

import LoadingSpinner from '../../components/LoadingSpinner';
import * as seerrApi from '../../services/seerrApi';
import {getFromStorage, saveToStorage} from '../../services/storage';
import {getJournal} from '../../services/tonight/tonightService';
import {loadTaste, saveTasteProfile, pickKey, AXES} from '../../services/tonight/tasteProfile';
import {loadQuizPool, buildDuel} from '../../services/tonight/tasteQuiz';
import {checkInSittings, checkInKey, stillTrueQuestion, applyVerdict, applyDropReason, releaseChoice} from '../../services/tonight/tasteCheckIn';

import css from './TasteQuiz.module.less';

const SpottableDiv = Spottable('div');
const Page = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-only'}, 'div');
const Row = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const ASKED_KEY = 'vjodTasteCheckInAsked';

const GENRE_LABELS = {
	action: 'action', adventure: 'aventure', animation: 'animation', comedy: 'comédie', crime: 'policier',
	documentary: 'documentaire', drama: 'drame', family: 'famille', fantasy: 'fantastique', history: 'histoire',
	horror: 'horreur', kids: 'jeunesse', music: 'musique', mystery: 'mystère', reality: 'télé-réalité',
	romance: 'romance', scifi: 'science-fiction', talk: 'talk-shows', thriller: 'thriller', war: 'guerre', western: 'western'
};
const VERDICTS = [['loved', 'Adoré'], ['good', 'Bien'], ['meh', 'Bof'], ['disliked', 'Pas aimé']];
const REASONS = [['notNow', 'Pas le moment'], ['tooSlow', 'Trop lent'], ['tooDark', 'Trop violent ou glauque'], ['notMyGenre', 'Pas mon genre'], ['later', 'Je reprendrai']];

const Answer = ({id, label, onPick, first}) => {
	const handleClick = useCallback(() => onPick(id), [onPick, id]);
	return <SpottableDiv className={css.chip} onClick={handleClick} spotlightId={first ? 'checkin-first' : undefined}>{label}</SpottableDiv>;
};

const DuelSide = ({title, value, onPick, first}) => {
	const handleClick = useCallback(() => onPick(value), [onPick, value]);
	return (
		<SpottableDiv className={`${css.poster} ${css.posterWide}`} onClick={handleClick} spotlightId={first ? 'checkin-first' : undefined}>
			<div className={css.posterImg}>{title.poster ? <img src={seerrApi.getImageUrl(title.poster, 'w342')} alt="" /> : null}</div>
			<div className={css.posterTitle}>{title.title}</div>
		</SpottableDiv>
	);
};

const TasteCheckIn = ({onDone, onOpenFull, backHandlerRef}) => {
	const [profile, setProfile] = useState(null);
	const [cards, setCards] = useState(null);
	const [index, setIndex] = useState(0);
	const [asked, setAsked] = useState([]);
	const [changed, setChanged] = useState(false);

	useEffect(() => {
		let alive = true;
		(async () => {
			const [{profile: p}, journal, before] = await Promise.all([loadTaste(), getJournal(), getFromStorage(ASKED_KEY).catch(() => null)]);
			const s = checkInSittings({journal, profile: p, asked: new Set(Array.isArray(before) ? before : [])});
			const list = [];
			if (s.finished) list.push({kind: 'finished', entry: s.finished});
			if (s.dropped) list.push({kind: 'dropped', entry: s.dropped});
			const axis = AXES.find((a) => !(a in p.axes));
			if (axis) {
				const pool = await loadQuizPool();
				const seen = new Set([].concat(p.favorites, p.pivots, p.meh, p.disliked).map(pickKey));
				const duel = buildDuel(axis, {pool, used: seen, avoided: p.avoided});
				if (duel) list.push({kind: 'duel', duel});
			}
			const q = stillTrueQuestion(p);
			if (q) list.push({kind: 'still', question: q});
			if (!alive) return;
			setProfile(p);
			setCards(list);
		})();
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		const t = setTimeout(() => Spotlight.focus('checkin-first') || Spotlight.focus('taste-checkin'), 30);
		return () => clearTimeout(t);
	}, [cards, index]);

	const save = useCallback(async (p, askedNow, didChange) => {
		const before = await getFromStorage(ASKED_KEY).catch(() => null);
		const all = (Array.isArray(before) ? before : []).concat(askedNow).slice(-200);
		await saveToStorage(ASKED_KEY, all).catch(() => {});
		await saveToStorage('vjodTastePrompted', Date.now()).catch(() => {});
		if (didChange) await saveTasteProfile(p);
		if (onDone) onDone(didChange);
	}, [onDone]);

	const answer = useCallback((next, entry) => {
		const askedNow = entry ? asked.concat([checkInKey(entry)]) : asked;
		const didChange = changed || next !== profile;
		setAsked(askedNow);
		setChanged(didChange);
		setProfile(next);
		if (index + 1 >= cards.length) save(next, askedNow, didChange);
		else setIndex(index + 1);
	}, [asked, changed, profile, index, cards, save]);

	const card = cards && cards[index];
	const onVerdict = useCallback((v) => answer(applyVerdict(profile, card.entry, v), card.entry), [answer, profile, card]);
	const onReason = useCallback((r) => answer(applyDropReason(profile, card.entry, r), card.entry), [answer, profile, card]);
	const onDuel = useCallback((v) => answer(v === 0 ? profile : {...profile, axes: {...profile.axes, [card.duel.axis]: v}}), [answer, profile, card]);
	const onStill = useCallback((id) => answer(id === 'no' ? releaseChoice(profile, card.question) : profile), [answer, profile, card]);
	const skip = useCallback(() => answer(profile, card && card.entry), [answer, profile, card]);
	const close = useCallback(() => save(profile, asked, changed), [save, profile, asked, changed]);

	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			close();
			return true;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, close]);

	let body;
	if (!cards) body = <div className={css.center}><LoadingSpinner /></div>;
	else if (!card) body = <div className={css.note}>Rien de nouveau à te demander ce mois-ci.</div>;
	else if (card.kind === 'finished') {
		body = (
			<div>
				<div className={css.sectionTitle}>{`Tu as regardé ${card.entry.title} jusqu'au bout. Verdict ?`}</div>
				<Row className={css.chips}>{VERDICTS.map(([id, label], i) => <Answer key={id} id={id} label={label} onPick={onVerdict} first={i === 0} />)}</Row>
			</div>
		);
	} else if (card.kind === 'dropped') {
		body = (
			<div>
				<div className={css.sectionTitle}>{`Tu as arrêté ${card.entry.title} au bout de ${Math.round(card.entry.watchedMinutes || 0)} min. Pourquoi ?`}</div>
				<Row className={css.chips}>{REASONS.map(([id, label], i) => <Answer key={id} id={id} label={label} onPick={onReason} first={i === 0} />)}</Row>
			</div>
		);
	} else if (card.kind === 'duel') {
		body = (
			<div>
				<div className={css.sectionTitle}>Ce soir, plutôt celui-ci ou celui-là ?</div>
				<Row className={css.duel}>
					<DuelSide title={card.duel.left} value={-1} onPick={onDuel} first />
					<span className={css.or}>ou</span>
					<DuelSide title={card.duel.right} value={1} onPick={onDuel} />
				</Row>
				<Row className={css.chips}><Answer id={0} label="Aucun des deux" onPick={onDuel} /></Row>
			</div>
		);
	} else {
		const q = card.question;
		const text = q.kind === 'avoided' ? `Toujours pas de ${GENRE_LABELS[q.genre] || q.genre} pour toi ?` : q.kind === 'subtitles' ? 'Toujours pas de sous-titres ?' : 'Toujours pas de violence ?';
		body = (
			<div>
				<div className={css.sectionTitle}>{text}</div>
				<Row className={css.chips}>
					<Answer id="yes" label="Oui, toujours" onPick={onStill} first />
					<Answer id="no" label="Plus vraiment" onPick={onStill} />
				</Row>
			</div>
		);
	}

	return (
		<div className={css.quiz}>
			<Page spotlightId="taste-checkin" className={css.page}>
				<div className={css.inner}>
					{cards && cards.length ? (
						<div className={css.progress}><div className={css.progressFill} style={{width: `${Math.round((index / cards.length) * 100)}%`}} /></div>
					) : null}
					<div className={css.title}>Le point du mois</div>
					<div className={css.hint}>Une minute pour garder tes suggestions au plus juste.</div>
					{body}
					<Row className={css.footer}>
						{onOpenFull ? <SpottableDiv className={css.button} onClick={onOpenFull}>Refaire le questionnaire complet</SpottableDiv> : null}
						{card ? <SpottableDiv className={css.button} onClick={skip}>Passer</SpottableDiv> : null}
						<SpottableDiv className={`${css.button} ${css.buttonPrimary}`} onClick={close}>{card ? 'Plus tard' : 'Fermer'}</SpottableDiv>
					</Row>
				</div>
			</Page>
		</div>
	);
};

export default TasteCheckIn;
