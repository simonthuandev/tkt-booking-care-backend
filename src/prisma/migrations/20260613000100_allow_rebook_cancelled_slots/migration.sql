DROP INDEX IF EXISTS "Appointment_timeSlotId_key";

CREATE INDEX IF NOT EXISTS "Appointment_timeSlotId_status_idx"
ON "Appointment"("timeSlotId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_active_timeSlotId_key"
ON "Appointment"("timeSlotId")
WHERE "status" IN ('pending', 'confirmed', 'processing');
