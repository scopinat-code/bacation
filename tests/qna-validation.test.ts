import { describe, expect, it } from "vitest";
import {
  categoryFromDb,
  categoryToDb,
  parseCreateQnaInput,
  parsePasswordBody,
  QnaRequestError,
} from "../lib/qna-types";

const validInput = {
  category: "complaint",
  visibility: "private",
  nickname: "여름맘",
  title: "일정 블록이 움직이지 않아요",
  content: "휴대전화에서 일정 블록을 옮기기 어려워요.",
  password: "1234",
  website: "",
  startedAt: Date.now() - 5_000,
};

describe("Q&A input validation", () => {
  it("normalizes a valid plain-text submission and maps complaints to bug rows", () => {
    const parsed = parseCreateQnaInput(validInput);
    expect(parsed.category).toBe("complaint");
    expect(categoryToDb(parsed.category)).toBe("bug");
    expect(categoryFromDb("bug")).toBe("complaint");
  });

  it("rejects HTML and out-of-bounds passwords", () => {
    expect(() => parseCreateQnaInput({
      ...validInput,
      content: "<script>alert('x')</script>",
    })).toThrow(QnaRequestError);
    expect(() => parsePasswordBody({ password: "123" })).toThrow(
      "글 비밀번호는 4자 이상 100자 이하로 입력해 주세요.",
    );
  });

  it("does not trim or transform the author's password", () => {
    expect(parsePasswordBody({ password: " 1234 " })).toBe(" 1234 ");
  });
});
