-- AdsSim accounts now sign in with a password. Accounts made before this have none (NULL) and set one the
-- first time their owner uses Sign up with the same email.
ALTER TABLE "ads"."users" ADD COLUMN "password_hash" text;
