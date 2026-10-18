CREATE TABLE `customers` (
	`owner` text NOT NULL,
	`phone` text NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `phone`)
);

--> statement-breakpoint
CREATE TRIGGER customers_after_invoice_insert AFTER INSERT ON invoices
WHEN length(json_extract(NEW.data, '$.customerPhone')) BETWEEN 7 AND 15
BEGIN
 INSERT INTO customers (owner,phone,name,updated_at) VALUES (NEW.owner,json_extract(NEW.data,'$.customerPhone'),trim(json_extract(NEW.data,'$.customer')),NEW.updated_at)
 ON CONFLICT(owner,phone) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at;
END;

--> statement-breakpoint
CREATE TRIGGER customers_after_invoice_update AFTER UPDATE ON invoices
WHEN length(json_extract(NEW.data, '$.customerPhone')) BETWEEN 7 AND 15
BEGIN
 INSERT INTO customers (owner,phone,name,updated_at) VALUES (NEW.owner,json_extract(NEW.data,'$.customerPhone'),trim(json_extract(NEW.data,'$.customer')),NEW.updated_at)
 ON CONFLICT(owner,phone) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at;
END;
