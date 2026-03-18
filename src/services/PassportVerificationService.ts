import { ethers } from "ethers";
import {
  MerkleEligibilityService,
  EligibilityProof,
} from "./MerkleEligibilityService";
import { WalletService } from "./WalletService";

export interface PassportData {
  personalData?: {
    firstName: string;
    lastName: string;
    nationality: string;
    issuingState: string;
    dateOfBirth: string;
    dateOfExpiry: string;
    gender: string;
    documentNumber: string;
    documentType: string;
  };
  faceImage?: string;
  faceImageMimeType?: string;
}

export interface ProposalRestrictions {
  minAgeRange: number;
  allowedCountries: string[];
  eligibilityRoot?: string;
}

export interface VerificationProof {
  merkleRoot: string;
  merkleProof: string[];
  merkleLeaf: string;
  nonce: number;
  timestamp: number;
  signature: string;
  ageRange?: number;
  country?: string;
  passportHash?: string;
  ageRangeProof?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  details?: string;
}

// EIP-712 Domain for passport verification
const VERIFICATION_DOMAIN = {
  name: "NFCPassportVerification",
  version: "1",
  chainId: 11155111, // Sepolia
  verifyingContract: "0x0000000000000000000000000000000000000000",
};

const parseBooleanEnv = (
  value: string | undefined,
  fallback: boolean,
): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const PASSPORT_BOUND_PROOF_ENABLED = (() => {
  const envValue =
    process.env.EXPO_PUBLIC_PASSPORT_BOUND_PROOF ||
    process.env.REACT_APP_PASSPORT_BOUND_PROOF;
  // Server requires passport-bound proof by default in production; keep client aligned.
  return parseBooleanEnv(envValue, true);
})();

export class PassportVerificationService {
  private merkleService: MerkleEligibilityService;

  constructor() {
    this.merkleService = new MerkleEligibilityService();
  }

  private resolvePassportCountry(passportData: PassportData): string {
    const raw =
      passportData.personalData?.nationality ||
      (passportData.personalData as any)?.issuingCountry ||
      passportData.personalData?.issuingState ||
      (passportData as any)?.nationality ||
      (passportData as any)?.issuingCountry ||
      (passportData as any)?.issuingState ||
      "";
    return raw.toString().trim().toUpperCase().slice(0, 3);
  }

  private computePassportHash(passportData: PassportData): string {
    const documentNumber = (passportData.personalData?.documentNumber || "")
      .toString()
      .trim()
      .toUpperCase();
    const dateOfBirth = (passportData.personalData?.dateOfBirth || "")
      .toString()
      .trim();
    const dateOfExpiry = (passportData.personalData?.dateOfExpiry || "")
      .toString()
      .trim();
    // Must exactly match AuthService registration hash computation.
    const country = this.resolvePassportCountry(passportData);

    const normalizedPassportPayload = [
      documentNumber,
      dateOfBirth,
      dateOfExpiry,
      country,
    ].join("|");

    return ethers.keccak256(ethers.toUtf8Bytes(normalizedPassportPayload));
  }

