interface ParsedPasswordHash {
  algorithm: "pbkdf2_sha256";
  iterations: number;
  salt: Uint8Array;
  expected: Uint8Array;
}

// Cloudflare Workers currently rejects PBKDF2 iteration counts above 100000.
const PASSWORD_HASH_ITERATIONS = 100000;
const PASSWORD_HASH_BYTES = 32;

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64(input: Uint8Array): string {
  let output = "";
  for (const value of input) {
    output += String.fromCharCode(value);
  }
  return btoa(output);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }

  return result === 0;
}

function parsePasswordHash(serialized: string): ParsedPasswordHash | null {
  const [algorithm, iterationsRaw, saltRaw, expectedRaw] = serialized.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsRaw || !saltRaw || !expectedRaw) {
    return null;
  }

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return null;
  }

  return {
    algorithm,
    iterations,
    salt: decodeBase64(saltRaw),
    expected: decodeBase64(expectedRaw)
  };
}

export async function verifyPassword(password: string, serializedHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(serializedHash);
  if (!parsed) {
    return false;
  }

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: asArrayBuffer(parsed.salt),
      iterations: parsed.iterations
    },
    baseKey,
    parsed.expected.length * 8
  );

  return timingSafeEqual(new Uint8Array(derivedBits), parsed.expected);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: asArrayBuffer(salt),
      iterations: PASSWORD_HASH_ITERATIONS
    },
    baseKey,
    PASSWORD_HASH_BYTES * 8
  );

  return [
    "pbkdf2_sha256",
    PASSWORD_HASH_ITERATIONS,
    encodeBase64(salt),
    encodeBase64(new Uint8Array(derivedBits))
  ].join("$");
}
