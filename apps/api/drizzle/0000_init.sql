CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`source` text,
	`image` blob,
	`template` text,
	`vars` text,
	`payload` blob NOT NULL,
	`queue_job_id` integer,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
