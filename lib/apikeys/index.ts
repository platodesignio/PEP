import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";

export async function getDecryptedApiKey(userId: string, provider: string): Promise<string | null> {
  const key = await prisma.apiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!key) return null;
  try {
    return decrypt(key.encryptedKey);
  } catch {
    return null;
  }
}
