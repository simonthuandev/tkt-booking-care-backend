-- CreateIndex
CREATE INDEX "Appointment_doctorId_createdAt_idx" ON "Appointment"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX "News_isPublished_category_idx" ON "News"("isPublished", "category");

-- CreateIndex
CREATE INDEX "TimeSlot_doctorId_isBooked_isBlocked_idx" ON "TimeSlot"("doctorId", "isBooked", "isBlocked");
