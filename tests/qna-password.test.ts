import { describe, expect, it } from "vitest";
import { hashQnaPassword, verifyQnaPassword } from "../lib/qna-password";

describe("Q&A password hashing", () => {
  it("stores a salted scrypt hash and verifies the original password", async () => {
    const password = "우리집-문의-4821";
    const first = await hashQnaPassword(password);
    const second = await hashQnaPassword(password);

    expect(first).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(first).not.toContain(password);
    expect(first).not.toBe(second);
    await expect(verifyQnaPassword(password, first)).resolves.toBe(true);
    await expect(verifyQnaPassword("틀린-비밀번호", first)).resolves.toBe(false);
  });

  it("rejects malformed or tampered hashes without throwing", async () => {
    const hash = await hashQnaPassword("safe-password");
    const tampered = `${hash.slice(0, -1)}${hash.endsWith("A") ? "B" : "A"}`;

    await expect(verifyQnaPassword("safe-password", "not-a-hash")).resolves.toBe(false);
    await expect(verifyQnaPassword("safe-password", tampered)).resolves.toBe(false);
    await expect(
      verifyQnaPassword("safe-password", hash.replace("16384", "1048576")),
    ).resolves.toBe(false);
  });
});
