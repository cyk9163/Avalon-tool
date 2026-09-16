CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expiry` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`owner_key` text NOT NULL,
	`request_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_request_id_unique` ON `rooms` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_rooms_expiry` ON `rooms` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_rooms_owner` ON `rooms` (`owner_key`);