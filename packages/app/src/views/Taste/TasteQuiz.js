// Le questionnaire de goûts (taste_questionnaire_screen.dart de l'APK), à la
// télécommande : avec qui, quel format, les préférés de tous les temps, des
// affiches à noter, des duels, les limites, les cinémas, puis le résumé.
// Chaque écran se passe ; après les affiches, on peut terminer d'un coup.
import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';

import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import SpottableInput from '../../components/SpottableInput/SpottableInput';
import * as seerrApi from '../../services/seerrApi';
import {getImageUrl} from '../../utils/helpers';
import {genresFromNames} from '../../services/tonight/tonightModels';
import {loadTaste, saveTasteProfile, genreAffinity, pickKey, TASTE_GENRES, AXES} from '../../services/tonight/tasteProfile';
import {loadQuizPool, loadQuizRecommendations, searchQuizTitles, pickGridPage, buildDuel, soFarOf, toPick, fromPick} from '../../services/tonight/tasteQuiz';

import css from './TasteQuiz.module.less';

const SpottableDiv = Spottable('div');
const Group = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const Page = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-only'}, 'div');

const FULL = ['welcome', 'context', 'format', 'pivots', 'grid', 'duels', 'limits', 'cinemas', 'recap'];
const QUICK = ['welcome', 'context', 'pivots', 'grid', 'limits', 'recap'];
const MAX_PIVOTS = 3;
const GRID_SIZE = 8;

const CINEMAS = [
	['france', ['fr'], 'France'], ['english', ['en'], 'États-Unis et Royaume-Uni'], ['korea', ['ko'], 'Corée du Sud'],
	['japan', ['ja'], 'Japon'], ['anime', [], 'Animation japonaise'], ['spanish', ['es'], 'Espagne et Amérique latine'],
	['italy', ['it'], 'Italie'], ['nordic', ['sv', 'da', 'no', 'fi', 'is'], 'Scandinavie'], ['india', ['hi', 'ta', 'te'], 'Inde'],
	['surprise', [], 'Surprends-moi']
];

const GENRE_LABELS = {
	action: 'Action', adventure: 'Aventure', animation: 'Animation', comedy: 'Comédie', crime: 'Policier',
	documentary: 'Documentaire', drama: 'Drame', family: 'Famille', fantasy: 'Fantastique', history: 'Histoire',
	horror: 'Horreur', kids: 'Jeunesse', music: 'Musique', mystery: 'Mystère', reality: 'Télé-réalité',
	romance: 'Romance', scifi: 'Science-fiction', talk: 'Talk-shows et feuilletons', thriller: 'Thriller', war: 'Guerre', western: 'Western'
};
const CONTEXTS = [['alone', 'Seul'], ['couple', 'À deux'], ['family', 'En famille avec des enfants'], ['friends', 'Entre amis']];
const KIDS = [['under7', 'Moins de 7 ans'], ['from7to12', '7 à 12 ans'], ['teen', '13 ans et plus']];
const MEDIA = [['both', 'Films et séries'], ['movies', 'Surtout des films'], ['series', 'Surtout des séries']];
const LENGTHS = [['short', 'Moins d\'1 h 40'], ['medium', '1 h 40 à 2 h 20'], ['long', 'Même 3 h, pas de souci'], ['any', 'Peu importe']];
const FORMATS = [['mini', 'Les mini-séries'], ['few', 'Quelques saisons'], ['long', 'Les longues sagas'], ['any', 'Peu importe']];
const VIOLENCE = [['none', 'Pas pour moi'], ['justified', 'Si c\'est justifié'], ['fine', 'Aucun problème']];
const SUBTITLES = [['never', 'Jamais'], ['depends', 'Ça dépend'], ['gladly', 'Avec plaisir']];
const AXIS_WORDS = {
	darkLight: ['sombre', 'léger'], realImaginary: ['réaliste', 'imaginaire'], slowFast: ['posé', 'nerveux'],
	recentClassic: ['récent', 'classique'], popularNiche: ['grand public', 'pointu'], spectacleIntimate: ['spectaculaire', 'intimiste']
};
const VERDICT_NEXT = {undefined: 'liked', liked: 'meh', meh: 'disliked', disliked: undefined};
const VERDICT_LABEL = {liked: 'Aimé', meh: 'Bof', disliked: 'Pas aimé'};

