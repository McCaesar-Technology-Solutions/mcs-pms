-- Profile photos for staff (including technicians) and guests in messaging.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_image_path text;

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS profile_image_path text;

COMMENT ON COLUMN profiles.profile_image_path IS 'Public storage path in property-images bucket';
COMMENT ON COLUMN guests.profile_image_path IS 'Public storage path in property-images bucket';