  // Check if user meets basic eligibility requirements
  checkEligibility(
    passportData: PassportData,
    proposalRestrictions: ProposalRestrictions,
  ): EligibilityResult {
    console.log(
      "[PassportVerification] Checking eligibility for:",
      JSON.stringify(passportData, null, 2),
    );

    if (!passportData.personalData) {
      return {
        eligible: false,
        reason: "No passport data available",
        details: "Please scan your passport first",
      };
    }

    const { dateOfBirth } = passportData.personalData;
    const userCountry = this.resolvePassportCountry(passportData);
    console.log(
      "[PassportVerification] Using dateOfBirth:",
      dateOfBirth,
      "country:",
      userCountry,
    );

    try {
      // Get user's age range
      const userAgeRange = this.merkleService.getAgeRange(dateOfBirth);
      console.log("[PassportVerification] Calculated age range:", userAgeRange);

      // Check minimum age requirement
      if (userAgeRange < proposalRestrictions.minAgeRange) {
        return {
          eligible: false,
          reason: "Age requirement not met",
          details: `This initiative requires age range ${proposalRestrictions.minAgeRange} or higher`,
        };
      }

      // Check country eligibility - empty array or ["ANY"] means no country restrictions
      const normalizedAllowedCountries = Array.isArray(
        proposalRestrictions.allowedCountries,
      )
        ? proposalRestrictions.allowedCountries
            .map((country) =>
              String(country || "")
                .trim()
                .toUpperCase(),
            )
            .filter((country) => country.length > 0)
        : [];
      const hasCountryRestrictions =
        normalizedAllowedCountries.length > 0 &&
        !normalizedAllowedCountries.includes("ANY");

      if (
        hasCountryRestrictions &&
        !normalizedAllowedCountries.includes(userCountry)
      ) {
        return {
          eligible: false,
          reason: "Country not eligible",
          details: `This initiative is restricted to: ${normalizedAllowedCountries.join(", ")}`,
        };
      }

      return {
        eligible: true,
      };
    } catch (error: any) {
      console.error(
        "[PassportVerification] Error during eligibility check:",
        error,
      );
      return {
        eligible: false,
        reason: "Invalid passport data",
        details: error.message,
      };
    }
  }

  // Generate Merkle proof for passport verification
  async generateVerificationProof(
    passportData: PassportData,
    proposalRestrictions: ProposalRestrictions,
    walletData: any, // Accept wallet data from Redux state
    apiNonce?: string, // Optional nonce from API
    postId?: string, // Post ID for EIP-712 signing
    voteOption?: string, // Vote option for EIP-712 signing
  ): Promise<VerificationProof> {
    // Check eligibility first
    const eligibilityCheck = this.checkEligibility(
      passportData,
      proposalRestrictions,
    );
    if (!eligibilityCheck.eligible) {
      throw new Error(eligibilityCheck.reason || "Not eligible to vote");
    }

    if (!passportData.personalData) {
      throw new Error("Passport data is required");
    }

    const { dateOfBirth } = passportData.personalData;

    // Get user's age range and country
    const userAgeRange = this.merkleService.getAgeRange(dateOfBirth);
    // Must match registration country normalization so on-chain comparisons pass.
    const userCountry = this.resolvePassportCountry(passportData);
    const passportHash = this.computePassportHash(passportData);

    // Legacy mode: proposal-bound tree (client-trust heavy).
    // Passport-bound mode: exact one-leaf tree bound to issuer-attested (ageRange,country).
    const eligibilityProof: EligibilityProof = PASSPORT_BOUND_PROOF_ENABLED
      ? this.merkleService.generatePassportBoundProof(userAgeRange, userCountry)
      : this.merkleService.generateEligibilityProof(
          proposalRestrictions.minAgeRange,
          proposalRestrictions.allowedCountries,
          userAgeRange,
          userCountry,
        );

    // Create verification data for EIP-712 signing - use current time exactly
    const timestamp = Math.floor(Date.now() / 1000);

    // Use API nonce if provided, otherwise generate random string nonce
    const nonce = apiNonce || Math.floor(Math.random() * 1000000).toString();

    console.log("[PassportVerification] Proof generation:", {
      timestamp,
      nonce,
      nonceType: typeof nonce,
      readable: new Date(timestamp * 1000).toISOString(),
    });

    const baseVerificationData = {
      merkleRoot: eligibilityProof.root,
      merkleProof: eligibilityProof.proof,
      merkleLeaf: eligibilityProof.leaf,
      postId: postId || "",
      voteOption: voteOption || "",
      nonce,
      timestamp,
    };

    const verificationData = PASSPORT_BOUND_PROOF_ENABLED
      ? {
          ...baseVerificationData,
          ageRange: userAgeRange,
          country: userCountry,
          passportHash,
          ...(typeof walletData?.ageRangeProof === "string" &&
          walletData.ageRangeProof
            ? { ageRangeProof: walletData.ageRangeProof }
            : {}),
        }
      : baseVerificationData;

    // Define EIP-712 types for passport verification (must match server exactly)
    const types = PASSPORT_BOUND_PROOF_ENABLED
      ? {
          PassportVerificationBound: [
            { name: "merkleRoot", type: "bytes32" },
            { name: "merkleProof", type: "bytes32[]" },
            { name: "merkleLeaf", type: "bytes32" },
            { name: "postId", type: "string" },
            { name: "voteOption", type: "string" },
            { name: "nonce", type: "string" },
            { name: "timestamp", type: "uint256" },
            { name: "ageRange", type: "uint8" },
            { name: "country", type: "string" },
            { name: "passportHash", type: "bytes32" },
          ],
        }
      : {
          PassportVerification: [
            { name: "merkleRoot", type: "bytes32" },
            { name: "merkleProof", type: "bytes32[]" },
            { name: "merkleLeaf", type: "bytes32" },
            { name: "postId", type: "string" },
            { name: "voteOption", type: "string" },
            { name: "nonce", type: "string" },
            { name: "timestamp", type: "uint256" },
          ],
        };

    // Sign the verification data using WalletService
    console.log(
      "[PassportVerification] 🔐 EIP-712 SIGNING for post_commandment_1:",
    );
    console.log(
      "[PassportVerification] Domain:",
      JSON.stringify(VERIFICATION_DOMAIN, null, 2),
    );
    console.log(
      "[PassportVerification] Types:",
      JSON.stringify(types, null, 2),
    );
    console.log(
      "[PassportVerification] Verification data:",
      JSON.stringify(verificationData, null, 2),
    );

    // Get WalletService instance for signing
    const walletService = WalletService.getInstance();

    // Check signer consistency
    const ethersWallet = await walletService.getEthersWallet();
    console.log(
      "[PassportVerification] 🔍 SIGNER ADDRESS:",
      ethersWallet ? ethersWallet.address : "null",
    );

    // Use WalletService's signTypedData method directly
    const signature = await walletService.signTypedData(
      VERIFICATION_DOMAIN,
      types,
      verificationData,
    );

    console.log(
      "[PassportVerification] ✅ EIP-712 signature generated:",
      signature,
    );
    console.log("[PassportVerification] Signature length:", signature.length);

    return {
      ...verificationData,
      signature,
    };
  }

