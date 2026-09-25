CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`can_host` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_name_unique` ON `accounts` (`name`);
--> statement-breakpoint
CREATE TABLE `account_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_account_sessions_account` ON `account_sessions` (`account_id`);
--> statement-breakpoint
CREATE TABLE `account_games` (
	`account_id` text NOT NULL,
	`code` text NOT NULL,
	`round` integer NOT NULL,
	`played_at` integer NOT NULL,
	`capacity` integer NOT NULL,
	`preset` text NOT NULL,
	`role` text NOT NULL,
	`side` text NOT NULL,
	`winner` text NOT NULL,
	`mvp` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`account_id`, `code`, `round`)
);
--> statement-breakpoint
CREATE TABLE `mvp_votes` (
	`code` text NOT NULL,
	`round` integer NOT NULL,
	`voter_id` text NOT NULL,
	`side` text NOT NULL,
	`seat` integer NOT NULL,
	PRIMARY KEY(`code`, `round`, `voter_id`)
);
