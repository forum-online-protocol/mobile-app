import { MerkleTree } from 'merkletreejs';
import { ethers } from 'ethers';

export interface EligibilityProof {
  proof: string[];
  leaf: string;
  root: string;
  combination: string;
}

export interface MerkleTreeResult {
  tree: MerkleTree;
  root: string;
  combinations: string[];
}

export class MerkleEligibilityService {
  
  // Generate all valid (age, country) combinations
  generateEligibleCombinations(
    minAgeRange: number, 
    allowedCountries: string[]
  ): string[] {
    const combinations: string[] = [];
    
    // If no country restrictions (empty array or contains "ANY"), use 'ANY' for all age ranges
    if (allowedCountries.length === 0 || allowedCountries.includes('ANY')) {
      for (let ageRange = minAgeRange; ageRange <= 3; ageRange++) {
        combinations.push(`${ageRange}_ANY`);
      }
    } else {
      // For each age range >= minimum (age ranges: 1=18-20, 2=21-35, 3=36+)
      for (let ageRange = minAgeRange; ageRange <= 3; ageRange++) {
        // For each allowed country
        for (const country of allowedCountries) {
          combinations.push(`${ageRange}_${country}`);
        }
      }
    }
    
    return combinations;
  }
  
  // Create Merkle tree for eligible combinations
  createEligibilityTree(
    minAgeRange: number, 
    allowedCountries: string[]
  ): MerkleTreeResult {
    const combinations = this.generateEligibleCombinations(minAgeRange, allowedCountries);
    
    // Hash each combination
    const leaves = combinations.map(combo => 
      ethers.keccak256(ethers.toUtf8Bytes(combo))
    );
    
    // Create Merkle tree
    const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    
    return { tree, root, combinations };
  }
  
  // Generate proof for user's (age, country) combination
  generateEligibilityProof(
    minAgeRange: number,
    allowedCountries: string[], 
    userAgeRange: number,
    userCountry: string
  ): EligibilityProof {
    const { tree, root } = this.createEligibilityTree(minAgeRange, allowedCountries);
    
    // Use 'ANY' for country if no country restrictions (empty array or contains "ANY")
    const country = (allowedCountries.length === 0 || allowedCountries.includes('ANY')) ? 'ANY' : userCountry;
    const userCombination = `${userAgeRange}_${country}`;
    const leaf = ethers.keccak256(ethers.toUtf8Bytes(userCombination));
    const proof = tree.getHexProof(leaf);
    
    return {
      proof,
      leaf,
      root,
      combination: userCombination
    };
  }
  
  // Verify Merkle proof
  verifyEligibilityProof(proof: string[], leaf: string, root: string): boolean {
    return MerkleTree.verify(proof, leaf, root, ethers.keccak256, { sortPairs: true });
  }

  // Utility: Get age range from birth date
  getAgeRange(birthDate: string): number {
    console.log('[MerkleEligibility] Getting age range for birthDate:', birthDate);
    
    if (!birthDate) {
      throw new Error('Birth date is required');
    }
    
    // Parse passport date format (YYMMDD)
    const birth = this.parsePassportDate(birthDate);
    console.log('[MerkleEligibility] Parsed birth date:', birth);
    
    if (isNaN(birth.getTime())) {
      throw new Error(`Invalid birth date format: ${birthDate}`);
    }
    
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    
    // Adjust age if birthday hasn't occurred this year
    const birthMonth = birth.getMonth();
    const birthDay = birth.getDate();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    
    if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
      age--;
    }
    
    console.log('[MerkleEligibility] Calculated age:', age);
    
    if (age >= 18 && age <= 20) return 1;
    if (age >= 21 && age <= 35) return 2;
    if (age >= 36) return 3;
    
    throw new Error('User is under 18 and not eligible to vote');
  }

  // Utility: Check if user meets eligibility requirements
  isEligibleCombination(
    userAgeRange: number,
    userCountry: string,
    minAgeRange: number,
    allowedCountries: string[]
  ): boolean {
    // If no country restrictions (empty array or contains "ANY"), only check age
    if (allowedCountries.length === 0 || allowedCountries.includes('ANY')) {
      return userAgeRange >= minAgeRange;
    }
    // Otherwise check both age and country
    return userAgeRange >= minAgeRange && allowedCountries.includes(userCountry);
  }

  // Utility: Parse passport date format (YYMMDD) to Date object
  private parsePassportDate(passportDate: string): Date {
    // Passport dates are in YYMMDD format (e.g., "920503" = May 3, 1992)
    if (passportDate.length !== 6) {
      throw new Error(`Invalid passport date length: ${passportDate}`);
    }
    
    const yy = parseInt(passportDate.substring(0, 2), 10);
    const mm = parseInt(passportDate.substring(2, 4), 10);
    const dd = parseInt(passportDate.substring(4, 6), 10);
    
    // Handle 2-digit year conversion
    // Years 00-30 are assumed to be 2000-2030
    // Years 31-99 are assumed to be 1931-1999
    const year = yy <= 30 ? 2000 + yy : 1900 + yy;
    
    console.log('[MerkleEligibility] Parsed passport date components:', { yy, mm, dd, year });
    
    // Create date (month is 0-indexed in JavaScript Date)
    return new Date(year, mm - 1, dd);
  }

  // Debug helper: List all eligible combinations for a proposal
  debugEligibleCombinations(minAgeRange: number, allowedCountries: string[]): void {
    const combinations = this.generateEligibleCombinations(minAgeRange, allowedCountries);
    console.log('[MerkleEligibility] Eligible combinations:', combinations);
    
    const { root } = this.createEligibilityTree(minAgeRange, allowedCountries);
    console.log('[MerkleEligibility] Merkle root:', root);
  }
}

export default MerkleEligibilityService;