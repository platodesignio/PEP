import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/auth/password";

describe("hashPassword / verifyPassword", () => {
  it("hashes and verifies correctly", async () => {
    const hash = await hashPassword("Test@12345Abc");
    const ok = await verifyPassword("Test@12345Abc", hash);
    expect(ok).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("Test@12345Abc");
    const ok = await verifyPassword("WrongPassword!", hash);
    expect(ok).toBe(false);
  });

  it("produces different hashes for same password", async () => {
    const h1 = await hashPassword("Test@12345Abc");
    const h2 = await hashPassword("Test@12345Abc");
    expect(h1).not.toBe(h2);
  });
});

describe("validatePasswordStrength", () => {
  it("accepts strong password", () => {
    const result = validatePasswordStrength("MyP@ssw0rd!");
    expect(result.valid).toBe(true);
  });

  it("rejects too short password", () => {
    const result = validatePasswordStrength("Short1!");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("rejects password without uppercase", () => {
    const result = validatePasswordStrength("mypassword1@");
    expect(result.valid).toBe(false);
  });

  it("rejects password without lowercase", () => {
    const result = validatePasswordStrength("MYPASSWORD1@");
    expect(result.valid).toBe(false);
  });

  it("rejects password without number", () => {
    const result = validatePasswordStrength("MyPassword@!");
    expect(result.valid).toBe(false);
  });

  it("rejects password without special character", () => {
    const result = validatePasswordStrength("MyPassword123");
    expect(result.valid).toBe(false);
  });
});
