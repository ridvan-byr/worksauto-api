import { SetMetadata } from '@nestjs/common';

export const BYPASS_B2B_CONSENT_KEY = 'bypassB2bConsent';
/**
 * Route decorator to exempt an endpoint from the strict B2B legal consent gatekeeper.
 * Used for endpoints that must be accessed before signing the contract (e.g., getting contract text, signing contract, logging out).
 */
export const BypassB2bConsent = () => SetMetadata(BYPASS_B2B_CONSENT_KEY, true);
