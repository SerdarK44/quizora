ALTER TABLE `answers` ADD `risk` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `double_question` integer DEFAULT -1 NOT NULL;