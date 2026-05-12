"use client";

import { cloneElement, useState, useTransition, useEffect } from "react";
import type { MouseEvent, ReactElement } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitApplication, checkApplicationEligibility } from "./actions";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type ApplicationModalProps = {
    listingId: string;
    trigger?: ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>;
};

export function ApplicationModal({ listingId, trigger }: ApplicationModalProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [eligibility, setEligibility] = useState<{ eligible: boolean, reason: string | null } | null>(null);
    const defaultTrigger = <Button type="button" className="h-10 bg-[#173b33] text-white hover:bg-[#102a24]">Apply now</Button>;

    useEffect(() => {
        if (open) {
            checkApplicationEligibility(listingId).then(setEligibility);
        }
    }, [open, listingId]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setSuccess(false);
            setError(null);
            setEligibility(null);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        const formData = new FormData(e.currentTarget);
        formData.append("listingId", listingId);

        startTransition(async () => {
            const result = await submitApplication(formData);
            if (!result.success && result.error) {
                setError(result.error ?? "An unknown error occurred.");
            } else if (result.success) {
                setSuccess(true);
            }
        });
    };

    const triggerElement = cloneElement(trigger ?? defaultTrigger, {
        onClick: (event: MouseEvent<HTMLElement>) => {
            trigger?.props.onClick?.(event);
            if (!event.defaultPrevented) {
                setOpen(true);
            }
        },
    });

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {triggerElement}

            <DialogContent className="max-w-lg sm:rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-white">
                <div className="bg-[#173b33] px-6 py-8 text-white relative">
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                    <DialogHeader className="relative z-10">
                        <DialogTitle className="text-2xl font-semibold tracking-tight text-white mb-2">
                            Apply for this property
                        </DialogTitle>
                        <DialogDescription className="text-[#e7f2ee]/80 text-sm">
                            Please provide your details below. Your application will be securely sent to the landlord.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {!eligibility ? (
                    <div className="p-10 flex items-center justify-center min-h-[300px]">
                        <Loader2 className="h-8 w-8 animate-spin text-[#173b33]" />
                    </div>
                ) : eligibility.reason === "unauthenticated" ? (
                    <div className="p-8 text-center bg-gray-50/50">
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">Login Required</h3>
                        <p className="text-muted-foreground mb-6">You must be logged in to apply.</p>
                        <div className="flex gap-4 justify-center">
                            <Button render={<Link href="/auth" />} className="bg-[#173b33] hover:bg-[#102a24]">Sign In</Button>
                            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                        </div>
                    </div>
                ) : !eligibility.eligible ? (
                    <div className="p-8 text-center bg-gray-50/50 min-h-[300px] flex flex-col justify-center">
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">Cannot Apply</h3>
                        <p className="text-muted-foreground mb-6">
                            {eligibility.reason === "not_renter" && "You must have a renter account to apply for a property."}
                            {eligibility.reason === "cap_reached" && "You have reached the maximum of 5 active applications. Please withdraw one to apply elsewhere."}
                            {eligibility.reason === "already_applied" && "You already have an active application for this property."}
                        </p>
                        <Button className="w-full bg-[#173b33] hover:bg-[#102a24]" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                    </div>
                ) : success ? (
                    <div className="p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
                        <div className="h-16 w-16 bg-[#e7f2ee] text-[#173b33] rounded-full flex items-center justify-center mb-6">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-semibold mb-2">Application Submitted!</h3>
                        <p className="text-muted-foreground mb-8">
                            Your application has been securely sent to the landlord. You can track its status in your dashboard.
                        </p>
                        <Button
                            className="px-8 rounded-xl h-12 font-medium bg-[#173b33] hover:bg-[#102a24]"
                            onClick={() => setOpen(false)}
                        >
                            Continue
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 md:p-8 overflow-y-auto max-h-[80vh] custom-scrollbar">
                        {error && (
                            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 break-words font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-sm font-semibold">Full Legal Name</Label>
                                <Input id="fullName" name="fullName" required className="h-12 rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-[#2b6357]" placeholder="e.g. Jane Doe" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="income" className="text-sm font-semibold">Monthly Income (ZAR)</Label>
                                    <Input id="income" type="number" min="0" name="income" required className="h-12 rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-[#2b6357]" placeholder="e.g. 25000" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="employmentStatus" className="text-sm font-semibold">Employment Status</Label>
                                    <Select name="employmentStatus" required defaultValue="employed">
                                        <SelectTrigger className="h-12 rounded-xl bg-gray-50 border-gray-200 focus-[ring-[#2b6357]] w-full">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-gray-200 shadow-xl">
                                            <SelectItem value="employed" className="focus:bg-[#e7f2ee] focus:text-[#173b33]">Employed</SelectItem>
                                            <SelectItem value="self-employed" className="focus:bg-[#e7f2ee] focus:text-[#173b33]">Self-employed</SelectItem>
                                            <SelectItem value="student" className="focus:bg-[#e7f2ee] focus:text-[#173b33]">Student</SelectItem>
                                            <SelectItem value="unemployed" className="focus:bg-[#e7f2ee] focus:text-[#173b33]">Unemployed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="moveInDate" className="text-sm font-semibold">Move-in Date</Label>
                                    <Input id="moveInDate" type="date" name="moveInDate" required className="h-12 rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-[#2b6357]" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="householdSize" className="text-sm font-semibold">Household Size</Label>
                                    <Input id="householdSize" type="number" min="1" max="10" name="householdSize" required className="h-12 rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-[#2b6357]" placeholder="e.g. 2" />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div>
                                    <h4 className="font-semibold text-sm mb-1">Required Documents</h4>
                                    <p className="text-xs text-muted-foreground mb-4">Upload your ID and latest Payslip as valid proof.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="idDocument" className="text-sm font-semibold">Government ID</Label>
                                    <div className="relative group">
                                        <Input
                                            id="idDocument"
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            name="idDocument"
                                            required
                                            className="file:bg-[#e7f2ee] file:text-[#173b33] file:mr-4 file:px-4 file:py-2 file:border-none file:rounded-lg text-sm h-14 pt-2.5 pb-2 cursor-pointer bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="payslipDocument" className="text-sm font-semibold">Latest Payslip</Label>
                                    <div className="relative group">
                                        <Input
                                            id="payslipDocument"
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            name="payslipDocument"
                                            required
                                            className="file:bg-[#e7f2ee] file:text-[#173b33] file:mr-4 file:px-4 file:py-2 file:border-none file:rounded-lg text-sm h-14 pt-2.5 pb-2 cursor-pointer bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button type="submit" disabled={isPending} className="w-full h-14 rounded-xl text-lg font-medium bg-[#173b33] hover:bg-[#102a24] shadow-md hover:shadow-lg transition-all">
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Submitting Application...
                                    </>
                                ) : "Submit Secure Application"}
                            </Button>
                            <p className="text-xs text-center text-muted-foreground mt-4">
                                Your information is secured via Role Level Security and only visible to the landlord.
                            </p>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
