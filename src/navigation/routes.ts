export const ROUTES = {
  AUTH: 'Auth',
  FEED: 'Feed',
  WALLET: 'Wallet',
  PROFILE: 'Profile',
  SETTINGS: 'Settings',
  TRANSACTION_LOG: 'TransactionLog',
  USER_PROFILE: 'UserProfile',
  TRANSACTION: 'Transaction',
  POST_CREATE: 'PostCreate',
  POST_DETAIL: 'PostDetail',
  ONBOARDING: 'Onboarding',
  PASSPORT_SCAN: 'PassportScan',
  PASSPORT_SCAN_SCREEN: 'PassportScanScreen',
  BIOMETRIC_SETUP: 'BiometricSetup',
  MRZ_SCANNER: 'MRZScanner',
  MRZ_SCANNER_SCREEN: 'MRZScannerScreen',
  MRZ_MANUAL_INPUT: 'MRZManualInput',
  MRZ_MANUAL_INPUT_SCREEN: 'MRZManualInputScreen',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const AUTH_FLOW_ROUTES: ReadonlySet<AppRoute> = new Set([
  ROUTES.AUTH,
  ROUTES.ONBOARDING,
  ROUTES.PASSPORT_SCAN,
  ROUTES.PASSPORT_SCAN_SCREEN,
  ROUTES.BIOMETRIC_SETUP,
  ROUTES.MRZ_SCANNER,
  ROUTES.MRZ_SCANNER_SCREEN,
  ROUTES.MRZ_MANUAL_INPUT,
  ROUTES.MRZ_MANUAL_INPUT_SCREEN,
]);

export const PROTECTED_ROUTES: ReadonlySet<AppRoute> = new Set([
  ROUTES.WALLET,
  ROUTES.PROFILE,
  ROUTES.POST_CREATE,
  ROUTES.TRANSACTION,
]);
