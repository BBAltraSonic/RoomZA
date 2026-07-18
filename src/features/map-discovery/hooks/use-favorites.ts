"use client";

import { useState, useEffect, useCallback } from 'react';
import { authPathForRedirect } from '@/lib/redirects';
import { toast } from 'sonner';
import { FavoriteMutationTimeoutError, withFavoriteMutationTimeout } from '@/features/listings/favorites';

const favoritesCache = new Set<string>();
let isInitialized = false;
let favoritesStatus: "idle" | "loading" | "ready" | "error" = "idle";
let favoritesAuthenticated = false;
const globalListeners = new Set<() => void>();

function emitChange() {
    globalListeners.forEach(l => l());
}

export function useFavorites() {
    const [favorites, setFavorites] = useState<Set<string>>(new Set(favoritesCache));

    useEffect(() => {
        const handleStoreChange = () => setFavorites(new Set(favoritesCache));
        globalListeners.add(handleStoreChange);

        if (!isInitialized) {
            isInitialized = true;
            favoritesStatus = "loading";
            emitChange();
            void (async () => {
                try {
                    const response = await fetch("/api/favorites", { headers: { accept: "application/json" } });
                    if (!response.ok) throw new Error("favorites_load_failed");
                    const payload = await response.json() as { data?: { authenticated?: boolean; favorites?: string[] } };
                    favoritesAuthenticated = Boolean(payload.data?.authenticated);
                    favoritesCache.clear();
                    payload.data?.favorites?.forEach((listingId) => favoritesCache.add(listingId));
                    favoritesStatus = "ready";
                    emitChange();
                } catch {
                    favoritesStatus = "error";
                    emitChange();
                    toast.error('Failed to fetch saved properties');
                }
            })();
        }

        return () => {
            globalListeners.delete(handleStoreChange);
        };
    }, []);

    const toggleFavorite = useCallback(async (listingId: string, options?: { listingType?: "rent" | "sale" }) => {
        if (!favoritesAuthenticated) {
            toast.error('Sign in required', {
                description: 'Please sign in to save properties.',
                action: {
                    label: 'Sign in',
                    onClick: () => {
                        const currentPath = `${window.location.pathname}${window.location.search}`;
                        window.location.assign(authPathForRedirect(currentPath));
                    },
                },
            });
            return;
        }

        const isFav = favoritesCache.has(listingId);

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
                toast.success('Home saved', {
                    description: 'Added to your shortlist.',
                    action: {
                        label: 'View saved homes',
                        onClick: () => window.location.assign('/saved'),
                    },
                });
            }
        } catch (error) {
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
        }
    }, []);

    return {
        favorites,
        isLoading: favoritesStatus === "idle" || favoritesStatus === "loading",
        error: favoritesStatus === "error",
        authenticated: favoritesAuthenticated,
        isFavorite: (listingId: string) => favorites.has(listingId),
        toggleFavorite
    };
}
