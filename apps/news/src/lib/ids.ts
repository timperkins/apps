import { shortHash } from "./text";

/** Document id for the follow-up article written from one suggestion. */
export function followupId(parentId: string, suggestionId: string): string {
  return `f-${shortHash(`${parentId}/${suggestionId}`)}`;
}
