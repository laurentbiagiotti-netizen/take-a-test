-- Scan de la pièce au téléphone (QR code) retiré : aucune épreuve ne le déclenche plus.
alter table tests alter column room_scan_after set default 0;
update tests set room_scan_after = 0 where room_scan_after <> 0;
