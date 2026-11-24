// Le libellé de lecture d'une série avec l'allure VJOD (item_detail_screen.dart).
import $L from '@enact/i18n/$L';

export const vjodSeriesPlayLabel = (settings, item, nextUp) => {
	const vjodLook = Boolean(settings && !settings.customThemeId && (settings.visualTheme === 'vjod' || settings.visualTheme === 'ecrin'));
	if (!vjodLook || !item || item.Type !== 'Series') return null;
	const ud = item.UserData || {};
	if (ud.Played) return $L('Revoir');
	const ep = nextUp && nextUp[0];
	const started = ud.PlayedPercentage > 0 || (typeof ud.UnplayedItemCount === 'number' && typeof item.RecursiveItemCount === 'number' && ud.UnplayedItemCount < item.RecursiveItemCount);
	if (!started || !ep || typeof ep.IndexNumber !== 'number') return null;
	if (ep.ParentIndexNumber === 1 && ep.IndexNumber === 1) return null;
	return $L('Reprendre l\'épisode {number}').replace('{number}', ep.IndexNumber);
};
