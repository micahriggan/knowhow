import { Embeddable, MinimalEmbedding } from "../types";
export interface Plugin {
  call(user_input?: string): Promise<string>;
  embed(user_input?: string): Promise<MinimalEmbedding[]>;
}
