import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-pekka-discovery-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
        },
    });
}

function apiResponse(status: number, data: unknown) {
    return jsonResponse({ status, data });
}

function cleanTag(value: string) {
    return value.replace(/^#/, "").toUpperCase();
}

async function sha256(value: string) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

// ==========================================
// UNICODE NAME NORMALIZATION
// ==========================================

const SMALL_CAPS_FROM = Array.from(
    "ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ"
);

const SMALL_CAPS_TO = Array.from(
    "abcdefghijklmnopqrstuvwxyz"
);

/* Index coverage changes slowly; cache it for a minute so typing a name does
   not run two extra count queries per keystroke. */
let indexStatsCache: {
    at: number;
    total: number | null;
    newest: string | null;
} | null = null;

const SMALL_CAPS_MAP = new Map(
    SMALL_CAPS_FROM.map((char, index) => [
        char,
        SMALL_CAPS_TO[index],
    ])
);

function normalizeFull(value: string): string {
    const converted = Array.from(value, (char) =>
        SMALL_CAPS_MAP.get(char) || char
    ).join("");

    return converted
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLocaleLowerCase();
}

function normalizeText(value: string): string {
    return normalizeFull(value)
        .replace(/[^\p{L}\p{N}]/gu, "");
}

// ==========================================
// SIMILAR NAME MATCHING
// ==========================================

function editDistance(a: string, b: string): number {
    const aa = Array.from(a);
    const bb = Array.from(b);

    const previous = Array.from(
        { length: bb.length + 1 },
        (_, i) => i
    );

    for (let i = 1; i <= aa.length; i++) {
        let diagonal = previous[0];
        previous[0] = i;

        for (let j = 1; j <= bb.length; j++) {
            const old = previous[j];

            const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;

            previous[j] = Math.min(
                previous[j] + 1,
                previous[j - 1] + 1,
                diagonal + cost
            );

            diagonal = old;
        }
    }

    return previous[bb.length];
}

function similarName(a: string, b: string): number | null {
    if (!a || !b || a.length < 3 || b.length < 3) {
        return null;
    }

    const maxDistance = a.length >= 8 ? 2 : 1;

    if (Math.abs(a.length - b.length) > maxDistance + 2) {
        return null;
    }

    let best = Infinity;

    const minLength = Math.max(1, a.length - maxDistance);
    const maxLength = Math.min(b.length, a.length + maxDistance);

    for (let size = minLength; size <= maxLength; size++) {
        for (let start = 0; start + size <= b.length; start++) {
            const candidate = b.slice(start, start + size);
            const distance = editDistance(a, candidate);

            if (distance < best) {
                best = distance;
            }

            if (best === 0) {
                return 0;
            }
        }
    }

    return best <= maxDistance ? best : null;
}

// ==========================================
// MAIN EDGE FUNCTION
// ==========================================

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: corsHeaders,
        });
    }

    if (req.method !== "POST") {
        return jsonResponse({
            error: "Method not allowed",
        }, 405);
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const cocToken = Deno.env.get("COC_API_TOKEN");

        if (!supabaseUrl || !serviceKey) {
            return jsonResponse({
                error: "Server database credentials are missing. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            }, 500);
        }

        const supabase = createClient(
            supabaseUrl,
            serviceKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            }
        );

        // ==========================================
        // RATE LIMITING
        // ==========================================

        const ip =
            req.headers.get("cf-connecting-ip") ||
            req.headers.get("x-real-ip") ||
            req.headers.get("x-forwarded-for")
                ?.split(",")[0]
                ?.trim() ||
            "unknown";

        const ipHash = await sha256(ip);

        const { data: allowed, error: rateError } =
            await supabase.rpc("consume_coc_api_rate_limit", {
                p_ip_hash: ipHash,
                p_limit: 80,
                p_window_seconds: 60,
            });

        if (rateError) {
            console.error(
                "Rate-limit check failed:",
                rateError.message
            );

            return jsonResponse({
                error: "Search service is temporarily unavailable.",
            }, 503);
        }

        if (!allowed) {
            return jsonResponse({
                error: "Too many searches. Please wait a minute and try again.",
            }, 429);
        }

        const body = await req.json();

        // ==========================================
        // API CONFIGURATION
        // ==========================================

        const apiBase = "https://cocproxy.royaleapi.dev/v1";

        const cocHeaders = cocToken
            ? {
                Authorization: `Bearer ${cocToken}`,
                Accept: "application/json",
            }
            : null;

        // ==========================================
        // CLAN DATABASE HELPERS
        // ==========================================

        function toClanRecord(clan: any) {
            if (
                !clan ||
                typeof clan.tag !== "string" ||
                typeof clan.name !== "string"
            ) {
                return null;
            }

            return {
                clan_tag: cleanTag(clan.tag),
                name: clan.name.slice(0, 80),

                clan_type:
                    typeof clan.type === "string"
                        ? clan.type
                        : null,

                description:
                    typeof clan.description === "string"
                        ? clan.description.slice(0, 500)
                        : null,

                location_id:
                    clan.location &&
                    Number.isInteger(clan.location.id)
                        ? clan.location.id
                        : null,

                location_name:
                    typeof clan.location?.name === "string"
                        ? clan.location.name.slice(0, 100)
                        : null,

                clan_level:
                    Number.isInteger(clan.clanLevel)
                        ? clan.clanLevel
                        : null,

                members:
                    Number.isInteger(clan.members)
                        ? clan.members
                        : null,

                clan_points:
                    Number.isInteger(clan.clanPoints)
                        ? clan.clanPoints
                        : null,

                required_trophies:
                    Number.isInteger(clan.requiredTrophies)
                        ? clan.requiredTrophies
                        : null,

                required_town_hall_level:
                    Number.isInteger(clan.requiredTownhallLevel)
                        ? clan.requiredTownhallLevel
                        : null,

                badge_url:
                    typeof clan.badgeUrls?.medium === "string"
                        ? clan.badgeUrls.medium
                        : (
                            typeof clan.badgeUrls?.small === "string"
                                ? clan.badgeUrls.small
                                : null
                        ),

                updated_at: new Date().toISOString(),
            };
        }

        async function saveClanRecords(clans: any[]) {
            const records = clans
                .map(toClanRecord)
                .filter(Boolean);

            if (!records.length) {
                return {
                    count: 0,
                    error: null,
                };
            }

            const { error } = await supabase
                .from("coc_clan_index")
                .upsert(records, {
                    onConflict: "clan_tag",
                });

            if (error) {
                console.error(
                    "Could not update clan directory:",
                    error.message
                );
            }

            return {
                count: error ? 0 : records.length,
                error,
            };
        }

        // ==========================================
        // PLAYER AND MEMBERSHIP DATABASE HELPERS
        // ==========================================

        async function saveClanMembers(
            clanTag: string,
            clanName: string | null,
            members: any[]
        ) {
            const normalizedTag = cleanTag(clanTag);

            const valid = members.filter(
                (p: any) =>
                    typeof p?.tag === "string" &&
                    typeof p?.name === "string"
            );

            const timestamp = new Date().toISOString();

            const players = valid.map((p: any) => ({
                player_tag: cleanTag(p.tag),
                name: p.name.slice(0, 80),
                search_name: normalizeText(p.name),

                town_hall_level:
                    Number.isInteger(p.townHallLevel)
                        ? p.townHallLevel
                        : null,

                trophies:
                    Number.isInteger(p.trophies)
                        ? p.trophies
                        : null,

                role:
                    typeof p.role === "string"
                        ? p.role
                        : null,

                clan_tag: normalizedTag,
                clan_name: clanName,
                updated_at: timestamp,
            }));

            const memberships = valid.map((p: any) => ({
                player_tag: cleanTag(p.tag),
                clan_tag: normalizedTag,
                clan_name: clanName,
                player_name: p.name.slice(0, 80),

                role:
                    typeof p.role === "string"
                        ? p.role
                        : null,

                town_hall_level:
                    Number.isInteger(p.townHallLevel)
                        ? p.townHallLevel
                        : null,

                trophies:
                    Number.isInteger(p.trophies)
                        ? p.trophies
                        : null,

                updated_at: timestamp,
            }));

            if (!players.length) {
                return {
                    count: 0,
                    error: null,
                };
            }

            const playerSave = await supabase
                .from("coc_player_index")
                .upsert(players, {
                    onConflict: "player_tag",
                });

            if (playerSave.error) {
                console.error(
                    "Player directory upsert failed:",
                    playerSave.error.message
                );

                return {
                    count: 0,
                    error: playerSave.error,
                };
            }

            const membershipSave = await supabase
                .from("coc_player_clan_memberships")
                .upsert(memberships, {
                    onConflict: "player_tag,clan_tag",
                });

            if (membershipSave.error) {
                console.error(
                    "Clan membership upsert failed:",
                    membershipSave.error.message
                );

                return {
                    count: players.length,
                    error: membershipSave.error,
                };
            }

            return {
                count: players.length,
                error: null,
            };
        }

        /* A player opened by tag is a verified player record, so keep it.
           This is the missing source that made name search look broken: the
           index used to grow only when someone opened a clan's member list. */
        async function indexPlayerProfile(profile: any) {
            if (
                !profile ||
                typeof profile.tag !== "string" ||
                typeof profile.name !== "string"
            ) {
                return null;
            }

            const record: Record<string, unknown> = {
                player_tag: cleanTag(profile.tag),
                name: profile.name.slice(0, 80),
                search_name: normalizeText(profile.name),

                town_hall_level:
                    Number.isInteger(profile.townHallLevel)
                        ? profile.townHallLevel
                        : null,

                trophies:
                    Number.isInteger(profile.trophies)
                        ? profile.trophies
                        : null,

                updated_at: new Date().toISOString(),
            };

            if (
                profile.clan &&
                typeof profile.clan.tag === "string"
            ) {
                record.clan_tag = cleanTag(profile.clan.tag);
                record.clan_name =
                    typeof profile.clan.name === "string"
                        ? profile.clan.name
                        : null;
            }

            const { error } = await supabase
                .from("coc_player_index")
                .upsert([record], {
                    onConflict: "player_tag",
                });

            if (error) {
                console.error(
                    "Player profile index upsert failed:",
                    error.message
                );
                return null;
            }

            return record.player_tag as string;
        }

        // ==========================================
        // OFFICIAL API REQUEST HELPER
        // ==========================================

        async function cocGet(path: string) {
            if (!cocHeaders) {
                throw new Error(
                    "COC_API_TOKEN is not configured."
                );
            }

            const response = await fetch(
                apiBase + path,
                {
                    method: "GET",
                    headers: cocHeaders,
                }
            );

            const raw = await response.text();

            let data: any;

            try {
                data = raw ? JSON.parse(raw) : {};
            } catch {
                data = {
                    message: raw,
                };
            }

            return {
                response,
                data,
            };
        }

        // ==========================================
        // DISCOVERY AUTHORIZATION
        // ==========================================

        function discoveryAuthorized() {
            const expected =
                Deno.env.get("PEKKADEX_DISCOVERY_KEY") || "";

            const supplied =
                req.headers.get("x-pekka-discovery-key") || "";

            return (
                expected.length >= 24 &&
                supplied.length === expected.length &&
                supplied === expected
            );
        }

        // ==========================================
        // PUBLIC CLAN SEARCH
        // ==========================================

        if (body?.action === "findClans") {
            if (!cocToken) {
                return jsonResponse({
                    error: "Server API token is missing. Configure COC_API_TOKEN.",
                }, 500);
            }

            const rawName =
                typeof body.name === "string"
                    ? body.name
                    : typeof body.query === "string"
                        ? body.query
                        : "";

            const name = normalizeFull(rawName)
                .replace(/[^\p{L}\p{N}\s'-]/gu, "")
                .trim()
                .replace(/\s+/g, " ");

            if (name.length < 2 || name.length > 30) {
                return apiResponse(400, {
                    items: [],
                    message: "Clan name search must be 2 to 30 characters.",
                });
            }

            const limit = Number.isInteger(Number(body.limit))
                ? Math.max(1, Math.min(50, Number(body.limit)))
                : 20;

            const params = new URLSearchParams({
                name,
                limit: String(limit),
            });

            const optionalFilters: Array<
                [string, number, number]
            > = [
                ["minClanLevel", 1, 50],
                ["minMembers", 1, 50],
                ["maxMembers", 1, 50],
                ["minClanPoints", 0, 100000],
                ["locationId", 1, 999999],
            ];

            for (const [key, min, max] of optionalFilters) {
                if (
                    body[key] !== undefined &&
                    body[key] !== null &&
                    body[key] !== ""
                ) {
                    const value = Number(body[key]);

                    if (
                        !Number.isInteger(value) ||
                        value < min ||
                        value > max
                    ) {
                        return apiResponse(400, {
                            items: [],
                            message: `Invalid ${key} filter.`,
                        });
                    }

                    params.set(key, String(value));
                }
            }

            try {
                const { response, data } = await cocGet(
                    `/clans?${params.toString()}`
                );

                if (
                    response.ok &&
                    Array.isArray(data?.items)
                ) {
                    const saved = await saveClanRecords(data.items);

                    return apiResponse(response.status, {
                        ...data,
                        directory_saved: saved.count,

                        directory_save_warning: saved.error
                            ? "Clan results were returned but could not be cached."
                            : null,
                    });
                }

                return apiResponse(response.status, data);
            } catch (error) {
                console.error(
                    "Public clan search failed:",
                    error
                );

                return jsonResponse({
                    error: "Could not search clans right now.",
                }, 502);
            }
        }

        // ==========================================
        // PUBLIC CLAN MEMBER LOOKUP
        // ==========================================

        if (body?.action === "getClanMembers") {
            if (!cocToken) {
                return jsonResponse({
                    error: "Server API token is missing. Configure COC_API_TOKEN.",
                }, 500);
            }

            const rawTag =
                typeof body.clanTag === "string"
                    ? body.clanTag.trim()
                    : "";

            if (!/^#?[A-Za-z0-9]{3,15}$/.test(rawTag)) {
                return apiResponse(400, {
                    items: [],
                    message: "Invalid clan tag.",
                });
            }

            const clanTag = cleanTag(rawTag);

            try {
                const [
                    clanResult,
                    memberResult,
                ] = await Promise.all([
                    cocGet(
                        `/clans/${encodeURIComponent("#" + clanTag)}`
                    ),

                    cocGet(
                        `/clans/${encodeURIComponent("#" + clanTag)}/members?limit=50`
                    ),
                ]);

                if (!memberResult.response.ok) {
                    return apiResponse(
                        memberResult.response.status,
                        memberResult.data
                    );
                }

                const clanName =
                    typeof clanResult.data?.name === "string"
                        ? clanResult.data.name
                        : null;

                if (clanResult.response.ok) {
                    await saveClanRecords([
                        clanResult.data,
                    ]);
                }

                const saved = await saveClanMembers(
                    clanTag,
                    clanName,
                    Array.isArray(memberResult.data?.items)
                        ? memberResult.data.items
                        : []
                );

                return apiResponse(
                    memberResult.response.status,
                    {
                        ...memberResult.data,
                        directory_saved: saved.count,

                        directory_save_warning: saved.error
                            ? "Members were returned but one or more directory tables could not be updated."
                            : null,
                    }
                );
            } catch (error) {
                console.error(
                    "Clan member lookup failed:",
                    error
                );

                return jsonResponse({
                    error: "Could not load clan members right now.",
                }, 502);
            }
        }

        // ==========================================
        // ADMIN CLAN DISCOVERY
        // ==========================================

        if (body?.action === "discoverClans") {
            if (!Deno.env.get("PEKKADEX_DISCOVERY_KEY")) {
                return jsonResponse({
                    error: "Discovery is disabled. Configure PEKKADEX_DISCOVERY_KEY first.",
                }, 503);
            }

            if (!discoveryAuthorized()) {
                return jsonResponse({
                    error: "Forbidden: admin discovery key required.",
                }, 403);
            }

            if (!cocToken) {
                return jsonResponse({
                    error: "Server API token is missing. Configure COC_API_TOKEN.",
                }, 500);
            }

            const rawQueries = Array.isArray(body.queries)
                ? body.queries
                : typeof body.query === "string"
                    ? [body.query]
                    : [];

            const queryCandidates = rawQueries
                .filter((v: any) => typeof v === "string")
                .map((v: string) => v.trim())
                .filter(
                    (v: string) =>
                        v.length >= 2 &&
                        v.length <= 30
                );

            const queries = [
                ...new Set(queryCandidates),
            ].slice(0, 3);

            if (!queries.length) {
                return apiResponse(400, {
                    error: "Provide 1 to 3 clan-name queries (2–30 characters).",
                });
            }

            const clans = new Map<string, any>();
            const errors: string[] = [];

            for (const query of queries) {
                try {
                    const { response, data } = await cocGet(
                        `/clans?${new URLSearchParams({
                            name: query,
                            limit: "20",
                        }).toString()}`
                    );

                    if (!response.ok) {
                        errors.push(
                            `Clan search '${query}' returned ${response.status}.`
                        );

                        continue;
                    }

                    for (
                        const clan of (
                            Array.isArray(data?.items)
                                ? data.items
                                : []
                        )
                    ) {
                        if (
                            typeof clan?.tag === "string" &&
                            typeof clan?.name === "string"
                        ) {
                            clans.set(
                                cleanTag(clan.tag),
                                clan
                            );
                        }
                    }
                } catch {
                    errors.push(
                        `Clan search '${query}' could not be completed.`
                    );
                }
            }

            const selected = [
                ...clans.values(),
            ].slice(0, 10);

            const clanSave = await saveClanRecords(selected);

            let memberFetches = 0;
            let indexedPlayers = 0;

            for (const clan of selected) {
                try {
                    const { response, data } = await cocGet(
                        `/clans/${encodeURIComponent(clan.tag)}/members?limit=50`
                    );

                    memberFetches++;

                    if (!response.ok) {
                        errors.push(
                            `Could not retrieve members for ${clan.name} (${response.status}).`
                        );

                        continue;
                    }

                    const saved = await saveClanMembers(
                        clan.tag,
                        clan.name,
                        Array.isArray(data?.items)
                            ? data.items
                            : []
                    );

                    indexedPlayers += saved.count;

                    if (saved.error) {
                        errors.push(
                            `Database update incomplete for ${clan.name}.`
                        );
                    }
                } catch {
                    errors.push(
                        `Member discovery failed for ${clan.name}.`
                    );
                }
            }

            return apiResponse(200, {
                searched_queries: queries,
                discovered_clans: selected.length,
                cached_clans: clanSave.count,
                member_fetches: memberFetches,
                indexed_player_rows: indexedPlayers,
                errors,

                limitation:
                    "This expands the shared directory from clans discoverable through the official API. It is not a complete global list of every player or clan.",
            });
        }

        // ==========================================
        // ADMIN RANKED CLAN DISCOVERY
        // ==========================================

        if (body?.action === "discoverRankedClans") {
            if (!Deno.env.get("PEKKADEX_DISCOVERY_KEY")) {
                return jsonResponse({
                    error: "Discovery is disabled. Configure PEKKADEX_DISCOVERY_KEY first.",
                }, 503);
            }

            if (!discoveryAuthorized()) {
                return jsonResponse({
                    error: "Forbidden: admin discovery key required.",
                }, 403);
            }

            if (!cocToken) {
                return jsonResponse({
                    error: "Server API token is missing. Configure COC_API_TOKEN.",
                }, 500);
            }

            const locationId =
                body.locationId === undefined ||
                body.locationId === "global"
                    ? "global"
                    : String(body.locationId);

            if (!/^(global|[0-9]{1,6})$/.test(locationId)) {
                return apiResponse(400, {
                    error: "Invalid locationId.",
                });
            }

            const limit = Number.isInteger(Number(body.limit))
                ? Math.max(1, Math.min(20, Number(body.limit)))
                : 10;

            try {
                const { response, data } = await cocGet(
                    `/locations/${encodeURIComponent(locationId)}/rankings/clans?limit=${limit}`
                );

                if (!response.ok) {
                    return apiResponse(response.status, data);
                }

                const selected = (
                    Array.isArray(data?.items)
                        ? data.items
                        : []
                )
                    .filter((c: any) => c?.tag && c?.name)
                    .slice(0, limit);

                const clanSave = await saveClanRecords(selected);

                let memberFetches = 0;
                let indexedPlayers = 0;

                const errors: string[] = [];

                for (const clan of selected) {
                    try {
                        const result = await cocGet(
                            `/clans/${encodeURIComponent(clan.tag)}/members?limit=50`
                        );

                        memberFetches++;

                        if (!result.response.ok) {
                            errors.push(
                                `${clan.name}: member fetch ${result.response.status}`
                            );

                            continue;
                        }

                        const saved = await saveClanMembers(
                            clan.tag,
                            clan.name,
                            Array.isArray(result.data?.items)
                                ? result.data.items
                                : []
                        );

                        indexedPlayers += saved.count;

                        if (saved.error) {
                            errors.push(
                                `${clan.name}: database update incomplete`
                            );
                        }
                    } catch {
                        errors.push(
                            `${clan.name}: member fetch failed`
                        );
                    }
                }

                return apiResponse(200, {
                    location_id: locationId,
                    ranked_clans_seen: selected.length,
                    cached_clans: clanSave.count,
                    member_fetches: memberFetches,
                    indexed_player_rows: indexedPlayers,
                    errors,

                    limitation:
                        "Rankings are only one discovery source; this does not represent every clan or player.",
                });
            } catch (error) {
                console.error(
                    "Ranked clan discovery failed:",
                    error
                );

                return jsonResponse({
                    error: "Could not complete ranked clan discovery.",
                }, 502);
            }
        }

        // ==========================================
        // ADVANCED PUBLIC PLAYER SEARCH
        // ==========================================

        if (body?.action === "findPlayers") {
            const rawName =
                typeof body.name === "string"
                    ? body.name
                    : typeof body.query === "string"
                        ? body.query
                        : "";

            const name = rawName.trim();

            const characterCount = Array.from(name).length;

            if (
                characterCount < 1 ||
                characterCount > 40
            ) {
                return apiResponse(400, {
                    items: [],
                    message: "Player name must be 1 to 40 characters.",
                });
            }

            const queryFull = normalizeFull(name);
            const queryText = normalizeText(name);

            if (!queryText) {
                return apiResponse(400, {
                    items: [],
                    message: "Enter a name containing at least one letter or number.",
                });
            }

            const th =
                body.th == null || body.th === ""
                    ? null
                    : Number(body.th);

            if (
                th !== null &&
                (
                    !Number.isInteger(th) ||
                    th < 1 ||
                    th > 20
                )
            ) {
                return apiResponse(400, {
                    items: [],
                    message: "Invalid Town Hall filter.",
                });
            }

            // One indexed query answers the whole search, so a single request
            // returns every match instead of walking the table page by page.
            const MAX_RESULTS = 1000;

            const requestedLimit = Number(body.limit);

            const resultLimit = Number.isInteger(requestedLimit)
                ? Math.max(
                    1,
                    Math.min(MAX_RESULTS, requestedLimit)
                )
                : MAX_RESULTS;

            const COLUMNS =
                "player_tag,name,search_name,town_hall_level,trophies,role,clan_tag,clan_name,updated_at";

            /* search_name is stored already folded (small caps, full-width
               letters, accents and emoji removed), so PostgREST can answer the
               name search with one index-friendly query. `name` is included in
               the filter for rows indexed before search_name existed. */
            async function nameQuery(
                wildcard: string,
                limit: number,
                offset = 0,
                exactFirst = false
            ) {
                /* exactFirst sorts by folded name, so every name equal to the
                   query comes before longer names that start with it; without
                   it the highest-trophy rows win the window. */
                let dbQuery = supabase
                    .from("coc_player_index")
                    .select(COLUMNS, { count: "exact" })
                    .or(
                        `search_name.ilike.${wildcard},name.ilike.${wildcard}`
                    )
                    .order(exactFirst ? "search_name" : "trophies", {
                        ascending: exactFirst,
                        nullsFirst: false,
                    })
                    .order("player_tag", {
                        ascending: true,
                    })
                    .range(offset, offset + limit - 1);

                if (th !== null) {
                    dbQuery = dbQuery.eq(
                        "town_hall_level",
                        th
                    );
                }

                return await dbQuery;
            }

            function scoreRow(row: any) {
                if (
                    typeof row.player_tag !== "string" ||
                    typeof row.name !== "string"
                ) {
                    return null;
                }

                const originalName = row.name;

                const fullKey = normalizeFull(originalName);
                const textKey = normalizeText(originalName);

                let matchType: string | null = null;
                let matchRank = 99;
                let similarity = 99;

                // 1. Exact original name.
                if (
                    originalName.toLocaleLowerCase() ===
                    name.toLocaleLowerCase()
                ) {
                    matchType = "Exact Match";
                    matchRank = 0;
                }

                // 2. Unicode-normalized exact match.
                else if (
                    fullKey === queryFull
                ) {
                    matchType = "Normalized Match";
                    matchRank = 1;
                }

                // 3. Ignore emoji, symbols, and spaces.
                else if (
                    textKey === queryText
                ) {
                    matchType = "Normalized Match";
                    matchRank = 2;
                }

                // 4. Name starts with the query.
                else if (
                    fullKey.startsWith(queryFull) ||
                    textKey.startsWith(queryText)
                ) {
                    matchType = "Prefix Match";
                    matchRank = 3;
                }

                // 5. Partial normalized match.
                else if (
                    fullKey.includes(queryFull)
                ) {
                    matchType = "Partial Match";
                    matchRank = 4;
                }

                // 6. Partial letters-and-numbers match.
                else if (
                    textKey.includes(queryText)
                ) {
                    matchType = "Partial Match";
                    matchRank = 5;
                }

                // 6. Similar spelling.
                else if (
                    queryText.length >= 3 &&
                    textKey.length >= 3 &&
                    Math.abs(
                        queryText.length - textKey.length
                    ) <= 4 &&
                    textKey[0] === queryText[0]
                ) {
                    const distance = similarName(
                        queryText,
                        textKey
                    );

                    if (distance !== null) {
                        matchType = "Similar Match";
                        matchRank = 6;
                        similarity = distance;
                    }
                }

                if (!matchType) {
                    return null;
                }

                /* "Only players with that exact name" must mean the folded
                   name is equal — not merely a substring of it. */
                if (body.exact === true && textKey !== queryText) {
                    return null;
                }

                return {
                    tag: row.player_tag,
                    name: originalName,
                    th: row.town_hall_level,
                    trophies: row.trophies,
                    role: row.role || "",
                    clan_tag: row.clan_tag || "",
                    clan_name: row.clan_name || "",
                    updated_at: row.updated_at || null,

                    match_type: matchType,

                    _rank: matchRank,
                    _similarity: similarity,
                };
            }

            const matches: any[] = [];

            const requestedOffset = Number(body.offset);

            const offset = Number.isInteger(requestedOffset)
                ? Math.max(0, requestedOffset)
                : 0;

            /* Typeahead asks for prefix rows only, so names that merely contain
               the query cannot crowd out the names that start with it. */
            const prefixOnly = body.prefix === true;

            const {
                data: indexedRows,
                count: matchedRows,
                error: indexError,
            } = await nameQuery(
                prefixOnly ? `${queryText}%` : `%${queryText}%`,
                resultLimit,
                offset,
                prefixOnly
            );

            if (indexError) {
                console.error(
                    "Player index search failed:",
                    indexError.message
                );

                return apiResponse(503, {
                    items: [],
                    message: "Could not search the shared player directory.",
                });
            }

            const scannedRows = indexedRows || [];

            for (const row of scannedRows) {
                const match = scoreRow(row);

                if (match) {
                    matches.push(match);
                }
            }

            /* Nothing matched the letters as typed: repeat once for names that
               start with the same letter, so a misspelling still finds them. */
            let fallbackRows = 0;

            if (!matches.length && queryText.length >= 3) {
                const first = queryText[0].replace(/[%_\\]/g, "");

                const fallback = await nameQuery(
                    `${first}%`,
                    Math.min(resultLimit, 500)
                );

                if (fallback.error) {
                    console.error(
                        "Player index fallback failed:",
                        fallback.error.message
                    );
                } else {
                    fallbackRows = (fallback.data || []).length;

                    for (const row of fallback.data || []) {
                        const match = scoreRow(row);

                        if (match) {
                            matches.push(match);
                        }
                    }
                }
            }

            // Remove duplicate player tags.
            const uniqueMatches = new Map<string, any>();

            for (const match of matches) {
                const existing = uniqueMatches.get(match.tag);

                if (
                    !existing ||
                    match._rank < existing._rank ||
                    (
                        match._rank === existing._rank &&
                        match._similarity < existing._similarity
                    )
                ) {
                    uniqueMatches.set(match.tag, match);
                }
            }

            const sortedMatches = [
                ...uniqueMatches.values(),
            ];

            // Exact matches first, similar matches last.
            sortedMatches.sort((a, b) => {
                if (a._rank !== b._rank) {
                    return a._rank - b._rank;
                }

                if (a._similarity !== b._similarity) {
                    return a._similarity - b._similarity;
                }

                return (
                    (b.trophies || 0) -
                    (a.trophies || 0)
                );
            });

            /* count from the filtered query covers the whole index, not just
               this page; when the exact filter trimmed rows, use what is left. */
            const total = body.exact === true
                ? sortedMatches.length
                : Math.max(
                    sortedMatches.length,
                    typeof matchedRows === "number"
                        ? matchedRows
                        : 0
                );

            const items = sortedMatches
                .slice(0, resultLimit)
                .map(
                    ({
                        _rank,
                        _similarity,
                        ...item
                    }) => item
                );

            // ==========================================
            // PLAYER CLAN MEMBERSHIP HISTORY
            // ==========================================

            if (items.length) {
                const tags = items.map(
                    (item: any) => item.tag
                );

                const byPlayer = new Map<string, any[]>();

                // Fetch memberships in batches.
                for (
                    let i = 0;
                    i < tags.length;
                    i += 500
                ) {
                    const batch = tags.slice(
                        i,
                        i + 500
                    );

                    const {
                        data: memberships,
                        error: membershipError,
                    } = await supabase
                        .from("coc_player_clan_memberships")
                        .select(
                            "player_tag,clan_tag,clan_name,role,updated_at"
                        )
                        .in("player_tag", batch);

                    if (membershipError) {
                        console.error(
                            "Could not load player memberships:",
                            membershipError.message
                        );

                        continue;
                    }

                    for (
                        const membership of (
                            memberships || []
                        )
                    ) {
                        const key = membership.player_tag;

                        if (!byPlayer.has(key)) {
                            byPlayer.set(key, []);
                        }

                        byPlayer.get(key)!.push(
                            membership
                        );
                    }
                }

                for (const item of items) {
                    item.clan_memberships =
                        byPlayer.get(item.tag) || [];
                }
            }

            const statsNow = Date.now();

            if (
                !indexStatsCache ||
                statsNow - indexStatsCache.at > 60_000
            ) {
                const [totalResult, newestResult] =
                    await Promise.all([
                        supabase
                            .from("coc_player_index")
                            .select("player_tag", {
                                count: "exact",
                                head: true,
                            }),

                        supabase
                            .from("coc_player_index")
                            .select("updated_at")
                            .order("updated_at", {
                                ascending: false,
                                nullsFirst: false,
                            })
                            .limit(1),
                    ]);

                indexStatsCache = {
                    at: statsNow,

                    total:
                        totalResult.error ||
                        typeof totalResult.count !== "number"
                            ? null
                            : totalResult.count,

                    newest:
                        newestResult.error
                            ? null
                            : newestResult.data?.[0]?.updated_at ??
                              null,
                };
            }

            return apiResponse(200, {
                items,
                total,

                offset,
                next_offset:
                    offset + items.length < total
                        ? offset + items.length
                        : null,

                index_total: indexStatsCache.total,
                newest_update: indexStatsCache.newest,

                scanned: scannedRows.length + fallbackRows,

                directory_matches:
                    typeof matchedRows === "number"
                        ? matchedRows
                        : null,

                result_limit: resultLimit,
                total_scope: "entire_shared_index",

                directory_scope:
                    "shared_public_index",
            });
        }

        // ==========================================
        // OFFICIAL CLASH OF CLANS API PROXY
        // ==========================================

        const path = body?.path;

        if (
            typeof path !== "string" ||
            path.length > 500 ||
            !path.startsWith("/") ||
            path.startsWith("//") ||
            path.includes("\\")
        ) {
            return jsonResponse({
                error: "Invalid API path",
            }, 400);
        }

        const target = new URL(
            path,
            "https://local.invalid"
        );

        const allowedPath =
            /^\/players\/[A-Za-z0-9%]+$/.test(
                target.pathname
            ) ||
            /^\/clans(?:\/[A-Za-z0-9%]+(?:\/members)?)?$/.test(
                target.pathname
            );

        if (
            !allowedPath ||
            target.origin !== "https://local.invalid" ||
            target.hash
        ) {
            return jsonResponse({
                error: "API path not allowed",
            }, 403);
        }

        if (!cocToken) {
            return jsonResponse({
                error: "Server API token is missing. Configure COC_API_TOKEN.",
            }, 500);
        }

        const apiUrl =
            apiBase +
            target.pathname +
            target.search;

        const response = await fetch(
            apiUrl,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${cocToken}`,
                    Accept: "application/json",
                },
            }
        );

        const responseText = await response.text();

        let data: any;

        try {
            data = responseText
                ? JSON.parse(responseText)
                : {};
        } catch {
            data = {
                message: responseText,
            };
        }

        // ==========================================
        // CACHE THE OPENED PLAYER PROFILE
        // ==========================================

        if (
            response.ok &&
            /^\/players\/[A-Za-z0-9%]+$/.test(target.pathname) &&
            typeof data?.tag === "string"
        ) {
            try {
                await indexPlayerProfile(data);
            } catch (error) {
                console.error(
                    "Could not index the opened player profile:",
                    error
                );
            }
        }

        // ==========================================
        // CACHE CLAN MEMBERS INTO PLAYER INDEX
        // ==========================================

        const memberMatch = target.pathname.match(
            /^\/clans\/([A-Za-z0-9%]+)\/members$/
        );

        if (
            response.ok &&
            memberMatch &&
            Array.isArray(data?.items)
        ) {
            let clanTag = memberMatch[1];

            try {
                clanTag = cleanTag(
                    decodeURIComponent(clanTag)
                );
            } catch {
                clanTag = cleanTag(clanTag);
            }

            const records = data.items
                .filter(
                    (p: any) =>
                        typeof p?.tag === "string" &&
                        typeof p?.name === "string"
                )
                .map((p: any) => ({
                    player_tag: cleanTag(p.tag),
                    name: p.name.slice(0, 80),
                    search_name: normalizeText(p.name),

                    town_hall_level:
                        Number.isInteger(p.townHallLevel)
                            ? p.townHallLevel
                            : null,

                    trophies:
                        Number.isInteger(p.trophies)
                            ? p.trophies
                            : null,

                    role:
                        typeof p.role === "string"
                            ? p.role
                            : null,

                    clan_tag: clanTag,

                    clan_name:
                        typeof p.clan?.name === "string"
                            ? p.clan.name
                            : null,

                    updated_at: new Date().toISOString(),
                }));

            if (records.length) {
                const {
                    error: saveError,
                } = await supabase
                    .from("coc_player_index")
                    .upsert(records, {
                        onConflict: "player_tag",
                    });

                if (saveError) {
                    console.error(
                        "Could not update player index:",
                        saveError.message
                    );
                } else {
                    const memberships = records.map(
                        (record: any) => ({
                            player_tag: record.player_tag,
                            clan_tag: clanTag,
                            clan_name: record.clan_name,
                            player_name: record.name,
                            role: record.role,
                            town_hall_level:
                                record.town_hall_level,
                            trophies: record.trophies,
                            updated_at: record.updated_at,
                        })
                    );

                    const {
                        error: membershipError,
                    } = await supabase
                        .from("coc_player_clan_memberships")
                        .upsert(memberships, {
                            onConflict: "player_tag,clan_tag",
                        });

                    if (membershipError) {
                        console.error(
                            "Could not update clan memberships:",
                            membershipError.message
                        );
                    }
                }
            }
        }

        // ==========================================
        // CACHE CLAN SEARCH RESULTS
        // ==========================================

        if (
            response.ok &&
            target.pathname === "/clans" &&
            Array.isArray(data?.items)
        ) {
            await saveClanRecords(data.items);
        } else if (
            response.ok &&
            /^\/clans\/[A-Za-z0-9%]+$/.test(
                target.pathname
            ) &&
            typeof data?.tag === "string"
        ) {
            await saveClanRecords([data]);
        }

        return apiResponse(response.status, data);
    } catch (error) {
        console.error(
            "coc function error:",
            error
        );

        return jsonResponse({
            error: "Unable to process API request.",
        }, 500);
    }
});
