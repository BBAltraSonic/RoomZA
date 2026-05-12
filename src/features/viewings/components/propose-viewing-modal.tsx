'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { proposeViewingSlots } from '@/features/viewings/actions/propose-viewing-slots'
import { toast } from 'sonner'
import { Loader2, Plus, Calendar as CalendarIcon, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

interface ProposeViewingModalProps {
    listingId: string
    applicantIds: string[]
}

export function ProposeViewingModal({ listingId, applicantIds }: ProposeViewingModalProps) {
    const [open, setOpen] = useState(false)
    const [date, setDate] = useState<Date>()
    const [time, setTime] = useState('12:00')
    const [slots, setSlots] = useState<{ startTime: string, endTime: string }[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleAddSlot = () => {
        if (!date) return
        const [hours, minutes] = time.split(':')
        const start = new Date(date)
        start.setHours(parseInt(hours), parseInt(minutes), 0, 0)

        const end = new Date(start)
        end.setHours(start.getHours() + 1) // 1 hour slots by default

        setSlots(prev => [...prev, {
            startTime: start.toISOString(),
            endTime: end.toISOString()
        }])

        setDate(undefined)
    }

    const handlePropose = async () => {
        if (slots.length === 0) {
            toast.error('Please add at least one time slot')
            return
        }

        setIsSubmitting(true)
        const result = await proposeViewingSlots({
            listingId,
            applicationIds: applicantIds,
            slots
        })

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success('Viewing slots proposed successfully')
            setOpen(false)
            setSlots([])
        }
        setIsSubmitting(false)
    }

    return (
        <>
            <Button
                variant="default"
                onClick={() => setOpen(true)}
                className="rounded-none border-2 border-black bg-black text-white hover:bg-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ease-out duration-200"
            >
                <CalendarIcon className="mr-2 h-4 w-4" /> Propose Viewings
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-none border-4 border-black p-0 overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <DialogHeader className="p-6 bg-yellow-400 border-b-4 border-black border-dashed">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Propose Times</DialogTitle>
                        <p className="text-sm font-bold text-black/70">Select dates and times for the applicant to choose from.</p>
                    </DialogHeader>

                    <div className="p-6 space-y-6 bg-white">
                        <div className="flex flex-col space-y-4">
                            <div className="flex justify-center border-2 border-black p-2 bg-gray-50">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    className="rounded-none font-medium"
                                />
                            </div>

                            <div className="flex space-x-2">
                                <input
                                    type="time"
                                    value={time}
                                    onChange={e => setTime(e.target.value)}
                                    className="flex-1 border-2 border-black p-2 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                />
                                <Button
                                    onClick={handleAddSlot}
                                    disabled={!date}
                                    className="rounded-none border-2 border-black bg-blue-500 text-white hover:bg-blue-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]"
                                >
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-black uppercase tracking-tight text-sm text-gray-500 border-b-2 border-black pb-1">Selected Slots</h4>
                            {slots.length === 0 ? (
                                <p className="text-sm italic text-gray-400 py-4 text-center border-2 border-dashed border-gray-200">No slots added yet.</p>
                            ) : (
                                <ul className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                                    {slots.map((s, i) => (
                                        <li key={i} className="flex justify-between items-center p-2 border-2 text-sm border-black bg-pink-100 font-mono font-bold">
                                            <span>{format(new Date(s.startTime), 'MMM d, h:mm a')}</span>
                                            <button
                                                onClick={() => setSlots(prev => prev.filter((_, idx) => idx !== i))}
                                                className="text-black hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-gray-100 border-t-4 border-black">
                        <Button
                            className="w-full rounded-none border-2 border-black bg-green-400 text-black hover:bg-green-500 font-black uppercase text-lg h-14 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all"
                            onClick={handlePropose}
                            disabled={isSubmitting || slots.length === 0}
                        >
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Send Proposal'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
