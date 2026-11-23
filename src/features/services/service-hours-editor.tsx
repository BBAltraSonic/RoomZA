"use client";

import { useCallback } from "react";

import type { ViewingHour } from "@/features/showings/viewing-availability";
import { ViewingHoursEditor } from "@/features/showings/viewing-hours-editor";

import { getServiceHours, saveServiceHours } from "./booking-actions";
import { SERVICE_SLOT_MINUTES } from "./service-booking";

const defaultServiceWindow = (weekday: number) => weekday === 6
  ? { weekday, startMinute: 480, endMinute: 780 }
  : { weekday, startMinute: 480, endMinute: 1020 };

/** Weekly hours customers can book on one service, as one-hour slots up to two weeks ahead. */
export function ServiceHoursEditor({ serviceId, className }: { serviceId: string; className?: string }) {
  const load = useCallback(() => getServiceHours(serviceId), [serviceId]);
  const save = useCallback((hours: ViewingHour[]) => saveServiceHours(serviceId, hours), [serviceId]);
  return <ViewingHoursEditor className={className} load={load} save={save} slotMinutes={SERVICE_SLOT_MINUTES}
    noun="Booking hours" offLabel="No bookings" defaultWindow={defaultServiceWindow}
    description="Signed-in customers book one-hour visits inside these hours, up to two weeks ahead, and you confirm each one. Times are South African time. Leave every day off to take quotes only." />;
}
