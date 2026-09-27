CREATE TABLE `game_replays` (
	`code` text NOT NULL,
	`round` integer NOT NULL,
	`body` text NOT NULL,
	PRIMARY KEY(`code`, `round`)
);
