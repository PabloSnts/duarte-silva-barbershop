import { createHandler } from "./handler.ts";

Deno.serve(createHandler({
  url: Deno.env.get("SUPABASE_URL")!,
  secret: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
}));
