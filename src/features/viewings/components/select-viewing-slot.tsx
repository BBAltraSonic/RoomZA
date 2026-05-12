'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { bookViewingSlot } from '@/features/viewings/actions/book-viewing-slot'
import { toast } from 'sonner'
import { Loader2, CheckCircle, CalendarClock } from 'lucide-react'
import { format } from 'date-fns'

interface Slot {
    id: string
    start_time: string
    end_time: string
}

interface SelectViewingSlotProps {
    applicationId: string
    slots: Slot[]
}

export function SelectViewingSlot({ applicationId, slots }: SelectViewingSlotProps) {
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isBooked, setIsBooked] = useState(false)

    const handleBook = async () => {
        if (!selectedSlotId) return

        setIsSubmitting(true)
        const result = await bookViewingSlot({
            applicationId,
            slotId: selectedSlotId
        })

        if (result?.error) {
            toast.error(result.error)
            setSelectedSlotId(null) // Reset selection if failed
        } else {
            toast.success('Viewing booked successfully!')
            setIsBooked(true)
        }
        setIsSubmitting(false)
    }

    if (isBooked) {
        return (
            <div className="animate-in fade-in zoom-in slide-in-from-bottom-4 duration-500 ease-out border-4 border-black bg-green-400 p-8 text-center rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-black" />
                <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Viewing Confirmed!</h3>
                <p className="font-bold font-mono">You&apos;re all set.</p>
            </div>
        )
    }

    return (
        <div className="border-4 border-black bg-white p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center space-x-3 mb-6 border-b-4 border-black pb-4 border-dashed">
                <CalendarClock className="h-8 w-8 text-blue-600" />
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tight leading-none">Select a viewing time</h3>
                    <p className="text-sm font-bold text-gray-500 mt-1">The landlord has proposed the following slots.</p>
                </div>
            </div>

            {slots.length === 0 ? (
                <p className="text-center italic font-bold text-gray-400 py-8">No available slots.</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                    {slots.map(slot => {
                        const isSelected = selectedSlotId === slot.id
                        return (
                            <button
                                key={slot.id}
                                onClick={() => setSelectedSlotId(slot.id)}
                                className={`flex flex-col items-center justify-center p-4 border-4 transition-all duration-200 outline-none
                  ${isSelected ? 'border-black bg-yellow-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1' : 'border-black/20 bg-gray-50 hover:border-black hover:bg-yellow-100'}
                `}
                            >
                                <span className="font-black text-lg">{format(new Date(slot.start_time), 'MMM d')}</span>
                                <span className="font-mono font-bold">{format(new Date(slot.start_time), 'h:mm a')}</span>
                            </button>
                        )
                    })}
                </div>
            )}

            <Button
                className="w-full sm:w-auto min-w-[200px] rounded-none border-2 border-black bg-black text-white hover:bg-black font-black uppercase tracking-widest hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] transition-all h-14"
                disabled={!selectedSlotId || isSubmitting}
                onClick={handleBook}
            >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Confirm Booking'}
            </Button>
        </div>
    )
}
