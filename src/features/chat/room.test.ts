import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { buildEmbedUrl, buildJoinUrl, buildRoomId } from "./room";

const JITSI_PREFIX = "https://meet.jit.si/";
const ROOM_PREFIX = "roomza-call-";

// A UUID-shaped arbitrary so dash-stripping is exercised realistically.
const arbUuid = fc.uuid();

describe("room: buildRoomId", () => {
    // Property 5 (part): deterministic + well-formed.
    it("P5 is deterministic and prefixed with no remaining dashes", () => {
        fc.assert(
            fc.property(arbUuid, (id) => {
                const room = buildRoomId(id);
                expect(buildRoomId(id)).toBe(room);
                expect(room.startsWith(ROOM_PREFIX)).toBe(true);
                expect(room.slice(ROOM_PREFIX.length).includes("-")).toBe(false);
            }),
        );
    });

    // Property 5 (part): unique-preserving.
    it("P5 distinct session ids yield distinct room ids", () => {
        fc.assert(
            fc.property(arbUuid, arbUuid, (a, b) => {
                fc.pre(a !== b);
                expect(buildRoomId(a)).not.toBe(buildRoomId(b));
            }),
        );
    });

    it("strips dashes from a concrete uuid", () => {
        expect(buildRoomId("11111111-2222-3333-4444-555555555555")).toBe(
            "roomza-call-11111111222233334444555555555555",
        );
    });
});

describe("room: buildJoinUrl", () => {
    it("P5 starts with the jitsi base and ends with the room id", () => {
        fc.assert(
            fc.property(arbUuid, (id) => {
                const room = buildRoomId(id);
                const url = buildJoinUrl(room);
                expect(url.startsWith(JITSI_PREFIX)).toBe(true);
                expect(url.endsWith(room)).toBe(true);
                expect(url).toBe(`${JITSI_PREFIX}${room}`);
            }),
        );
    });
});

describe("room: buildEmbedUrl", () => {
    // Property 6: the embed url preserves the join target as a prefix.
    it("P6 preserves the join url as a prefix", () => {
        fc.assert(
            fc.property(arbUuid, (id) => {
                const joinUrl = buildJoinUrl(buildRoomId(id));
                expect(buildEmbedUrl(joinUrl).startsWith(joinUrl)).toBe(true);
            }),
        );
    });

    it("appends the shared prejoin/deeplink config flags", () => {
        const joinUrl = "https://meet.jit.si/roomza-call-abc";
        const embed = buildEmbedUrl(joinUrl);
        expect(embed).toBe(
            `${joinUrl}#config.prejoinPageEnabled=false&config.disableDeepLinking=true`,
        );
    });
});
