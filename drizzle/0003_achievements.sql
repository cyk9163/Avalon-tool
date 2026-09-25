ALTER TABLE `accounts` ADD COLUMN `title` text;
--> statement-breakpoint
CREATE TABLE `account_achievements` (
	`account_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	PRIMARY KEY(`account_id`, `achievement_id`)
);
