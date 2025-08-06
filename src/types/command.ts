import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";

export const commandSchema = T.Object({
  name: T.Literal("boost"),
  parameters: T.Object({
    comment: T.String(),
  }),
});

export type Command = StaticDecode<typeof commandSchema>;
