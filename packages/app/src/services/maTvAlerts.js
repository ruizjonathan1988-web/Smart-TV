// Alertes de Ma TV pour l'administrateur (ma_tv_alerts.dart de l'APK) : une nuit de tests ratée,
// un compte qui expire, une chaîne dont aucune source ne marche. GET /tv/api/alerts, chacune
// montrée une seule fois sur cette TV.
import {getFromStorage, saveToStorage} from './storage';

const SHOWN_KEY = 'vjodMaTvAlertsShown';
export const KEEP_SHOWN = 60;

const str = (v) => (v === undefined || v === null ? '' : String(v));

// Les alertes d'une réponse /tv/api/alerts ; ce qui est mal formé est ignoré.
export const parseMaTvAlerts = (json) => {
	if (!json || typeof json !== 'object' || !Array.isArray(json.alerts)) return [];
	return json.alerts
		.filter((a) => a && typeof a === 'object' && str(a.id) && str(a.title))
		.map((a) => ({id: str(a.id), kind: str(a.kind), title: str(a.title), text: str(a.text)}));
};

// Les alertes pas encore montrées ; les identifiants montrés gardent les KEEP_SHOWN derniers.
export const newMaTvAlerts = (alerts, shown, keep = KEEP_SHOWN) => {
	const seen = new Set(shown);
	const fresh = alerts.filter((a) => !seen.has(a.id));
	const all = [...shown, ...fresh.map((a) => a.id)];
	return {fresh, shown: all.length > keep ? all.slice(all.length - keep) : all};
};

export const isAdministrator = (user) => Boolean(user && user.Policy && user.Policy.IsAdministrator);

// Les alertes en cours (console d'administration), ou null si Ma TV ne répond pas.
export const fetchMaTvAlerts = async (client) => {
	if (!client) return null;
	const json = await client.alerts();
	return json ? parseMaTvAlerts(json) : null;
};

// Les nouvelles alertes à montrer, marquées comme vues. Jamais d'exception : une alerte manquée
// revient à la prochaine vérification.
export const takeNewMaTvAlerts = async (client) => {
	try {
		const alerts = await fetchMaTvAlerts(client);
		if (!alerts || !alerts.length) return [];
		const stored = await getFromStorage(SHOWN_KEY).catch(() => null);
		const shown = Array.isArray(stored) ? stored.map(str) : [];
		const next = newMaTvAlerts(alerts, shown);
		if (next.fresh.length) await saveToStorage(SHOWN_KEY, next.shown).catch(() => {});
		return next.fresh;
	} catch (err) {
		return [];
	}
};
