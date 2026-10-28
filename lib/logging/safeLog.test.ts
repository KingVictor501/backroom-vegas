/*
  FILE: lib/logging/safeLog.test.ts
  WHAT IT'S FOR: Automatic checks for lib/logging/safeLog.ts. They prove that a
  database connection string or a login token inside an error never makes it
  into the log text.
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: Vitest runs every file ending in ".test.ts". It sits next to
  the file it checks, like the other tests in this project.
*/

import { describe, expect, it } from "vitest";
import { safeErrorText } from "./safeLog";

describe("safeErrorText", () => {
  it("keeps the error name and message", () => {
    expect(safeErrorText(new TypeError("bad thing"))).toBe("TypeError: bad thing");
  });

  it("hides a MongoDB connection string, with its password", () => {
    const error = new Error("Could not connect to mongodb+srv://someUser:hunter2@cluster0.example.mongodb.net/test");
    const text = safeErrorText(error);
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("someUser");
    expect(text).toContain("[connection string hidden]");
  });

  it("hides a plain mongodb:// connection string too", () => {
    const text = safeErrorText(new Error("failed: mongodb://admin:secret@localhost:27017"));
    expect(text).not.toContain("secret");
  });

  it("hides a login token (JWT)", () => {
    const text = safeErrorText(new Error("bad token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl"));
    expect(text).not.toContain("eyJhbGci");
    expect(text).toContain("[token hidden]");
  });

  it("does not print the contents of something that isn't an Error", () => {
    expect(safeErrorText({ password: "hunter2" })).not.toContain("hunter2");
    expect(safeErrorText("mongodb+srv://u:p@h")).not.toContain("u:p");
  });

  it("cuts very long messages short", () => {
    expect(safeErrorText(new Error("x".repeat(5000))).length).toBeLessThanOrEqual(500);
  });
});
