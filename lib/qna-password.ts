import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const ALGORITHM = "scrypt";
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(
  password: string,
  salt: Buffer,
  cost = COST,
  blockSize = BLOCK_SIZE,
  parallelization = PARALLELIZATION,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: cost, r: blockSize, p: parallelization, maxmem: MAX_MEMORY },
      (error, key) => error ? reject(error) : resolve(key),
    );
  });
}

export async function hashQnaPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyQnaPassword(password: string, encodedHash: string) {
  try {
    const [algorithm, costText, blockSizeText, parallelizationText, saltText, keyText, extra] =
      encodedHash.split("$");
    if (algorithm !== ALGORITHM || !saltText || !keyText || extra !== undefined) return false;

    const cost = Number(costText);
    const blockSize = Number(blockSizeText);
    const parallelization = Number(parallelizationText);
    if (
      cost !== COST ||
      blockSize !== BLOCK_SIZE ||
      parallelization !== PARALLELIZATION
    ) return false;

    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    if (
      salt.length !== 16 || expected.length !== KEY_LENGTH ||
      salt.toString("base64url") !== saltText ||
      expected.toString("base64url") !== keyText
    ) return false;

    const actual = await deriveKey(password, salt, cost, blockSize, parallelization);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
