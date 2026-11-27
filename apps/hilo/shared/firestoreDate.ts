import { z } from 'zod';

// Utility function to safely convert Firestore timestamps to Date objects
export function parseFirestoreDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate(): Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  throw new Error('Invalid date format');
}

// Custom transformer for Firestore timestamps
export const firestoreDate = z.unknown().transform(parseFirestoreDate);
