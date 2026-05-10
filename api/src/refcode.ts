import { randomInt } from "node:crypto";
import type { PrismaClient } from "./generated/prisma/client.js";

type PrismaTx = Pick<
  PrismaClient,
  "refCodeReservation" | "leafMetadata"
>;


// Lowercase + digits, minus visually ambiguous chars (0/o, 1/l/i).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const REF_CODE_LENGTH = 8;
export const REF_CODE_REGEX = /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/;
const RESERVATION_TTL_MS = 5 * 60 * 1000;
const MAX_GENERATION_ATTEMPTS = 16;

export function generateRefCode(): string {
  let out = "";
  for (let i = 0; i < REF_CODE_LENGTH; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

export class RefCodeExhaustedError extends Error {
  constructor() {
    super(`Could not generate a unique ref_code in ${MAX_GENERATION_ATTEMPTS} tries`);
    this.name = "RefCodeExhaustedError";
  }
}

export class RefCodeNotReservedError extends Error {
  constructor(public refCode: string) {
    super(`ref_code ${refCode} is not reserved or has expired`);
    this.name = "RefCodeNotReservedError";
  }
}

/**
 * Reserve a fresh ref_code for `draftId` (typically the leaf draft id), TTL 5 min.
 * Garbage-collects expired reservations as a side effect, then loops with
 * collision retry against both `ref_code_reservations` and finalized leaves.
 */
export async function reserveRefCode(
  prisma: PrismaTx,
  draftId: string,
): Promise<{ refCode: string; expiresAt: Date }> {
  await prisma.refCodeReservation.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const refCode = generateRefCode();
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

    const collidesWithLeaf = await prisma.leafMetadata.findUnique({
      where: { refCode },
      select: { id: true },
    });
    if (collidesWithLeaf) continue;

    try {
      await prisma.refCodeReservation.create({
        data: {
          refCode,
          campaignId: draftId,
          reservedBy: draftId,
          expiresAt,
        },
      });
      return { refCode, expiresAt };
    } catch {
      // unique violation on refCode PK — try again
      continue;
    }
  }
  throw new RefCodeExhaustedError();
}

/**
 * Atomically consume a reservation: deletes the row if and only if it exists
 * and has not expired. Returns true on success. The caller wraps this and the
 * subsequent leaf insert in a single Prisma transaction so a stolen ref_code
 * cannot be finalized twice.
 */
export async function consumeRefCode(
  prisma: PrismaTx,
  refCode: string,
): Promise<boolean> {
  const result = await prisma.refCodeReservation.deleteMany({
    where: { refCode, expiresAt: { gte: new Date() } },
  });
  return result.count === 1;
}
