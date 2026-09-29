CREATE TABLE `friend_requests` (
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`from_id`, `to_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_friend_requests_to` ON `friend_requests` (`to_id`);
--> statement-breakpoint
CREATE TABLE `room_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`code` text NOT NULL,
	`invite` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_room_invites_to` ON `room_invites` (`to_id`);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `last_seen` integer;
