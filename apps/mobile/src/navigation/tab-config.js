import { TAB_ROUTES } from './route-names';

export const TAB_ICON_BY_ROUTE = {
  [TAB_ROUTES.DISCOVER]:   'search',
  [TAB_ROUTES.THERAPY]:    'calendar',
  [TAB_ROUTES.FAVORITES]:  'heart',
  [TAB_ROUTES.PROFILE]:    'person',
  [TAB_ROUTES.OPTIONS]:    'settings',
};

export const TAB_TRANSLATION_KEYS = {
  [TAB_ROUTES.DISCOVER]:   'tabSearch',
  [TAB_ROUTES.THERAPY]:    'tabTherapy',
  [TAB_ROUTES.FAVORITES]:  'tabFavorites',
  [TAB_ROUTES.PROFILE]:    'tabProfile',
  [TAB_ROUTES.OPTIONS]:    'tabOptions',
};

// Home screen name within each tab's nested stack (see withProfileScreens
// in AppTabs.js). Pressing a tab navigates back to this screen, even if a
// profile screen is currently open on top of it. Tabs without a nested
// stack (e.g. Options) are omitted.
export const TAB_HOME_ROUTES = {
  [TAB_ROUTES.DISCOVER]:   'DiscoverHome',
  [TAB_ROUTES.THERAPY]:    'TherapyHome',
  [TAB_ROUTES.FAVORITES]:  'FavoritesHome',
  [TAB_ROUTES.PROFILE]:    'ProfileHome',
};