const posterOf = (t) => t.imageUrl || (t.poster ? seerrApi.getImageUrl(t.poster, 'w342') : null);

const Chip = ({id, label, on, danger, onPick, spotlightId}) => {
	const handleClick = useCallback(() => onPick(id), [onPick, id]);
	return (
		<SpottableDiv className={`${css.chip} ${on ? (danger ? css.chipDanger : css.chipOn) : ''}`} onClick={handleClick} spotlightId={spotlightId}>
			{on ? '✓ ' : ''}{label}
		</SpottableDiv>
	);
};

const Section = ({title, children}) => (
	<div className={css.section}>
		{title ? <div className={css.sectionTitle}>{title}</div> : null}
		<Group className={css.chips}>{children}</Group>
	</div>
);

const Poster = ({title, badge, badgeClass, onPick, spotlightId, wide}) => {
	const handleClick = useCallback(() => onPick(title), [onPick, title]);
	const src = posterOf(title);
	return (
		<SpottableDiv className={`${css.poster} ${wide ? css.posterWide : ''}`} onClick={handleClick} spotlightId={spotlightId}>
			<div className={css.posterImg}>
				{src ? <img src={src} alt="" /> : <span className={css.posterName}>{title.title}</span>}
				{badge ? <span className={`${css.badge} ${badgeClass || ''}`}>{badge}</span> : null}
			</div>
			<div className={css.posterTitle}>{title.title}</div>
		</SpottableDiv>
	);
};

