/**
 * Zero-dependency schedule parser for recurring tasks.
 * Converts natural language schedule descriptions to cron expressions and vice versa.
 */

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseTime(input: string): { hour: number; minute: number } | null {
  // "9am", "9:30pm", "14:00", "2pm", "9:00 am"
  const match = input.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)?$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Parse a natural language schedule description into a 5-field cron expression.
 * Returns null if the input cannot be parsed.
 *
 * Supported patterns:
 * - "every day at 9am" / "daily at 9:30am"
 * - "every weekday at 9am"
 * - "every monday at 10am" / "weekly on monday"
 * - "every hour" / "hourly"
 * - "every N minutes" / "every N hours"
 * - Raw cron expressions (5-field)
 */
export function parseScheduleToCron(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Raw cron expression (5 fields)
  if (/^[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+$/.test(trimmed)) {
    return validateCronExpression(trimmed) ? trimmed : null;
  }

  // "every N minutes"
  {
    const match = trimmed.match(/^every\s+(\d+)\s+minutes?$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n < 1 || n > 59) return null;
      return `*/${n} * * * *`;
    }
  }

  // "every minute"
  if (/^every\s+minute$/.test(trimmed)) {
    return "* * * * *";
  }

  // "every N hours"
  {
    const match = trimmed.match(/^every\s+(\d+)\s+hours?$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n < 1 || n > 23) return null;
      return `0 */${n} * * *`;
    }
  }

  // "hourly" / "every hour"
  if (/^(hourly|every\s+hour)$/.test(trimmed)) {
    return "0 * * * *";
  }

  // "daily" / "every day" (default 9am)
  if (/^(daily|every\s+day)$/.test(trimmed)) {
    return "0 9 * * *";
  }

  // "daily at TIME" / "every day at TIME"
  {
    const match = trimmed.match(/^(?:daily|every\s+day)\s+at\s+(.+)$/);
    if (match) {
      const time = parseTime(match[1]);
      if (!time) return null;
      return `${time.minute} ${time.hour} * * *`;
    }
  }

  // "every weekday" / "every weekday at TIME"
  {
    const match = trimmed.match(/^every\s+weekday(?:\s+at\s+(.+))?$/);
    if (match) {
      const time = match[1] ? parseTime(match[1]) : { hour: 9, minute: 0 };
      if (!time) return null;
      return `${time.minute} ${time.hour} * * 1-5`;
    }
  }

  // "every weekend" / "every weekend at TIME"
  {
    const match = trimmed.match(/^every\s+weekend(?:\s+at\s+(.+))?$/);
    if (match) {
      const time = match[1] ? parseTime(match[1]) : { hour: 9, minute: 0 };
      if (!time) return null;
      return `${time.minute} ${time.hour} * * 0,6`;
    }
  }

  // "weekly" / "weekly on DAYNAME" / "every week"
  if (/^(weekly|every\s+week)$/.test(trimmed)) {
    return "0 9 * * 1";
  }

  // "weekly on DAYNAME at TIME" / "every DAYNAME at TIME" / "every DAYNAME"
  {
    const match = trimmed.match(
      /^(?:weekly\s+on|every)\s+(\w+?)(?:\s+at\s+(.+))?$/,
    );
    if (match) {
      const dayNum = DAY_NAMES[match[1]];
      if (dayNum === undefined) return null;
      const time = match[2] ? parseTime(match[2]) : { hour: 9, minute: 0 };
      if (!time) return null;
      return `${time.minute} ${time.hour} * * ${dayNum}`;
    }
  }

  // "monthly" / "every month"
  if (/^(monthly|every\s+month)$/.test(trimmed)) {
    return "0 9 1 * *";
  }

  // "monthly on the Nth" / "monthly on the Nth at TIME"
  {
    const match = trimmed.match(/^(?:monthly|every\s+month)\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?(?:\s+at\s+(.+))?$/);
    if (match) {
      const day = parseInt(match[1], 10);
      if (day < 1 || day > 31) return null;
      const time = match[2] ? parseTime(match[2]) : { hour: 9, minute: 0 };
      if (!time) return null;
      return `${time.minute} ${time.hour} ${day} * *`;
    }
  }

  return null;
}

/**
 * Validate a 5-field cron expression.
 */
export function validateCronExpression(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const ranges: [number, number][] = [
    [0, 59],   // minute
    [0, 23],   // hour
    [1, 31],   // day of month
    [1, 12],   // month
    [0, 7],    // day of week (0 and 7 both = Sunday)
  ];

  return parts.every((part, i) => validateCronField(part, ranges[i][0], ranges[i][1]));
}

function validateCronField(field: string, min: number, max: number): boolean {
  return field.split(",").every((segment) => {
    // Step values: */n or range/n
    const stepMatch = segment.match(/^(.+)\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[2], 10);
      if (step < 1) return false;
      const base = stepMatch[1];
      if (base === "*") return true;
      return validateCronRange(base, min, max);
    }

    if (segment === "*") return true;
    return validateCronRange(segment, min, max);
  });
}

