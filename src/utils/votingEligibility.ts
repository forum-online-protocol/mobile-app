import { PassportData, VoteRestrictions } from '../types';
import i18n from '../localization/i18n';

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  details?: string;
}

/**
 * Calculate age from date of birth string (YYMMDD or YYYYMMDD format)
 */
function calculateAge(dateOfBirth: string): number {
  // Parse date of birth (YYMMDD format)
  let year = parseInt(dateOfBirth.substring(0, 2));
  const month = parseInt(dateOfBirth.substring(2, 4));
  const day = parseInt(dateOfBirth.substring(4, 6));
  
  // Assume 1900s for years > 50, 2000s for years <= 50
  if (year > 50) {
    year += 1900;
  } else {
    year += 2000;
  }
  
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Check if a user is eligible to vote based on restrictions
 */
export function checkVotingEligibility(
  passportData: PassportData | null,
  restrictions?: VoteRestrictions
): EligibilityResult {
  // No restrictions means everyone can vote
  if (!restrictions) {
    return { eligible: true };
  }

  // Check verification requirement
  if (restrictions.verificationLevel === 'passport' && !passportData) {
    return {
      eligible: false,
      reason: 'Passport verification required',
      details: 'This vote requires passport verification. Please verify your identity first.',
    };
  }

  if (!passportData) {
    return {
      eligible: false,
      reason: 'Identity verification required',
      details: 'Please verify your identity to participate in this vote.',
    };
  }

  // Check age restrictions
  if (restrictions.minAge || restrictions.maxAge) {
    const age = calculateAge(passportData.dateOfBirth);
    console.log('[VotingEligibility] User age:', age);

    if (restrictions.minAge && age < restrictions.minAge) {
      return {
        eligible: false,
        reason: 'Age requirement not met',
        details: `You must be at least ${restrictions.minAge} years old to vote. Current age: ${age}`,
      };
    }

    if (restrictions.maxAge && age > restrictions.maxAge) {
      return {
        eligible: false,
        reason: 'Age limit exceeded',
        details: `Maximum age for this vote is ${restrictions.maxAge} years. Current age: ${age}`,
      };
    }
  }

  // Check nationality restrictions
  const userNationality = passportData.nationality || passportData.issuingCountry;
  console.log('[VotingEligibility] User nationality:', userNationality);

  if (restrictions.allowedNationalities && restrictions.allowedNationalities.length > 0) {
    if (!restrictions.allowedNationalities.includes(userNationality)) {
      return {
        eligible: false,
        reason: 'Nationality not eligible',
        details: `This vote is only open to citizens of: ${restrictions.allowedNationalities.join(', ')}. Your nationality: ${userNationality}`,
      };
    }
  }

  if (restrictions.excludedNationalities && restrictions.excludedNationalities.length > 0) {
    if (restrictions.excludedNationalities.includes(userNationality)) {
      return {
        eligible: false,
        reason: 'Nationality excluded',
        details: `Citizens of ${userNationality} are not eligible for this vote.`,
      };
    }
  }

  // All checks passed
  return { eligible: true };
}

/**
 * Format Merkle-based restrictions for display
 */
export function formatMerkleRestrictions(minAgeRange?: number, allowedCountries?: string[]): string {
  const t = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options));
  const parts: string[] = [];

  // Format age range
  if (minAgeRange) {
    switch (minAgeRange) {
      case 1:
        parts.push(t('restrictions.agePlus', { age: 18 }));
        break;
      case 2:
        parts.push(t('restrictions.agePlus', { age: 21 }));
        break;
      case 3:
        parts.push(t('restrictions.agePlus', { age: 36 }));
        break;
      default:
        parts.push(t('restrictions.ageRestrictionsApply'));
    }
  }

  // Format allowed countries
  if (allowedCountries) {
    if (allowedCountries.length === 0 || allowedCountries.includes('ANY')) {
      // Empty array or contains "ANY" means no country restrictions
      parts.push(t('restrictions.allCountriesEligible'));
    } else if (allowedCountries.length <= 3) {
      parts.push(t('restrictions.citizensOnly', { countries: allowedCountries.join('/') }));
    } else {
      parts.push(t('restrictions.countriesEligible', { count: allowedCountries.length }));
    }
  }

  return parts.join(' • ') || t('restrictions.verificationRequired');
}

/**
 * Format restrictions for display (legacy)
 */
export function formatRestrictions(restrictions: VoteRestrictions): string {
  const t = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options));
  const parts: string[] = [];

  if (restrictions.minAge) {
    parts.push(t('restrictions.agePlus', { age: restrictions.minAge }));
  }

  if (restrictions.maxAge) {
    parts.push(t('restrictions.ageUnder', { age: restrictions.maxAge }));
  }

  if (restrictions.allowedNationalities && restrictions.allowedNationalities.length > 0) {
    if (restrictions.allowedNationalities.length <= 3) {
      parts.push(
        t('restrictions.citizensOnly', { countries: restrictions.allowedNationalities.join('/') })
      );
    } else {
      parts.push(
        t('restrictions.countriesEligible', { count: restrictions.allowedNationalities.length })
      );
    }
  }

  if (restrictions.excludedNationalities && restrictions.excludedNationalities.length > 0) {
    parts.push(
      t('restrictions.excludes', { countries: restrictions.excludedNationalities.join(', ') })
    );
  }

  if (restrictions.verificationLevel === 'passport') {
    parts.push(t('restrictions.passportRequired'));
  }

  return parts.length > 0 ? parts.join(' • ') : t('restrictions.openToAll');
}
