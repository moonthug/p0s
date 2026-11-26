CREATE TABLE `templates` (
	`name` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`sample` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
