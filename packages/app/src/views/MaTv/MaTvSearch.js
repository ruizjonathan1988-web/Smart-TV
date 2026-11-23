// Chercher une chaîne (ma_tv_search_screen.dart de l'APK) : son nom, son
// numéro ou ce qu'elle diffuse (« psg » trouve la chaîne du match). OK dans
// le champ prend le premier résultat, ▼ descend dans la liste.
import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';

import SpottableInput from '../../components/SpottableInput/SpottableInput';
import LoadingSpinner from '../../components/LoadingSpinner';
import {KEYS} from '../../utils/keys';
import {formatClockTime} from '../../utils/clock';
import {searchChannels} from '../../services/maTvSearch';
import {maTvColors as C} from './maTvTheme';
import {programsAt} from './maTvZap';
import {Page, FocusRow, Empty} from './MaTvPageParts';

import css from './MaTvPages.module.less';

const Result = ({channel, index, nowSec, onPick}) => {
	const {current} = programsAt(channel, nowSec);
	return (
		<FocusRow className={css.result} onClick={onPick} data={index}>
			<span className={css.resultNum} style={{color: C.mute}}>{channel.num || ''}</span>
			<span className={css.resultLogo}>{channel.logo ? <img src={channel.logo} alt="" /> : null}</span>
			<span className={css.resultText}>
				<div className={css.resultName} style={{color: C.ink}}>{channel.name}</div>
				{current ? (
					<div className={css.resultNow} style={{color: C.mute}}>
						{current.s ? formatClockTime(new Date(current.s * 1000)) + ' · ' : ''}{current.t}
					</div>
				) : null}
			</span>
		</FocusRow>
	);
};

const MaTvSearch = ({client, initialQuery = '', title, onPick}) => {
	const [all, setAll] = useState(null);
	const [failed, setFailed] = useState(false);
	const [text, setText] = useState(initialQuery);
	const [query, setQuery] = useState(initialQuery);
	const debounce = useRef(null);

	useEffect(() => {
		let alive = true;
		client.allChannels().then((res) => {
			if (!alive) return;
			const list = res && Array.isArray(res.chans) ? res.chans : null;
			setAll(list || []);
			setFailed(!list);
		});
		const t = setTimeout(() => Spotlight.focus('matv-search-input'), 0);
		return () => {
			alive = false;
			clearTimeout(t);
			clearTimeout(debounce.current);
		};
	}, [client]);

	const found = all ? searchChannels(all, query) : [];
	const foundRef = useRef(found);
	foundRef.current = found;

	const handleChange = useCallback((e) => {
		const value = e && e.target ? e.target.value : e;
		setText(value);
		clearTimeout(debounce.current);
		debounce.current = setTimeout(() => setQuery(value), 200);
	}, []);

	const handleKeyDown = useCallback((e) => {
		if ((e.keyCode || e.which) !== KEYS.ENTER) return;
		const list = all ? searchChannels(all, text) : [];
		setQuery(text);
		if (list.length) onPick({channels: list, index: 0});
	}, [all, text, onPick]);

	const handlePick = useCallback((index) => onPick({channels: foundRef.current, index}), [onPick]);

	const nowSec = Math.floor(Date.now() / 1000);
	let body;
	if (!all) body = <div className={css.empty}><LoadingSpinner /></div>;
	else if (failed) body = <Empty>{$L('Ma TV ne répond pas, réessaie dans un instant.')}</Empty>;
	else if (!found.length) body = <Empty>{query.trim() ? $L('Aucune chaîne trouvée.') : $L('Tape quelques lettres.')}</Empty>;
	else body = found.map((c, i) => <Result key={c.id} channel={c} index={i} nowSec={nowSec} onPick={handlePick} />);

	return (
		<Page title={title || $L('Chercher une chaîne')} spotlightId="matv-search">
			<div className={css.searchBox}>
				<SpottableInput
					type="text"
					purpose="search"
					spotlightId="matv-search-input"
					placeholder={$L('Nom, numéro ou programme (ex. « TF1 », « 12 », « PSG »)')}
					value={text}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					autoComplete="off"
				/>
			</div>
			{body}
		</Page>
	);
};

export default MaTvSearch;
