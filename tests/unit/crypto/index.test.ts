import { describe, it, expect } from "vitest";
import { encrypt, decrypt, generateToken, hashString } from "@/lib/crypto";

describe("encrypt / decrypt", () => {
  it("encrypts and decrypts correctly", () => {
    const plaintext = "my-secret-api-key-12345";
    const ciphertext = encrypt(plaintext);
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext", () => {
    const plaintext = "same-input";
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
  });

  it("throws on tampered ciphertext", () => {
    const ciphertext = encrypt("test");
    const tampered = ciphertext.slice(0, -4) + "XXXX";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on too-short ciphertext", () => {
    expect(() => decrypt("aGVsbG8=")).toThrow();
  });

  it("handles empty string", () => {
    const ciphertext = encrypt("");
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe("");
  });

  it("handles unicode string", () => {
    const plaintext = "日本語のAPIキー: テスト12345";
    const decrypted = decrypt(encrypt(plaintext));
    expect(decrypted).toBe(plaintext);
  });
});

describe("generateToken", () => {
  it("generates token of expected length", () => {
    const token = generateToken(32);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("generates unique tokens", () => {
    const t1 = generateToken(16);
    const t2 = generateToken(16);
    expect(t1).not.toBe(t2);
  });
});

describe("hashString", () => {
  it("produces consistent hash", () => {
    const h1 = hashString("test");
    const h2 = hashString("test");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("returns 64-character hex string", () => {
    const h = hashString("test");
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
  });
});
