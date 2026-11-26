import ptCommon from '../messages/pt/common.json';
import ptShell from '../messages/pt/shell.json';
import ptShared from '../messages/pt/shared.json';
import ptDashboard from '../messages/pt/dashboard.json';
import ptGoals from '../messages/pt/goals.json';
import ptAnalytics from '../messages/pt/analytics.json';
import ptAccounts from '../messages/pt/accounts.json';
import ptCards from '../messages/pt/cards.json';
import ptPurchases from '../messages/pt/purchases.json';
import ptCategories from '../messages/pt/categories.json';
import ptReceipts from '../messages/pt/receipts.json';
import ptInvestments from '../messages/pt/investments.json';
import ptInstallments from '../messages/pt/installments.json';
import ptConsortiums from '../messages/pt/consortiums.json';
import ptSavings from '../messages/pt/savings.json';
import ptRecurring from '../messages/pt/recurring.json';
import ptNotifications from '../messages/pt/notifications.json';
import ptAdvisor from '../messages/pt/advisor.json';

import esCommon from '../messages/es/common.json';
import esShell from '../messages/es/shell.json';
import esShared from '../messages/es/shared.json';
import esDashboard from '../messages/es/dashboard.json';
import esGoals from '../messages/es/goals.json';
import esAnalytics from '../messages/es/analytics.json';
import esAccounts from '../messages/es/accounts.json';
import esCards from '../messages/es/cards.json';
import esPurchases from '../messages/es/purchases.json';
import esCategories from '../messages/es/categories.json';
import esReceipts from '../messages/es/receipts.json';
import esInvestments from '../messages/es/investments.json';
import esInstallments from '../messages/es/installments.json';
import esConsortiums from '../messages/es/consortiums.json';
import esSavings from '../messages/es/savings.json';
import esRecurring from '../messages/es/recurring.json';
import esNotifications from '../messages/es/notifications.json';
import esAdvisor from '../messages/es/advisor.json';

import enCommon from '../messages/en/common.json';
import enShell from '../messages/en/shell.json';
import enShared from '../messages/en/shared.json';
import enDashboard from '../messages/en/dashboard.json';
import enGoals from '../messages/en/goals.json';
import enAnalytics from '../messages/en/analytics.json';
import enAccounts from '../messages/en/accounts.json';
import enCards from '../messages/en/cards.json';
import enPurchases from '../messages/en/purchases.json';
import enCategories from '../messages/en/categories.json';
import enReceipts from '../messages/en/receipts.json';
import enInvestments from '../messages/en/investments.json';
import enInstallments from '../messages/en/installments.json';
import enConsortiums from '../messages/en/consortiums.json';
import enSavings from '../messages/en/savings.json';
import enRecurring from '../messages/en/recurring.json';
import enNotifications from '../messages/en/notifications.json';
import enAdvisor from '../messages/en/advisor.json';

import { type CanonicalLocale, normalizeLocale } from './config';

export const MESSAGES_BY_LOCALE = {
  pt: {
    ...ptCommon,
    shell: ptShell,
    shared: ptShared,
    dashboard: ptDashboard,
    goals: ptGoals,
    analytics: ptAnalytics,
    accounts: ptAccounts,
    cards: ptCards,
    purchases: ptPurchases,
    categories: ptCategories,
    receipts: ptReceipts,
    investments: ptInvestments,
    installments: ptInstallments,
    consortiums: ptConsortiums,
    savings: ptSavings,
    recurring: ptRecurring,
    notifications: ptNotifications,
    advisor: ptAdvisor,
  },
  es: {
    ...esCommon,
    shell: esShell,
    shared: esShared,
    dashboard: esDashboard,
    goals: esGoals,
    analytics: esAnalytics,
    accounts: esAccounts,
    cards: esCards,
    purchases: esPurchases,
    categories: esCategories,
    receipts: esReceipts,
    investments: esInvestments,
    installments: esInstallments,
    consortiums: esConsortiums,
    savings: esSavings,
    recurring: esRecurring,
    notifications: esNotifications,
    advisor: esAdvisor,
  },
  en: {
    ...enCommon,
    shell: enShell,
    shared: enShared,
    dashboard: enDashboard,
    goals: enGoals,
    analytics: enAnalytics,
    accounts: enAccounts,
    cards: enCards,
    purchases: enPurchases,
    categories: enCategories,
    receipts: enReceipts,
    investments: enInvestments,
    installments: enInstallments,
    consortiums: enConsortiums,
    savings: enSavings,
    recurring: enRecurring,
    notifications: enNotifications,
    advisor: enAdvisor,
  },
} as const;

export type LocaleMessages = (typeof MESSAGES_BY_LOCALE)[CanonicalLocale];

/** Returns the static message bundle for any canonical or regional locale input. */
export function getMessagesForLocale(locale?: string | null): LocaleMessages {
  return MESSAGES_BY_LOCALE[normalizeLocale(locale)];
}
