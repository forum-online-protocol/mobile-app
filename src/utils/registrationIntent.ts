import { ethers } from "ethers";

export interface RegistrationIntent {
  nickname: string;
  passportHash: string;
  passportCountry: string;
  userAddress: string;
}

export function getPassportField(passportData: any, field: string): string {
  return (
    passportData?.personalData?.[field] ??
    passportData?.[field] ??
    ""
  )
    .toString()
    .trim();
}

export function resolvePassportCountry(passportData: any): string {
  const raw =
    passportData?.personalData?.nationality ||
    passportData?.personalData?.issuingCountry ||
    passportData?.personalData?.issuingState ||
    passportData?.nationality ||
    passportData?.issuingCountry ||
    passportData?.issuingState ||
    "";

  return raw.toString().trim().toUpperCase().slice(0, 3);
}

export function buildDefaultNickname(
  passportData: any,
  walletAddress: string,
): string {
  const firstName = getPassportField(passportData, "firstName").toLowerCase();
  const lastName = getPassportField(passportData, "lastName").toLowerCase();
  const base = `${firstName}_${lastName}`
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const shortAddress = walletAddress.slice(2, 8).toLowerCase();

  if (!base) {
    return `user_${shortAddress}`;
  }

  return `${base}_${shortAddress}`;
}

export function buildRegistrationIntent(
  passportData: any,
  nickname: string | undefined,
  walletAddress: string,
): RegistrationIntent {
  const normalizedAddress = String(walletAddress || "").trim().toLowerCase();
  const passportCountry = resolvePassportCountry(passportData);
  const documentNumber = getPassportField(passportData, "documentNumber")
    .toUpperCase()
    .trim();
  const dateOfBirth = getPassportField(passportData, "dateOfBirth");
  const dateOfExpiry = getPassportField(passportData, "dateOfExpiry");
  const resolvedNickname =
    String(nickname || "").trim() ||
    buildDefaultNickname(passportData, normalizedAddress);

  if (!normalizedAddress) {
    throw new Error("Wallet address is required for registration");
  }
  if (!resolvedNickname) {
    throw new Error("Nickname is required for registration");
  }
  if (!documentNumber || !dateOfBirth || !dateOfExpiry || !passportCountry) {
    throw new Error("Passport data is incomplete for on-chain registration");
  }

  const normalizedPassportPayload = [
    documentNumber,
    dateOfBirth,
    dateOfExpiry,
    passportCountry,
  ].join("|");

  return {
    nickname: resolvedNickname,
    passportHash: ethers.keccak256(
      ethers.toUtf8Bytes(normalizedPassportPayload),
    ),
    passportCountry,
    userAddress: normalizedAddress,
  };
}
