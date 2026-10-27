
let rows = [], selected = "ALL";
const $ = id => document.getElementById(id);

function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function normalize(ranks, names) {
    return Object.entries(ranks || {}).map(([id, v]) => ({
        id: String(id),
        name: (names || {})[String(id)] ||
            (typeof v === "string" ? id :
                (v?.name || v?.username || v?.player_name || id)),
        rank: typeof v === "string" ? v :
            (v?.rank || v?.tier || v?.rank_name || "UNRANKED")
    }));
}

function getMateId(id, teams) {
    const v = (teams || {})[String(id)];

    if (typeof v === "string" || typeof v === "number") {
        return String(v);
    }

    if (v && typeof v === "object" &&
        v.teammate !== undefined && v.teammate !== null) {
        return String(v.teammate);
    }

    return "";
}

function getMateName(id, teams, names) {
    const mateId = getMateId(id, teams);
    if (!mateId) return "";

    const v = (teams || {})[String(id)];

    if (v && typeof v === "object") {
        const explicitName = v.teammate_name || v.partner_name;
        if (explicitName) return String(explicitName);
    }

    const nameKey = Object.keys(names || {}).find(
        key => String(key) === String(mateId)
    );

    return nameKey && names[nameKey]
        ? String(names[nameKey])
        : mateId;
}


$("searchInput").addEventListener("input", render);

$("filters").addEventListener("click", e => {
    const b = e.target.closest("button[data-tier]");
    if (!b) return;

    selected = b.dataset.tier;

    document.querySelectorAll("#filters button").forEach(x =>
        x.classList.toggle("active", x === b)
    );

    render();
});

load();
setInterval(load, 30000);
