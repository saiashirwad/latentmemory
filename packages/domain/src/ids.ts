import { Schema } from "effect";

export const CardId = Schema.String.pipe(Schema.check(Schema.isUUID(7)), Schema.brand("CardId"));
export type CardId = typeof CardId.Type;

export const ReviewId = Schema.String.pipe(
  Schema.check(Schema.isUUID(7)),
  Schema.brand("ReviewId"),
);
export type ReviewId = typeof ReviewId.Type;

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const Markdown = Schema.String.pipe(Schema.brand("Markdown"));
export type Markdown = typeof Markdown.Type;
