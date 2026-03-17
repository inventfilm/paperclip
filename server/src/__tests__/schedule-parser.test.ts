import { describe, expect, it } from "vitest";
import {
  parseScheduleToCron,
  describeCron,
  validateCronExpression,
  isCronDue,
  formatRecurrenceDateSuffix,
} from "@paperclipai/shared";

describe("parseScheduleToCron", () => {
  it("parses 'every day at 9am'", () => {
    expect(parseScheduleToCron("every day at 9am")).toBe("0 9 * * *");
  });

  it("parses 'daily at 9:30am'", () => {
    expect(parseScheduleToCron("daily at 9:30am")).toBe("30 9 * * *");
  });

  it("parses 'daily' (defaults to 9am)", () => {
    expect(parseScheduleToCron("daily")).toBe("0 9 * * *");
  });

  it("parses 'every weekday at 9am'", () => {
    expect(parseScheduleToCron("every weekday at 9am")).toBe("0 9 * * 1-5");
  });

  it("parses 'every weekend at 10am'", () => {
    expect(parseScheduleToCron("every weekend at 10am")).toBe("0 10 * * 0,6");
  });

  it("parses 'every monday at 10am'", () => {
    expect(parseScheduleToCron("every monday at 10am")).toBe("0 10 * * 1");
  });

  it("parses 'every friday at 5pm'", () => {
    expect(parseScheduleToCron("every friday at 5pm")).toBe("0 17 * * 5");
  });

  it("parses 'hourly'", () => {
    expect(parseScheduleToCron("hourly")).toBe("0 * * * *");
  });

  it("parses 'every hour'", () => {
    expect(parseScheduleToCron("every hour")).toBe("0 * * * *");
  });

  it("parses 'every 30 minutes'", () => {
    expect(parseScheduleToCron("every 30 minutes")).toBe("*/30 * * * *");
  });

  it("parses 'every 2 hours'", () => {
    expect(parseScheduleToCron("every 2 hours")).toBe("0 */2 * * *");
  });

  it("parses 'weekly'", () => {
    expect(parseScheduleToCron("weekly")).toBe("0 9 * * 1");
  });

  it("parses 'monthly'", () => {
    expect(parseScheduleToCron("monthly")).toBe("0 9 1 * *");
  });

  it("parses 'monthly on the 15th at 2pm'", () => {
    expect(parseScheduleToCron("monthly on the 15th at 2pm")).toBe("0 14 15 * *");
  });

  it("passes through raw cron expressions", () => {
    expect(parseScheduleToCron("0 9 * * 1-5")).toBe("0 9 * * 1-5");
  });

  it("returns null for invalid input", () => {
    expect(parseScheduleToCron("")).toBeNull();
    expect(parseScheduleToCron("something random")).toBeNull();
  });

  it("returns null for invalid cron", () => {
    expect(parseScheduleToCron("99 99 99 99 99")).toBeNull();
  });

  it("parses 'every minute'", () => {
    expect(parseScheduleToCron("every minute")).toBe("* * * * *");
  });
});

describe("describeCron", () => {
  it("describes daily cron", () => {
    expect(describeCron("0 9 * * *")).toBe("Daily at 9:00 AM");
  });

  it("describes weekday cron", () => {
    expect(describeCron("0 9 * * 1-5")).toBe("Weekdays at 9:00 AM");
  });

  it("describes weekly cron", () => {
    expect(describeCron("0 10 * * 1")).toBe("Every Monday at 10:00 AM");
  });

  it("describes every N minutes", () => {
    expect(describeCron("*/30 * * * *")).toBe("Every 30 minutes");
  });

  it("describes hourly", () => {
    expect(describeCron("0 * * * *")).toBe("Every hour at :00");
  });

  it("describes every N hours", () => {
    expect(describeCron("0 */2 * * *")).toBe("Every 2 hours");
  });

  it("describes monthly", () => {
    expect(describeCron("0 9 15 * *")).toBe("Monthly on the 15th at 9:00 AM");
  });

  it("describes PM times", () => {
    expect(describeCron("0 17 * * *")).toBe("Daily at 5:00 PM");
  });
});

describe("validateCronExpression", () => {
  it("validates correct expressions", () => {
    expect(validateCronExpression("0 9 * * *")).toBe(true);
    expect(validateCronExpression("*/15 * * * *")).toBe(true);
    expect(validateCronExpression("0 9 * * 1-5")).toBe(true);
    expect(validateCronExpression("0,30 9 1 1,6 *")).toBe(true);
  });

  it("rejects invalid expressions", () => {
    expect(validateCronExpression("60 9 * * *")).toBe(false);
    expect(validateCronExpression("0 25 * * *")).toBe(false);
    expect(validateCronExpression("not a cron")).toBe(false);
    expect(validateCronExpression("0 9 * *")).toBe(false); // too few fields
  });
});

describe("isCronDue", () => {
  it("returns true when cron matches current time", () => {
    // 2026-03-16T09:00:00Z is a Monday, minute=0, hour=9
    const now = new Date("2026-03-16T09:00:00Z");
    expect(isCronDue("0 9 * * *", now, null)).toBe(true);
  });

  it("returns false when cron does not match", () => {
    const now = new Date("2026-03-16T10:00:00Z"); // hour=10, not 9
    expect(isCronDue("0 9 * * *", now, null)).toBe(false);
  });

  it("prevents duplicate spawn in the same minute", () => {
    const now = new Date("2026-03-16T09:00:30Z");
    const lastSpawned = new Date("2026-03-16T09:00:00Z"); // same minute
    expect(isCronDue("0 9 * * *", now, lastSpawned)).toBe(false);
  });

  it("allows spawn in a different minute", () => {
    const now = new Date("2026-03-17T09:00:00Z"); // next day
    const lastSpawned = new Date("2026-03-16T09:00:00Z");
    expect(isCronDue("0 9 * * *", now, lastSpawned)).toBe(true);
  });

  it("handles step values", () => {
    const now = new Date("2026-03-16T09:30:00Z"); // minute=30
    expect(isCronDue("*/15 * * * *", now, null)).toBe(true);
    const now2 = new Date("2026-03-16T09:07:00Z"); // minute=7
    expect(isCronDue("*/15 * * * *", now2, null)).toBe(false);
  });

  it("handles day-of-week matching", () => {
    // 2026-03-16 is a Monday (day 1)
    const now = new Date("2026-03-16T09:00:00Z");
    expect(isCronDue("0 9 * * 1", now, null)).toBe(true); // Monday
    expect(isCronDue("0 9 * * 5", now, null)).toBe(false); // Friday
  });
});

describe("formatRecurrenceDateSuffix", () => {
  it("formats date correctly", () => {
    expect(formatRecurrenceDateSuffix(new Date("2026-03-16T09:00:00Z"))).toBe("Mar 16");
    expect(formatRecurrenceDateSuffix(new Date("2026-01-01T00:00:00Z"))).toBe("Jan 1");
    expect(formatRecurrenceDateSuffix(new Date("2026-12-25T00:00:00Z"))).toBe("Dec 25");
  });
});
