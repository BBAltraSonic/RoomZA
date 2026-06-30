"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { authPathForRedirect } from '@/lib/redirects';
import { toast } from 'sonner';

const favoritesCache = new Set<string>();
let isInitialized = false;
const globalListeners = new Set<() => void>();

function emitChange() {
    globalListeners.forEach(l => l());
}

export function useFavorites() {
    const [favorites, setFavorites] = useState<Set<string>>(new Set(favoritesCache));

    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        const handleStoreChange = () => setFavorites(new Set(favoritesCache));
        globalListeners.add(handleStoreChange);

        if (!isInitialized) {
            isInitialized = true;
            void (async () => {
                try {
                    const { data, error } = await supabase.from('user_favorites').select('listing_id');
                    if (!error && data) {
                        data.forEach((d) => favoritesCache.add(d.listing_id));
                        emitChange();
                    }
                } catch {
                    toast.error('Failed to fetch saved properties');
                }
            })();
        }

        return () => {
            globalListeners.delete(handleStoreChange);
        };
    }, [supabase]);

    const toggleFavorite = useCallback(async (listingId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
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

        if (isFav) {
            const { error } = await supabase.from('user_favorites').delete().eq('listing_id', listingId).eq('user_id', user.id);
            if (error) {
                favoritesCache.add(listingId);
                emitChange();
                toast.error('Failed to remove from favorites');
            } else {
                toast.success('Removed from saved properties');
            }
        } else {
            const { error } = await supabase.from('user_favorites').insert({ listing_id: listingId, user_id: user.id });
            if (error) {
                favoritesCache.delete(listingId);
                emitChange();
                toast.error('Failed to save property');
            } else {
                toast.success('Property saved', { description: 'Added to your favorites.' });
            }
        }
    }, [supabase]);

    return {
        favorites,
        isFavorite: (listingId: string) => favorites.has(listingId),
        toggleFavorite
    };
}
