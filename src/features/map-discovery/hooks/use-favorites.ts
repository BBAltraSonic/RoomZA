"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from 'react';
import { NAVIGATION_IDENTITY_EVENT } from "@/features/auth/navigation-account-events";
import { useDiscoveryAccount } from "@/components/navigation/navigation-account-context";
import { authPathForRedirect } from '@/lib/redirects';
import { toast } from 'sonner';
import { FavoriteMutationTimeoutError, withFavoriteMutationTimeout } from '@/features/listings/favorites';

const favoritesCache = new Set<string>();
let isInitialized = false;
let favoritesStatus: "idle" | "loading" | "ready" | "error" = "idle";
let favoritesAuthenticated = false;
let readController: AbortController | null = null;
let readVersion = 0;
let identityVersion = 0;
const mutationVersions = new Map<string, number>();
const globalListeners = new Set<() => void>();

function emitChange() {
    globalListeners.forEach(l => l());
}

async function refreshFavorites() {
    readController?.abort();
    const controller = new AbortController();
    readController = controller;
    const current = ++readVersion;
    favoritesStatus = "loading";
    emitChange();
    try {
        const response = await fetch("/api/favorites", { headers: { accept: "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        if (!response.ok) throw new Error("favorites_load_failed");
        const payload = await response.json() as { data?: { authenticated?: boolean; favorites?: string[] } };
        if (controller.signal.aborted || current !== readVersion) return;
        favoritesAuthenticated = Boolean(payload.data?.authenticated);
        favoritesCache.clear();
        payload.data?.favorites?.forEach(id => favoritesCache.add(id));
        favoritesStatus = "ready";
        emitChange();
    } catch {
        if (controller.signal.aborted || current !== readVersion) return;
        favoritesStatus = "error";
        emitChange();
        toast.error("Failed to fetch saved properties");
    }
}

function identityChanged(event: Event) {
    identityVersion++;
    readVersion++;
    readController?.abort();
    favoritesCache.clear();
    favoritesAuthenticated = false;
    mutationVersions.clear();
    const userId = (event as CustomEvent<{ userId: string | null }>).detail?.userId;
    favoritesStatus = userId ? "loading" : "ready";
    emitChange();
    if (userId) void refreshFavorites();
}

export function useFavorites() {
    const router = useRouter();
    const account = useDiscoveryAccount();
    const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
    useEffect(() => {
        const handleStoreChange = () => setFavorites(new Set(favoritesCache));
        globalListeners.add(handleStoreChange);
        window.addEventListener(NAVIGATION_IDENTITY_EVENT, identityChanged);
        handleStoreChange();
        if (!isInitialized) { isInitialized = true; void refreshFavorites(); }
        return () => {
            globalListeners.delete(handleStoreChange);
            if (!globalListeners.size) {
                window.removeEventListener(NAVIGATION_IDENTITY_EVENT, identityChanged);
                readVersion++;
                readController?.abort();
                favoritesCache.clear();
                favoritesAuthenticated = false;
                favoritesStatus = "idle";
                isInitialized = false;
                identityVersion++;
            }
        };
    }, []);

    const toggleFavorite = useCallback(async (listingId: string, options?: { listingType?: "rent" | "sale" }) => {
        if (favoritesStatus === "loading" || favoritesStatus === "idle") { toast.info("Saved homes are still loading. Try again shortly."); return false; }
        if (favoritesStatus === "error") {
            toast.error("Saved homes could not be loaded. Try again.", { action: { label: "Try again", onClick: () => void refreshFavorites() } });
            return false;
        }
        if (!favoritesAuthenticated) {
            toast.error('Sign in required', {
                description: 'Please sign in to save properties.',
                action: {
                    label: 'Sign in',
                    onClick: () => {
                        const currentPath = `${window.location.pathname}${window.location.search}`;
                        router.push(authPathForRedirect(currentPath));
                    },
                },
            });
            return false;
        }

        const isFav = favoritesCache.has(listingId);
        const identity = identityVersion;
        const mutation = (mutationVersions.get(listingId) ?? 0) + 1;
        mutationVersions.set(listingId, mutation);
        const current = () => identity === identityVersion && mutationVersions.get(listingId) === mutation;
        readVersion++;
        readController?.abort();

        // Optimistic update
        if (isFav) {
            favoritesCache.delete(listingId);
        } else {
            favoritesCache.add(listingId);
        }
        emitChange();

        try {
            if (isFav) {
                await withFavoriteMutationTimeout(
                    fetch(`/api/favorites?listingId=${encodeURIComponent(listingId)}`, { method: "DELETE" }).then((response) => {
                        if (!response.ok) throw new Error("favorite_delete_failed");
                        return response;
                    }),
                );
                if (!current()) return false;
                toast.success('Removed from saved properties');
            } else {
                await withFavoriteMutationTimeout(
                    fetch("/api/favorites", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ listingId, listingType: options?.listingType }),
                    }).then((response) => {
                        if (!response.ok) throw new Error("favorite_insert_failed");
                        return response;
                    }),
                );
                if (!current()) return false;
                toast.success('Home saved', {
                    description: 'Added to your shortlist.',
                    action: {
                        label: 'View saved homes',
                        onClick: () => router.push('/saved'),
                    },
                });
            }
            return true;
        } catch (error) {
            if (!current()) return false;
            if (isFav) {
                favoritesCache.add(listingId);
            } else {
                favoritesCache.delete(listingId);
            }
            emitChange();
            const message = error instanceof FavoriteMutationTimeoutError
                ? 'Saved state could not be confirmed within 2 seconds.'
                : isFav
                    ? 'Failed to remove from favorites'
                    : 'Failed to save property';
            toast.error(message);
            return false;
        }
    }, [router]);

    return {
        favorites,
        isLoading: favoritesStatus === "idle" || favoritesStatus === "loading",
        error: favoritesStatus === "error",
        // Display identity is independent of this optional data read. Server
        // actions and RLS still verify every protected operation themselves.
        authenticated: account.isAuthenticated || favoritesAuthenticated,
        isFavorite: (listingId: string) => favorites.has(listingId),
        toggleFavorite
    };
}
