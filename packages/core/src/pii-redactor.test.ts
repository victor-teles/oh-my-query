import { describe, expect, it } from "vitest";

import { PII_PATTERNS, redactPii } from "./pii-redactor.ts";

describe("pII_PATTERNS", () => {
  it("exports all canonical pattern keys", () => {
    expect(Object.keys(PII_PATTERNS).toSorted()).toStrictEqual(
      [
        "api_key",
        "credit_card",
        "email",
        "ipv4",
        "jwt",
        "phone",
        "ssn",
      ].toSorted()
    );
  });
});

describe("redactPii — email", () => {
  it("redacts a plain email address", () => {
    const { text, count } = redactPii("contact john@example.com for help");
    expect(text).toBe("contact [REDACTED] for help");
    expect(count).toBe(1);
  });

  it("redacts multiple emails", () => {
    const { count } = redactPii("a@b.com and c@d.org");
    expect(count).toBe(2);
  });

  it("does not redact a plain column name like user_email", () => {
    const { text, count } = redactPii("column: user_email (varchar)");
    expect(text).toBe("column: user_email (varchar)");
    expect(count).toBe(0);
  });
});

describe("redactPii — phone", () => {
  it("redacts US phone with dashes", () => {
    const { text, count } = redactPii("call 555-123-4567 now");
    expect(text).toBe("call [REDACTED] now");
    expect(count).toBe(1);
  });

  it("redacts phone with parentheses", () => {
    const { count } = redactPii("(555) 123-4567");
    expect(count).toBe(1);
  });
});

describe("redactPii — SSN", () => {
  it("redacts a valid SSN", () => {
    const { text, count } = redactPii("SSN: 123-45-6789");
    expect(text).toBe("SSN: [REDACTED]");
    expect(count).toBe(1);
  });

  it("does not redact an invalid SSN starting with 000", () => {
    const { count } = redactPii("000-45-6789");
    expect(count).toBe(0);
  });
});

describe("redactPii — credit card", () => {
  it("redacts a Visa card number", () => {
    const { count } = redactPii("card: 4111111111111111");
    expect(count).toBe(1);
  });

  it("redacts an Amex number", () => {
    const { count } = redactPii("amex 378282246310005");
    expect(count).toBe(1);
  });

  it("redacts a Visa card with hyphen separators", () => {
    const { text, count } = redactPii("card: 4111-1111-1111-1111");
    expect(text).toBe("card: [REDACTED]");
    expect(count).toBe(1);
  });

  it("redacts a Visa card with space separators", () => {
    const { text, count } = redactPii("card: 4111 1111 1111 1111");
    expect(text).toBe("card: [REDACTED]");
    expect(count).toBe(1);
  });

  it("redacts a MasterCard with hyphen separators", () => {
    const { count } = redactPii("mc 5500-0000-0000-0004");
    expect(count).toBe(1);
  });

  it("redacts an Amex card with hyphen separators (4-6-5)", () => {
    const { count } = redactPii("amex 3782-822463-10005");
    expect(count).toBe(1);
  });
});

describe("redactPii — JWT", () => {
  it("redacts a JWT token", () => {
    const token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const { text, count } = redactPii(`token: ${token}`);
    expect(text).toBe("token: [REDACTED]");
    expect(count).toBe(1);
  });
});

describe("redactPii — API key", () => {
  it("redacts api_key: value pairs", () => {
    const { count } = redactPii("api_key: sk-abcdefghij1234567890ABCDE");
    expect(count).toBe(1);
  });

  it("redacts bearer token assignments", () => {
    const { count } = redactPii(
      "bearer=eyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abc"
    );
    expect(count).toBe(1);
  });
});

describe("redactPii — IPv4", () => {
  it("redacts a valid IPv4 address", () => {
    const { text, count } = redactPii("host 192.168.1.100 is down");
    expect(text).toBe("host [REDACTED] is down");
    expect(count).toBe(1);
  });

  it("does not redact version strings that look like IPs", () => {
    const { count } = redactPii("v1.2.3");
    expect(count).toBe(0);
  });
});

describe("redactPii — custom patterns", () => {
  it("applies a custom pattern", () => {
    const { text, count } = redactPii("internal-ref:CUST-00123", {
      customPatterns: ["CUST-\\d+"],
    });
    expect(text).toBe("internal-ref:[REDACTED]");
    expect(count).toBe(1);
  });

  it("skips comment lines (# prefix)", () => {
    const { count } = redactPii("anything", {
      customPatterns: ["# this is a comment"],
    });
    expect(count).toBe(0);
  });

  it("skips blank lines in custom patterns", () => {
    const { count } = redactPii("anything", {
      customPatterns: ["", "   "],
    });
    expect(count).toBe(0);
  });

  it("silently skips invalid regex", () => {
    expect(() =>
      redactPii("text", { customPatterns: ["[invalid("] })
    ).not.toThrow();
  });
});

describe("redactPii — no PII", () => {
  it("returns original text unchanged when no PII present", () => {
    const input =
      "Table: users\n  id (integer, PK, NOT NULL)\n  name (varchar)";
    const { text, count } = redactPii(input);
    expect(text).toBe(input);
    expect(count).toBe(0);
  });
});

describe("redactPii — multiple types", () => {
  it("redacts multiple PII types in one string", () => {
    const input =
      "email: admin@corp.com, ssn: 234-56-7890, card: 4111111111111111";
    const { count } = redactPii(input);
    expect(count).toBe(3);
  });
});
