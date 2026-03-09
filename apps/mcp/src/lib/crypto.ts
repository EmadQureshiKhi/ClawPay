/**
 * Simple AES-256-GCM encryption for storing Hedera private keys.
 * Derives a 256-bit key from BETTER_AUTH_SECRET using SHA-256.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET || "fallback-dev-secret";
  return createHash("sha256").update(secret).digest();
}

export function encryptKey(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return { encrypted, iv: iv.toString("hex"), tag };
}

export function decryptKey(encrypted: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
