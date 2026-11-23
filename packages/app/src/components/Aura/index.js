export {default as AuraDrawer} from './AuraDrawer';
export {default as AuraPropose} from './AuraPropose';

// Ouvrir le tiroir ou « Proposer à… » de n'importe où : l'appli les montre.
export const openAuraDrawer = () => window.dispatchEvent(new CustomEvent('vjod:auraDrawer'));
export const openAuraPropose = (film) => window.dispatchEvent(new CustomEvent('vjod:auraPropose', {detail: film}));
