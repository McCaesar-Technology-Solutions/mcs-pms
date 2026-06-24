-- Broaden audit_log entity types for stays, settings, staff, billing, complaints.

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (
  entity_type IN (
    'reservation',
    'room',
    'room_category',
    'hotel',
    'staff',
    'guest',
    'invoice',
    'complaint'
  )
);
