// Le questionnaire de goûts, ou le point du mois.
import {useState, useCallback} from 'react';
import TasteQuiz from './TasteQuiz';
import TasteCheckIn from './TasteCheckIn';

const Taste = ({mode, onDone, backHandlerRef}) => {
	const [full, setFull] = useState(mode !== 'checkIn');
	const openFull = useCallback(() => setFull(true), []);
	return full
		? <TasteQuiz onDone={onDone} backHandlerRef={backHandlerRef} />
		: <TasteCheckIn onDone={onDone} onOpenFull={openFull} backHandlerRef={backHandlerRef} />;
};

export default Taste;
