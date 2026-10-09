type Relation<T> = T | T[] | null;
type Share = {
  grantee_id: string | null;
  application: Relation<{ listing: Relation<{ landlord_id: string }> }>;
};
const rows = <T>(value: Relation<T>): T[] => value === null ? [] : Array.isArray(value) ? value : [value];
/** PostgREST many-to-one embeds are objects; accept array fixtures and missing relations too. */
export function canOpenDocumentShare(shares: Share[], userId: string) {
  return shares.some(share => share.grantee_id === userId || rows(share.application).some(
    application => rows(application.listing).some(listing => listing.landlord_id === userId),
  ));
}