  // Verify a Merkle proof (client-side verification)
  verifyProof(proof: string[], leaf: string, root: string): boolean {
    return this.merkleService.verifyEligibilityProof(proof, leaf, root);
  }

  // Get debug information about eligible combinations
  debugProposalEligibility(proposalRestrictions: ProposalRestrictions): void {
    console.log(
      "[PassportVerification] Proposal restrictions:",
      proposalRestrictions,
    );
    this.merkleService.debugEligibleCombinations(
      proposalRestrictions.minAgeRange,
      proposalRestrictions.allowedCountries,
    );
  }

  // Utility: Convert country code from passport format to proposal format
  normalizeCountryCode(passportCountryCode: string): string {
    // Handle common variations in passport country codes
    const countryMappings: { [key: string]: string } = {
      RU: "RUS",
      UA: "UKR",
      KZ: "KAZ",
      BY: "BLR",
      US: "USA",
      GB: "GBR",
      DE: "DEU",
      FR: "FRA",
      // Add more mappings as needed
    };

    return countryMappings[passportCountryCode] || passportCountryCode;
  }

  // Utility: Get human-readable age range description
  getAgeRangeDescription(ageRange: number): string {
    switch (ageRange) {
      case 1:
        return "18-20 years";
      case 2:
        return "21-35 years";
      case 3:
        return "36+ years";
      default:
        return "Unknown age range";
    }
  }
}

export default new PassportVerificationService();
