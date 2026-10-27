
let rows = [];
let selected = "ALL";
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
        rank: String(
            typeof v === "string" ? v :
            (v?.rank || v?.tier || v?.rank_name || "UNRANKED")
        )
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

    if (names && names[mateId]) {
        return String(names[mateId]);
    }

    const mate = rows.find(p => p.id === mateId);
    return mate ? mate.name : mateId;
}

function pairKey(p) {
    if (!p.teammateId) return "solo:" + p.id;

    return [p.id, p.teammateId].sort().join("|");
}

function render() {
    const search = $("searchInput").value.trim().toLowerCase();

    const order = [
        "HT1", "LT1", "HT2", "LT2", "HT3",
        "LT3", "HT4", "LT4", "HT5", "LT5"
    ];

    const list = rows.filter(p =>
        (selected === "ALL" || p.rank.toUpperCase() === selected) &&
        (
            p.name.toLowerCase().includes(search) ||
            p.teammate.toLowerCase().includes(search)
        )
    ).sort((a, b) =>
        ((order.indexOf(a.rank) < 0 ? 99 : order.indexOf(a.rank)) -
         (order.indexOf(b.rank) < 0 ? 99 : order.indexOf(b.rank))) ||
        a.name.localeCompare(b.name)
    );

    const playerIds = new Set(rows.map(p => p.id));
    const seen = new Set();
    const displayRows = [];

    for (const p of list) {
    const key = p.teammateId
        ? [String(p.id), String(p.teammateId)].sort().join("|")
        : "solo:" + p.id;

    if (seen.has(key)) continue;

    seen.add(key);
    pairs.push(p);
}

    $("players").innerHTML = displayRows.length
        ? displayRows.map(p => `
            <tr>
                <td>
                    <span class="player">
                        ${esc(p.name)}
                        ${p.teammate
                            ? ` <span class="plus">+</span> ${esc(p.teammate)}`
                            : ""}
                    </span>
                </td>
                <td>
                    <span class="tier tier-${/^[HL]T[1-5]$/.test(p.rank) ? p.rank : ""}">
                        ${esc(p.rank)}
                    </span>
                </td>
                <td>
                    ${p.teammate
                        ? '<span class="team">● DUO</span>'
                        : '<span class="muted">SOLO</span>'}
                </td>
                <td>
                    ${p.teammate
                        ? '<span class="muted">Последняя протестированная пара</span>'
                        : '<span class="muted">Нет напарника</span>'}
                </td>
            </tr>
        `).join("")
        : '<tr><td colspan="4" class="empty">Игроки не найдены</td></tr>';

    $("resultCount").textContent =
        `${displayRows.length} / ${rows.length} команд и игроков`;
}

async function load() {
    try {
        const response = await fetch("/api/ranks", { cache: "no-store" });
        if (!response.ok) throw Error("HTTP " + response.status);

        const data = await response.json();
        const names = data.player_names || {};
        const teams = data.teams || {};

        rows = normalize(data.ranks, names);

        
rows.forEach(p => {
    p.teammateId = getMateId(p.id, teams);

    p.teammate = p.teammateId
        ? (names[p.teammateId] ||
           rows.find(other => other.id === p.teammateId)?.name ||
           p.teammateId)
        : "";
});

        rows.forEach(p => {
            p.teammateId = getMateId(p.id, teams);
            p.teammate = getMateName(p.id, teams, names);
        });

        $("playerCount").textContent = rows.length;

        const teamKeys = new Set();
        rows.forEach(p => {
            if (p.teammateId) teamKeys.add(pairKey(p));
        });
        $("teamCount").textContent = teamKeys.size;

        const date = new Date(data.updated_at);
        $("lastUpdated").textContent = isNaN(date.getTime())
            ? "—"
            : date.toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit"
            });

        render();
    } catch (error) {
        console.error("Ошибка загрузки рейтинга:", error);
        $("players").innerHTML =
            '<tr><td colspan="4" class="empty">Не удалось загрузить данные. Попробуйте позже.</td></tr>';
        $("lastUpdated").textContent = "Ошибка";
    }
}

$("searchInput").addEventListener("input", render);

$("filters").addEventListener("click", event => {
    const button = event.target.closest("button[data-tier]");
    if (!button) return;

    selected = button.dataset.tier;

    document.querySelectorAll("#filters button").forEach(b =>
        b.classList.toggle("active", b === button)
    );

    render();
});

load();
setInterval(load, 30000);
