import type { DateString } from "../DataTypes";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

export function dateStringToNumber(date: DateString): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function daysBetween(startDate: DateString, endDate: DateString) {
  return Math.max(
    0,
    Math.round(
      (dateStringToNumber(endDate) - dateStringToNumber(startDate)) /
        DAY_IN_MILLISECONDS
    )
  );
}

export function addDays(date: DateString, dayOffset: number): DateString {
  const next = new Date(
    dateStringToNumber(date) + dayOffset * DAY_IN_MILLISECONDS
  );
  return next.toISOString().slice(0, 10) as DateString;
}

export function addMonths(date: DateString, monthOffset: number): DateString {
  const current = new Date(dateStringToNumber(date));
  const year = current.getUTCFullYear();
  const month = current.getUTCMonth();
  const day = current.getUTCDate();

  const targetMonthDate = new Date(Date.UTC(year, month + monthOffset, 1));
  const maxDay = new Date(
    Date.UTC(
      targetMonthDate.getUTCFullYear(),
      targetMonthDate.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  targetMonthDate.setUTCDate(Math.min(day, maxDay));
  return targetMonthDate.toISOString().slice(0, 10) as DateString;
}

export function getDayOffsetFromStart(
  startDate: DateString,
  targetDate: DateString
) {
  return Math.round(
    (dateStringToNumber(targetDate) - dateStringToNumber(startDate)) /
      DAY_IN_MILLISECONDS
  );
}

function getOrdinalSuffix(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function formatDisplayDate(date: DateString) {
  const parsed = new Date(dateStringToNumber(date));
  const month = MONTH_NAMES[parsed.getUTCMonth()];
  const day = parsed.getUTCDate();
  const year = parsed.getUTCFullYear();
  return `${month} ${day}${getOrdinalSuffix(day)} ${year}`;
}

export function clampDayOffset(
  dayOffset: number,
  startDate: DateString,
  endDate: DateString
) {
  return Math.min(daysBetween(startDate, endDate), Math.max(0, dayOffset));
}
