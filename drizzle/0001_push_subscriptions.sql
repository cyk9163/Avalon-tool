CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_hash` text NOT NULL,
	`player_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`lang` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_push_expiry` ON `push_subscriptions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_push_room` ON `push_subscriptions` (`room_hash`);