const TasteQuiz = ({onDone, backHandlerRef}) => {
	const {api, serverUrl, user} = useAuth();
	const [previous, setPrevious] = useState(null);
	const [sequence, setSequence] = useState(FULL);
	const [index, setIndex] = useState(0);
	const [saving, setSaving] = useState(false);
	// Réponses.
	const [contexts, setContexts] = useState([]);
	const [kidsAge, setKidsAge] = useState(null);
	const [mediaPref, setMediaPref] = useState('both');
	const [movieLength, setMovieLength] = useState('any');
	const [seriesFormat, setSeriesFormat] = useState('any');
	const [pivots, setPivots] = useState({});
	const [verdicts, setVerdicts] = useState({});
	const [rated, setRated] = useState({});
	const [axes, setAxes] = useState({});
	const [avoided, setAvoided] = useState([]);
	const [violence, setViolence] = useState('fine');
	const [subtitles, setSubtitles] = useState('depends');
	const [cinemas, setCinemas] = useState([]);
	const [era, setEra] = useState('any');
	// Matériel.
	const [pool, setPool] = useState(null);
	const [libraryFavorites, setLibraryFavorites] = useState([]);
	const [pages, setPages] = useState([]);
	const [page, setPage] = useState(0);
	const [pageLoading, setPageLoading] = useState(false);
	const recsOfLiked = useRef({});
	const [duels, setDuels] = useState([]);
	const [duel, setDuel] = useState(0);
	const [query, setQuery] = useState('');
	const [searchResults, setSearchResults] = useState(null);
	const searchTimer = useRef(null);

	const screen = sequence[index];
	const quick = sequence === QUICK;
	const gridPageCount = quick ? 1 : 3;

	// Les réponses d'avant, puis la réserve d'affiches et les favoris du serveur.
	useEffect(() => {
		let alive = true;
		loadTaste().then(({profile: p}) => {
			if (!alive) return;
			setPrevious(p);
			setContexts(p.contexts);
			setKidsAge(p.kidsAge);
			setMediaPref(p.mediaPref);
			setMovieLength(p.movieLength);
			setSeriesFormat(p.seriesFormat);
			setAxes({...p.axes});
			setAvoided(p.avoided);
			setViolence(p.violence);
			setSubtitles(p.subtitles);
			setEra(p.era);
			setCinemas(CINEMAS.filter(([id, langs]) =>
				(langs.length && langs.every((l) => p.languages.indexOf(l) >= 0)) || (id === 'anime' && p.anime) || (id === 'surprise' && p.surpriseMe)).map(([id]) => id));
			const pv = {};
			p.pivots.forEach((pick) => {
				pv[pickKey(pick)] = fromPick(pick);
			});
			setPivots(pv);
		});
		loadQuizPool().then((list) => {
			if (alive) setPool(list);
		});
		if (api && user) {
			const fields = 'ProviderIds,Genres,ProductionYear';
			Promise.all([
				api.getItems({IncludeItemTypes: 'Movie,Series', Recursive: true, Filters: 'IsFavorite', Fields: fields, Limit: 16}).catch(() => null),
				api.getItems({IncludeItemTypes: 'Movie,Series', Recursive: true, Filters: 'IsPlayed', SortBy: 'DatePlayed', SortOrder: 'Descending', Fields: fields, Limit: 24}).catch(() => null)
			]).then((answers) => {
				if (!alive) return;
				const seen = new Set();
				const out = [];
				answers.forEach((a) => ((a && a.Items) || []).forEach((item) => {
					const id = parseInt(item.ProviderIds && (item.ProviderIds.Tmdb || item.ProviderIds.tmdb), 10);
					if (!id) return;
					const type = item.Type === 'Series' ? 'tv' : 'movie';
					const key = `${type}:${id}`;
					if (seen.has(key)) return;
					seen.add(key);
					out.push({id, type, key, title: item.Name, genres: genresFromNames(item.Genres || []), year: item.ProductionYear || null, rating: 0, votes: 0, language: null, poster: null,
						imageUrl: getImageUrl(serverUrl, item.Id, 'Primary', {maxHeight: 450})});
				}));
				setLibraryFavorites(out.slice(0, 16));
			});
		}
		return () => {
			alive = false;
		};
	}, [api, user, serverUrl]);

	const focusPage = useCallback(() => {
		setTimeout(() => Spotlight.focus('taste-first') || Spotlight.focus('taste-quiz-page'), 30);
	}, []);

	useEffect(() => {
		focusPage();
	}, [screen, page, duel, focusPage]);

	// Ce que demande l'écran qui s'ouvre, une fois la réserve là.
	useEffect(() => {
		if (!pool || !pool.length) return;
		if (screen === 'grid' && !pages.length) {
			setPages([pickGridPage({pool, count: GRID_SIZE, exclude: new Set(Object.keys(pivots)), mediaPref, avoided, random: Math.random})]);
			setPage(0);
		}
		if (screen === 'duels' && !duels.length) {
			const used = new Set(Object.keys(pivots).concat(...pages.map((p) => p.map((t) => t.key))));
			const out = [];
			AXES.forEach((axis) => {
				const d = buildDuel(axis, {pool, used, avoided});
				if (!d) return;
				used.add(d.left.key);
				used.add(d.right.key);
				out.push(d);
			});
			setDuels(out);
			setDuel(0);
		}
	}, [screen, pool]); // eslint-disable-line react-hooks/exhaustive-deps

	const draft = useCallback(() => {
		const base = previous || {};
		const merged = (verdict, before) => (before || []).filter((p) => !verdicts[pickKey(p)])
			.concat(Object.keys(verdicts).filter((k) => verdicts[k] === verdict).map((k) => toPick(rated[k])));
		const languages = [];
		CINEMAS.forEach(([id, langs]) => {
			if (cinemas.indexOf(id) >= 0) langs.forEach((l) => languages.push(l));
		});
		const d = {
			...base,
			mediaPref, era, avoided, languages,
			favorites: merged('liked', base.favorites),
			meh: merged('meh', base.meh),
			disliked: merged('disliked', base.disliked),
			pivots: Object.keys(pivots).length ? Object.keys(pivots).map((k) => toPick(pivots[k])) : (base.pivots || []),
			contexts, kidsAge, movieLength, seriesFormat, axes, violence, subtitles,
			anime: cinemas.indexOf('anime') >= 0,
			surpriseMe: cinemas.indexOf('surprise') >= 0
		};
		const affinity = genreAffinity(d);
		d.liked = Object.keys(affinity).filter((g) => affinity[g] >= 0.4 && avoided.indexOf(g) < 0);
		return d;
	}, [previous, verdicts, rated, cinemas, mediaPref, era, avoided, pivots, contexts, kidsAge, movieLength, seriesFormat, axes, violence, subtitles]);

	const finish = useCallback(async () => {
		if (saving) return;
		setSaving(true);
		await saveTasteProfile(draft());
		if (onDone) onDone(true);
	}, [saving, draft, onDone]);

	const nextGridPage = useCallback(async () => {
		if (page < pages.length - 1) {
			setPage(page + 1);
			return;
		}
		if (!pool) return;
		setPageLoading(true);
		const soFar = soFarOf(pages, verdicts);
		const todo = soFar.liked.filter((t) => !recsOfLiked.current[t.key]).slice(0, 4);
		await Promise.all(todo.map(async (t) => {
			recsOfLiked.current[t.key] = await loadQuizRecommendations(t);
		}));
		const exclude = new Set(Object.keys(pivots));
		pages.forEach((p) => p.forEach((t) => exclude.add(t.key)));
		const fresh = pickGridPage({pool, count: GRID_SIZE, exclude, mediaPref, avoided, soFar, recommendationsOfLiked: recsOfLiked.current, random: Math.random});
		setPageLoading(false);
		if (fresh.length) {
			setPages(pages.concat([fresh]));
			setPage(pages.length);
		} else {
			setIndex((i) => i + 1);
		}
	}, [page, pages, pool, verdicts, pivots, mediaPref, avoided]);

	const next = useCallback(() => {
		if (screen === 'grid' && page < gridPageCount - 1) {
			nextGridPage();
			return;
		}
		if (index >= sequence.length - 1) {
			finish();
			return;
		}
		setIndex(index + 1);
	}, [screen, page, gridPageCount, nextGridPage, index, sequence, finish]);

	const back = useCallback(() => {
		if (screen === 'grid' && page > 0) {
			setPage(page - 1);
			return true;
		}
		if (screen === 'duels' && duel > 0) {
			setDuel(duel - 1);
			return true;
		}
		if (index > 0) {
			setIndex(index - 1);
			return true;
		}
		return false;
	}, [screen, page, duel, index]);

	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => back();
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, back]);

	const jumpTo = useCallback((target) => {
		const at = sequence.indexOf(target);
		if (at >= 0) setIndex(at);
		else {
			setSequence(FULL);
			setIndex(FULL.indexOf(target));
		}
	}, [sequence]);

	const start = useCallback((id) => {
		setSequence(id === 'quick' ? QUICK : FULL);
		setIndex(1);
	}, []);

	const toggleIn = (list, set) => (id) => set(list.indexOf(id) >= 0 ? list.filter((x) => x !== id) : list.concat([id]));
	const toggleContext = useMemo(() => toggleIn(contexts, setContexts), [contexts]);
	const toggleAvoided = useMemo(() => toggleIn(avoided, setAvoided), [avoided]);
	const toggleCinema = useMemo(() => toggleIn(cinemas, setCinemas), [cinemas]);

	const cycleVerdict = useCallback((t) => {
		const nextVerdict = VERDICT_NEXT[verdicts[t.key]];
		setVerdicts((cur) => {
			const out = {...cur};
			if (nextVerdict) out[t.key] = nextVerdict;
			else delete out[t.key];
			return out;
		});
		setRated((cur) => ({...cur, [t.key]: t}));
	}, [verdicts]);

	const togglePivot = useCallback((t) => {
		setPivots((cur) => {
			const out = {...cur};
			if (out[t.key]) delete out[t.key];
			else if (Object.keys(out).length < MAX_PIVOTS) out[t.key] = t;
			return out;
		});
	}, []);

	const handleQuery = useCallback((e) => {
		const value = e && e.target ? e.target.value : e;
		setQuery(value);
		clearTimeout(searchTimer.current);
		searchTimer.current = setTimeout(async () => {
			const q = String(value || '').trim();
			setSearchResults(q.length < 2 ? null : await searchQuizTitles(q));
		}, 400);
	}, []);

	const answerDuel = useCallback((value) => {
		const d = duels[duel];
		if (!d) return;
		setAxes((cur) => {
			const out = {...cur};
			if (value === 0) delete out[d.axis];
			else out[d.axis] = value;
			return out;
		});
		if (duel < duels.length - 1) setDuel(duel + 1);
		else setIndex((i) => i + 1);
	}, [duels, duel]);
	const pickLeft = useCallback(() => answerDuel(-1), [answerDuel]);
	const pickRight = useCallback(() => answerDuel(1), [answerDuel]);
	const pickNeither = useCallback(() => answerDuel(0), [answerDuel]);

	const setNiche = useCallback((id) => setAxes((cur) => {
		const out = {...cur};
		if (id === 'known') out.popularNiche = -1.5;
		else if (id === 'niche') out.popularNiche = 1.5;
		else delete out.popularNiche;
		return out;
	}), []);

	const later = useCallback(() => onDone && onDone(false), [onDone]);
	const goBack = useCallback(() => back() || (onDone && onDone(false)), [back, onDone]);

	// ---------------------------------------------------------------- écrans

	const TITLES = {
		welcome: ['On fait connaissance ?', 'Quelques minutes pour des suggestions qui te ressemblent. Tu peux passer n\'importe quelle question.'],
		context: ['Le plus souvent, tu regardes…', 'Coche tout ce qui arrive souvent.'],
		format: ['Ton format', 'Films ou séries, et combien de temps tu leur donnes.'],
		pivots: ['Tes films et séries préférés de tous les temps', `Jusqu'à ${MAX_PIVOTS}. Ce sont eux qui guideront le plus tes suggestions.`],
		grid: ['Tu les as vus ? Qu\'en as-tu pensé ?', 'OK une fois pour Aimé, deux fois pour Bof, trois fois pour Pas aimé. Laisse ceux que tu n\'as pas vus.'],
		duels: ['Ce soir, plutôt celui-ci ou celui-là ?', 'Pas besoin de les avoir vus : choisis celui qui te tente le plus.'],
		limits: ['Tes limites', 'Ce que tu ne veux pas voir proposé.'],
		cinemas: ['Des cinémas qui t\'attirent ?', 'Facultatif. Ces langues d\'origine seront mises en avant.'],
		recap: ['Voilà ce que j\'ai compris', 'Sélectionne une ligne pour la corriger.']
	};

	const waiting = <div className={css.center}><LoadingSpinner /></div>;
	let body = null;
	if (screen === 'welcome') {
		body = (
			<Group className={css.welcome}>
				<Chip id="quick" label={`Rapide · 1 min 30 — l'essentiel : avec qui tu regardes, tes favoris, quelques affiches et tes limites.`} onPick={start} spotlightId="taste-first" />
				<Chip id="full" label="Complet · 3 min 30 — le plus précis : format, duels d'affiches et cinémas en plus." onPick={start} />
			</Group>
		);
	} else if (screen === 'context') {
		body = (
			<div>
				<Section title="Avec qui ?">
					{CONTEXTS.map(([id, label], i) => <Chip key={id} id={id} label={label} on={contexts.indexOf(id) >= 0} onPick={toggleContext} spotlightId={i === 0 ? 'taste-first' : undefined} />)}
				</Section>
				{contexts.indexOf('family') >= 0 ? (
					<Section title="Âge du plus jeune ?">
						{KIDS.map(([id, label]) => <Chip key={id} id={id} label={label} on={kidsAge === id} onPick={setKidsAge} />)}
					</Section>
				) : null}
			</div>
		);
	} else if (screen === 'format') {
		body = (
			<div>
				<Section title="Vous regardez plutôt…">
					{MEDIA.map(([id, label], i) => <Chip key={id} id={id} label={label} on={mediaPref === id} onPick={setMediaPref} spotlightId={i === 0 ? 'taste-first' : undefined} />)}
				</Section>
				<Section title="Un bon film, pour toi, ça dure…">
					{LENGTHS.map(([id, label]) => <Chip key={id} id={id} label={label} on={movieLength === id} onPick={setMovieLength} />)}
				</Section>
				<Section title="Côté séries, tu préfères…">
					{FORMATS.map(([id, label]) => <Chip key={id} id={id} label={label} on={seriesFormat === id} onPick={setSeriesFormat} />)}
				</Section>
			</div>
		);
	} else if (screen === 'pivots') {
		const famous = pool ? pool.slice().sort((a, b) => b.votes - a.votes).slice(0, 40) : [];
		const seen = new Set();
		const tiles = [].concat(Object.keys(pivots).map((k) => pivots[k]), searchResults || [], libraryFavorites, famous).filter((t) => {
			if (seen.has(t.key)) return false;
			seen.add(t.key);
			return true;
		});
		body = (
			<div>
				<div className={css.searchRow}>
					<SpottableInput type="text" purpose="search" spotlightId="taste-first" placeholder="Chercher un titre" value={query} onChange={handleQuery} autoComplete="off" />
					<span className={css.count}>{`Choisis : ${Object.keys(pivots).length} sur ${MAX_PIVOTS}`}</span>
				</div>
				{!pool ? waiting : (
					<Group className={css.grid}>
						{tiles.map((t) => <Poster key={t.key} title={t} badge={pivots[t.key] ? '♥' : null} badgeClass={css.badgeLiked} onPick={togglePivot} />)}
					</Group>
				)}
			</div>
		);
	} else if (screen === 'grid') {
		const list = pages[page];
		body = !list || pageLoading ? waiting : (
			<div>
				{gridPageCount > 1 ? <div className={css.count}>{`Page ${page + 1} sur ${gridPageCount}`}</div> : null}
				<Group className={css.grid}>
					{list.map((t, i) => {
						const v = verdicts[t.key];
						return <Poster key={t.key} title={t} badge={v ? VERDICT_LABEL[v] : null} badgeClass={v ? css[`badge_${v}`] : ''} onPick={cycleVerdict} spotlightId={i === 0 ? 'taste-first' : undefined} />;
					})}
				</Group>
			</div>
		);
	} else if (screen === 'duels') {
		const d = duels[duel];
		body = !pool ? waiting : !d ? <div className={css.note}>{'Pas de duel possible pour l\u2019instant.'}</div> : (
			<div>
				<div className={css.count}>{`Duel ${duel + 1} sur ${duels.length}`}</div>
				<Group className={css.duel}>
					<Poster title={d.left} onPick={pickLeft} spotlightId="taste-first" wide />
					<span className={css.or}>ou</span>
					<Poster title={d.right} onPick={pickRight} wide />
				</Group>
				<Section><Chip id="neither" label="Aucun des deux" onPick={pickNeither} /></Section>
			</div>
		);
	} else if (screen === 'limits') {
		body = (
			<div>
				<Section title="Ce que vous ne voulez jamais voir">
					{TASTE_GENRES.map((g, i) => <Chip key={g} id={g} label={GENRE_LABELS[g]} on={avoided.indexOf(g) >= 0} danger onPick={toggleAvoided} spotlightId={i === 0 ? 'taste-first' : undefined} />)}
				</Section>
				<Section title="Violence et gore">
					{VIOLENCE.map(([id, label]) => <Chip key={id} id={id} label={label} on={violence === id} onPick={setViolence} />)}
				</Section>
				<Section title="Les sous-titres">
					{SUBTITLES.map(([id, label]) => <Chip key={id} id={id} label={label} on={subtitles === id} onPick={setSubtitles} />)}
				</Section>
			</div>
		);
	} else if (screen === 'cinemas') {
		body = (
			<Section>
				{CINEMAS.map(([id, , label], i) => <Chip key={id} id={id} label={id === 'surprise' ? `🎲 ${label}` : label} on={cinemas.indexOf(id) >= 0} onPick={toggleCinema} spotlightId={i === 0 ? 'taste-first' : undefined} />)}
			</Section>
		);
	} else if (screen === 'recap') {
		const d = draft();
		const lines = [];
		if (d.contexts.length) lines.push([`Tu regardes surtout : ${CONTEXTS.filter(([id]) => d.contexts.indexOf(id) >= 0).map(([, l]) => l.toLowerCase()).join(', ')}`, 'context']);
		lines.push([[MEDIA.find(([id]) => id === d.mediaPref)[1]]
			.concat(d.movieLength !== 'any' ? [LENGTHS.find(([id]) => id === d.movieLength)[1].toLowerCase()] : [])
			.concat(d.seriesFormat !== 'any' ? [FORMATS.find(([id]) => id === d.seriesFormat)[1].toLowerCase()] : []).join(', '), 'format']);
		const affinity = genreAffinity(d);
		const sorted = Object.keys(affinity).sort((a, b) => affinity[b] - affinity[a]);
		const loved = sorted.filter((g) => affinity[g] > 0.15).slice(0, 3).map((g) => GENRE_LABELS[g].toLowerCase());
		const less = sorted.slice().reverse().filter((g) => affinity[g] < -0.1).slice(0, 2).map((g) => GENRE_LABELS[g].toLowerCase());
		if (loved.length) lines.push([`Tu aimes surtout : ${loved.join(', ')}`, 'grid']);
		if (less.length) lines.push([`Moins ton truc : ${less.join(', ')}`, 'grid']);
		const leanings = AXES.filter((a) => d.axes[a]).map((a) => AXIS_WORDS[a][d.axes[a] > 0 ? 1 : 0]);
		if (leanings.length) lines.push([`Plutôt : ${leanings.join(', ')}`, 'duels']);
		if (d.avoided.length) lines.push([`Jamais : ${d.avoided.map((g) => GENRE_LABELS[g].toLowerCase()).join(', ')}`, 'limits']);
		if (d.violence === 'none') lines.push(['Pas de violence ni de gore', 'limits']);
		if (d.violence === 'justified') lines.push(['De la violence seulement si elle est justifiée', 'limits']);
		if (d.subtitles === 'never') lines.push(['Pas de films à sous-titres', 'limits']);
		if (d.subtitles === 'gladly') lines.push(['Curieux des films en VO', 'limits']);
		if (cinemas.length) lines.push([`Cinémas mis en avant : ${CINEMAS.filter(([id]) => cinemas.indexOf(id) >= 0).map(([, , l]) => l.toLowerCase()).join(', ')}`, 'cinemas']);
		const niche = axes.popularNiche || 0;
		body = (
			<div>
				<Group>
					{lines.map(([text, target], i) => <Chip key={text} id={target} label={`${text}  ›`} onPick={jumpTo} spotlightId={i === 0 ? 'taste-first' : undefined} />)}
				</Group>
				<Section title="Plus connu ou plus pointu ?">
					<Chip id="known" label="Plus connu" on={niche < -0.5} onPick={setNiche} />
					<Chip id="balanced" label="Équilibré" on={Math.abs(niche) <= 0.5} onPick={setNiche} />
					<Chip id="niche" label="Plus pointu" on={niche > 0.5} onPick={setNiche} />
				</Section>
				<Section title="Plus récent ou plus ancien ?">
					<Chip id="recent" label="Plus récent" on={era === 'recent'} onPick={setEra} />
					<Chip id="any" label="Peu importe" on={era === 'any'} onPick={setEra} />
					<Chip id="classic" label="Plus ancien" on={era === 'classic'} onPick={setEra} />
				</Section>
			</div>
		);
	}

	const [title, hint] = TITLES[screen];
	const last = index >= sequence.length - 1;
	const gridHasMore = screen === 'grid' && page < gridPageCount - 1;
	const canFinishEarly = !last && sequence.indexOf('grid') >= 0 && index > sequence.indexOf('grid');
	let nextLabel = 'Suivant';
	if (last) nextLabel = saving ? 'Enregistrement…' : 'Terminer';
	else if (gridHasMore) nextLabel = 'Page suivante';
	else if (screen === 'duels') nextLabel = 'Passer';

	return (
		<div className={css.quiz}>
			<Page spotlightId="taste-quiz-page" className={css.page}>
				<Scroller direction="vertical" verticalScrollbar="hidden">
					<div className={css.inner}>
						{index > 0 ? (
							<div className={css.progress}>
								<div className={css.progressFill} style={{width: `${Math.round((index / (sequence.length - 1)) * 100)}%`}} />
							</div>
						) : null}
						<div className={css.title}>{title}</div>
						<div className={css.hint}>{hint}</div>
						{body}
						<Group className={css.footer}>
							{index === 0 ? (
								<SpottableDiv className={css.button} onClick={later}>Plus tard</SpottableDiv>
							) : (
								<>
									<SpottableDiv className={css.button} onClick={goBack}>Retour</SpottableDiv>
									{canFinishEarly ? <SpottableDiv className={css.button} onClick={finish}>Terminer maintenant</SpottableDiv> : null}
									<SpottableDiv className={`${css.button} ${css.buttonPrimary}`} onClick={next}>{nextLabel}</SpottableDiv>
								</>
							)}
						</Group>
					</div>
				</Scroller>
			</Page>
		</div>
	);
};

export default TasteQuiz;
