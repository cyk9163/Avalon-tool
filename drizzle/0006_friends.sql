CREATE TABLE `friendships` (
	`account_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`account_id`, `friend_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_friendships_account` ON `friendships` (`account_id`);