function validateCronRange(segment: string, min: number, max: number): boolean {
  const rangeMatch = segment.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1], 10);
    const b = parseInt(rangeMatch[2], 10);
    return a >= min && b <= max && a <= b;
  }
  const num = parseInt(segment, 10);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Describe a cron expression in human-readable English.
 */
export function describeCron(cronExpr: string): string {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return cronExpr;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Every minute
  if (minute === "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "Every minute";
  }

  // Every N minutes
  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const n = parseInt(minute.slice(2), 10);
    return `Every ${n} minute${n === 1 ? "" : "s"}`;
  }

  // Hourly
  if (minute !== "*" && !minute.includes("/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Every hour at :${minute.padStart(2, "0")}`;
  }

  // Every N hours
  if (minute === "0" && hour.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const n = parseInt(hour.slice(2), 10);
    return `Every ${n} hour${n === 1 ? "" : "s"}`;
  }

  const timeStr = formatCronTime(minute, hour);

  // Daily
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Daily at ${timeStr}`;
  }

  // Weekdays
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5") {
    return `Weekdays at ${timeStr}`;
  }

  // Weekends
  if (dayOfMonth === "*" && month === "*" && (dayOfWeek === "0,6" || dayOfWeek === "6,0")) {
    return `Weekends at ${timeStr}`;
  }

  // Specific day of week
  if (dayOfMonth === "*" && month === "*" && /^\d$/.test(dayOfWeek)) {
    const dayIdx = parseInt(dayOfWeek, 10) % 7;
    return `Every ${DAY_LABELS[dayIdx]} at ${timeStr}`;
  }

  // Monthly on specific day
  if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    const day = parseInt(dayOfMonth, 10);
    return `Monthly on the ${ordinal(day)} at ${timeStr}`;
  }

  return cronExpr;
}

function formatCronTime(minuteField: string, hourField: string): string {
  const h = parseInt(hourField, 10);
  const m = parseInt(minuteField, 10);
  if (isNaN(h) || isNaN(m)) return `${hourField}:${minuteField}`;
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Check if a cron expression is due at the given time.
 * Prevents duplicate spawns within the same minute as lastSpawnedAt.
 */
export function isCronDue(cronExpr: string, now: Date, lastSpawnedAt: Date | null): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minuteField, hourField, domField, monthField, dowField] = parts;

  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const dayOfMonth = now.getUTCDate();
  const month = now.getUTCMonth() + 1; // 1-based
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday

  if (!matchesCronField(minuteField, minute, 0, 59)) return false;
  if (!matchesCronField(hourField, hour, 0, 23)) return false;
  if (!matchesCronField(domField, dayOfMonth, 1, 31)) return false;
  if (!matchesCronField(monthField, month, 1, 12)) return false;
  if (!matchesCronField(dowField, dayOfWeek, 0, 7)) return false;

  // Prevent duplicate spawn in the same minute
  if (lastSpawnedAt) {
    const lastMinute = lastSpawnedAt.getUTCMinutes();
    const lastHour = lastSpawnedAt.getUTCHours();
    const lastDate = lastSpawnedAt.getUTCDate();
    const lastMonth = lastSpawnedAt.getUTCMonth();
    const lastYear = lastSpawnedAt.getUTCFullYear();
    if (
      lastYear === now.getUTCFullYear() &&
      lastMonth === now.getUTCMonth() &&
      lastDate === now.getUTCDate() &&
      lastHour === hour &&
      lastMinute === minute
    ) {
      return false;
    }
  }

  return true;
}

function matchesCronField(field: string, value: number, _min: number, _max: number): boolean {
  if (field === "*") return true;

  return field.split(",").some((segment) => {
    // Step values
    const stepMatch = segment.match(/^(.+)\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[2], 10);
      const base = stepMatch[1];
      if (base === "*") return value % step === 0;
      const rangeMatch = base.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        return value >= start && value <= end && (value - start) % step === 0;
      }
      const start = parseInt(base, 10);
      return !isNaN(start) && value >= start && (value - start) % step === 0;
    }

    // Range
    const rangeMatch = segment.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const a = parseInt(rangeMatch[1], 10);
      const b = parseInt(rangeMatch[2], 10);
      return value >= a && value <= b;
    }

    // Exact value
    const num = parseInt(segment, 10);
    if (isNaN(num)) return false;
    // Day of week: 7 is also Sunday (=0)
    if (_max === 7 && (num === 7 || num === 0)) return value === 0 || value === 7;
    return value === num;
  });
}

/**
 * Format a date suffix for spawned recurring issues.
 * e.g., "Mar 16"
 */
export function formatRecurrenceDateSuffix(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}
