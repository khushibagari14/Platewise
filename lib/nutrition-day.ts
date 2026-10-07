import { localDate } from './manual-meal';

/** A nutrition day runs from 3 am to 2:59 am in the user's local time. */
export function nutritionDay(date = new Date()): string {
  const day = new Date(date);
  if (day.getHours() < 3) day.setDate(day.getDate() - 1);
  return localDate(day);
}

export function nextNutritionDay(date = new Date()): Date {
  const next = new Date(date);
  next.setHours(3, 0, 0, 0);
  if (next.getTime() <= date.getTime()) next.setDate(next.getDate() + 1);
  return next;
}
