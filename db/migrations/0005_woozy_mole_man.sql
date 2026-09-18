CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "tag" DROP CONSTRAINT "tag_name_unique";--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
-- Existing session rows predate `user_id` and have no real user to point at
-- (the old model was one shared password, not an account). There's nothing
-- meaningful to backfill them with, so clear the table instead: every
-- currently-logged-in browser just gets redirected to /login on its next
-- request, same as any expired session already does.
DELETE FROM "session";--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_owner_id_name_unique" UNIQUE("owner_id","name");