// « Alors, ce film ? » au générique de fin d'un film (video_player_screen.dart,
// _checkVjodVote) : ▲ J'ai aimé, ▼ Bof. Le générique commence dans le segment
// de fin quand le serveur le connaît, sinon dans les dernières minutes.
import {useCallback, useEffect, useRef, useState} from 'react';
import {KEYS} from '../../utils/keys';
import {loadVotes, saveVote, voteFor, voteKey, creditsStarted} from '../../services/vjodVotes';

const SHOWN_MS = 20000;
export const useVjodVote = ({item, currentTime, duration, segments, enabled}) => {
	const [visible, setVisible] = useState(false);
	const askedRef = useRef(null);
	const timerRef = useRef(null);
	useEffect(() => {
		if (!enabled || visible || !item || item.Type !== 'Movie' || askedRef.current === item.Id) return;
		if (!creditsStarted({currentTime, duration, segments})) return;
		askedRef.current = item.Id;
		loadVotes().then((state) => {
			if (voteFor(state, voteKey(item))) return;
			setVisible(true);
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => setVisible(false), SHOWN_MS);
		});
	}, [enabled, visible, item, currentTime, duration, segments]);
	useEffect(() => () => clearTimeout(timerRef.current), []);
	const vote = useCallback((liked) => {
		clearTimeout(timerRef.current);
		setVisible(false);
		if (item) saveVote(item, liked).catch(() => {});
	}, [item]);
	return {visible, vote};
};

const box = {position: 'absolute', top: 36, right: 36, padding: '16px 16px 14px 20px', borderRadius: 14, background: 'rgba(11,11,13,0.9)', zIndex: 60, color: '#fff'};
const pill = (liked) => ({marginTop: 10, padding: '9px 16px', borderRadius: 22, fontWeight: 700, fontSize: '1.05rem', background: liked ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.16)', color: liked ? '#000' : '#fff'});

// Sur la télécommande, les réponses suivent les flèches : haut pour « J'ai
// aimé », bas pour « Bof ».
const VjodVotePrompt = ({visible, onVote}) => {
	useEffect(() => {
		if (!visible) return undefined;
		const onKey = (e) => {
			const code = e.keyCode || e.which;
			if (code !== KEYS.UP && code !== KEYS.DOWN) return;
			e.preventDefault();
			e.stopPropagation();
			onVote(code === KEYS.UP);
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [visible, onVote]);
	if (!visible) return null;
	return (
		<div style={box}>
			<div style={{fontSize: '1.15rem', fontWeight: 700}}>Alors, ce film ?</div>
			<div style={pill(true)}>▲  J’ai aimé</div>
			<div style={pill(false)}>▼  Bof</div>
			<div style={{marginTop: 8, fontSize: '0.9rem', opacity: 0.6}}>Flèche haut ou bas de la télécommande</div>
		</div>
	);
};

export default VjodVotePrompt;
