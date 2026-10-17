import { Schema } from "effect";

const UnitInterval = Schema.Finite.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 1 })));

export const Effort = UnitInterval.pipe(Schema.brand("Effort"));
export type Effort = typeof Effort.Type;

export const Understanding = UnitInterval.pipe(Schema.brand("Understanding"));
export type Understanding = typeof Understanding.Type;

export const Assessment = Schema.Struct({ effort: Effort, understanding: Understanding });
export type Assessment = typeof Assessment.Type;

export const Suggestion = Schema.Struct(Assessment.fields);
export type Suggestion = typeof Suggestion.Type;

export const Rating = Schema.Literals(["Again", "Hard", "Good", "Easy"]);
export type Rating = typeof Rating.Type;

export const ratingOf = ({ effort, understanding }: Assessment): Rating => {
  if (understanding < 0.4) return "Again";
  if (understanding >= 0.8 && effort <= 0.3) return "Easy";
  if (understanding < 0.7 || effort > 0.85) return "Hard";
  return "Good";
};
