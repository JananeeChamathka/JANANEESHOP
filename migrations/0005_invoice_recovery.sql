CREATE TABLE invoice_recovery (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL,
  event TEXT NOT NULL,
  recorded_at INTEGER NOT NULL
);
CREATE INDEX invoice_recovery_owner_invoice ON invoice_recovery(owner,invoice_id,sequence);
INSERT INTO invoice_recovery(owner,invoice_id,data,revision,event,recorded_at)
SELECT owner,id,data,revision,'existing',updated_at FROM invoices;
CREATE TRIGGER invoice_recovery_insert AFTER INSERT ON invoices BEGIN
  INSERT INTO invoice_recovery(owner,invoice_id,data,revision,event,recorded_at)
  VALUES(NEW.owner,NEW.id,NEW.data,NEW.revision,'saved',unixepoch()*1000);
END;
CREATE TRIGGER invoice_recovery_update AFTER UPDATE ON invoices BEGIN
  INSERT INTO invoice_recovery(owner,invoice_id,data,revision,event,recorded_at)
  VALUES(NEW.owner,NEW.id,NEW.data,NEW.revision,'updated',unixepoch()*1000);
END;
CREATE TRIGGER invoice_recovery_delete BEFORE DELETE ON invoices BEGIN
  INSERT INTO invoice_recovery(owner,invoice_id,data,revision,event,recorded_at)
  VALUES(OLD.owner,OLD.id,OLD.data,OLD.revision,'deleted',unixepoch()*1000);
END;
