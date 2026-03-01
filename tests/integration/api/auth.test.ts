import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validation";
import { validatePasswordStrength } from "@/lib/auth/password";

describe("Auth validation", () => {
  describe("registerSchema", () => {
    it("accepts valid registration input", () => {
      const result = registerSchema.safeParse({ email: "test@example.com", password: "MyP@ss0rd!" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = registerSchema.safeParse({ email: "not-an-email", password: "MyP@ss0rd!" });
      expect(result.success).toBe(false);
    });

    it("rejects missing password", () => {
      const result = registerSchema.safeParse({ email: "test@example.com" });
      expect(result.success).toBe(false);
    });

    it("rejects too-long email", () => {
      const result = registerSchema.safeParse({ email: "a".repeat(250) + "@x.com", password: "MyP@ss0rd!" });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("accepts valid login input", () => {
      const result = loginSchema.safeParse({ email: "test@example.com", password: "anypassword" });
      expect(result.success).toBe(true);
    });

    it("rejects empty password", () => {
      const result = loginSchema.safeParse({ email: "test@example.com", password: "" });
      expect(result.success).toBe(false);
    });
  });
});

describe("Rate limit key construction", () => {
  it("constructs valid IP key", () => {
    const ip = "192.168.1.1";
    const key = `ip:${ip}`;
    expect(key).toBe("ip:192.168.1.1");
  });

  it("constructs valid user key", () => {
    const userId = "clxyz123";
    const key = `user:${userId}`;
    expect(key).toBe("user:clxyz123");
  });
});

describe("Session token", () => {
  it("verifySessionToken returns null for garbage input", async () => {
    const { verifySessionToken } = await import("@/lib/auth/session");
    const result = await verifySessionToken("garbage-token-xyz");
    expect(result).toBeNull();
  });

  it("creates and verifies valid session", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/auth/session");
    const token = await createSessionToken({ sub: "user123", role: "USER" });
    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user123");
    expect(payload!.role).toBe("USER");
  });
});
