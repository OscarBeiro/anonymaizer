// P20/P21: the cookie policy's "change your choice" link must reopen the
// consent banner, which lives elsewhere in the tree. A DOM event keeps the
// two decoupled; P21's banner listens for it.
export const OPEN_CONSENT_EVENT = 'anonymaizer:open-consent';

export const requestConsentBanner = (): void => {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
};
