// Règles pures de la fiche utilisateur, testables sans charger l'interface.

const maps = (raw) => (Array.isArray(raw) ? raw.filter((x) => x && typeof x === 'object') : []);

// Les classifications voisines de même note sont une seule option, noms joints par « / ».
export const groupRatings = (raw) => {
	const out = [];
	maps(raw).forEach((r) => {
		const name = r.Name == null ? null : String(r.Name);
		const score = r.RatingScore && typeof r.RatingScore === 'object' ? r.RatingScore.score : r.Value;
		const subScore = r.RatingScore && typeof r.RatingScore === 'object' ? r.RatingScore.subScore : null;
		if (name === null || score === null || score === undefined) return;
		const last = out[out.length - 1];
		if (last && last.score === score && last.subScore === (subScore == null ? null : subScore)) {
			last.name = `${last.name}/${name}`;
		} else {
			out.push({name, score, subScore: subScore == null ? null : subScore});
		}
	});
	return out;
};

// L'option exacte, sinon la plus haute en dessous.
export const ratingIndex = (ratings, max, sub) => {
	if (max === null || max === undefined) return -1;
	for (let i = ratings.length - 1; i >= 0; i--) {
		if (ratings[i].score === max && ratings[i].subScore === (sub == null ? null : sub)) return i;
	}
	for (let i = ratings.length - 1; i >= 0; i--) {
		if (ratings[i].score <= max) return i;
	}
	return -1;
};

export const badSchedule = (policy) => {
	const list = maps(policy && policy.AccessSchedules);
	for (let i = 0; i < list.length; i++) {
		if ((Number(list[i].StartHour) || 0) >= (Number(list[i].EndHour) || 0)) return i;
	}
	return null;
};
