export type ViewingSlotInput = {
  startTime: string;
  endTime: string;
};

export type ViewingSlotValidation = { valid: true } | { valid: false; errors: string[] };

function parseTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function validateViewingSlot(slot: ViewingSlotInput, now: Date): ViewingSlotValidation {
  const errors: string[] = [];
  const start = parseTime(slot.startTime);
  const end = parseTime(slot.endTime);

  if (start === null) errors.push("Start time is invalid.");
  if (end === null) errors.push("End time is invalid.");
  if (start !== null && start <= now.getTime()) errors.push("Start time must be in the future.");
  if (start !== null && end !== null && end <= start) errors.push("End time must be after start time.");

  return errors.length ? { valid: false, errors } : { valid: true };
}

export function validateViewingSlots(slots: ViewingSlotInput[], now: Date): ViewingSlotValidation {
  const errors = slots.flatMap((slot, index) => {
    const result = validateViewingSlot(slot, now);
    return result.valid ? [] : result.errors.map((error) => `Slot ${index + 1}: ${error}`);
  });

  return errors.length ? { valid: false, errors } : { valid: true };
}
