CREATE TABLE `books` (
	`work_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`authors` text NOT NULL,
	`year` integer,
	`cover_id` integer,
	`shelf` text NOT NULL,
	`added_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "books_shelf_check" CHECK("books"."shelf" IN ('want_to_read', 'reading', 'finished'))
);
