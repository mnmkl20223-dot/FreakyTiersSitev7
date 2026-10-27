let rows = [];
let selected = "ALL";
const $ = id => document.getElementById(id);

function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function normalizePlayer(id, value, names) {
    const key = String(id);
    const name = (names || {})[key] ||
        (typeof value === "string" ? key :
        (value?.name || value?.username || value?.player_name || key));
    const rank = typeof value === "string" ? value :
        (value?.rank || value?.tier || value?.rank_name || "UNRANKED");
    return { id: key, name: String(name), rank: String(rank).toUpperCase() };
}

function normalizeData(data) {
    const ranks = data.ranks || {};
    const names = data.player_names || {};
    const teams = data.teams || {};
    const players = Object.entries(ranks).map(([id, value]) =>
        normalizePlayer(id, value, names)
    );
    const playerById = new Map(players.map(p => [p.id, p]));
    const pairedIds = new Set();
    const output = [];
    const emittedPairs = new Set();

    // Aggregate /setteamrank records look like:
    // "playerId_playerId": { players: [id1, id2], rank: "LT3" }
    for (const [teamKey, team] of Object.entries(teams)) {
        if (!team || typeof team !== "object" || !Array.isArray(team.players) ||
            team.players.length < 2) continue;

        const ids = team.players.slice(0, 2).map(String);
        if (ids[0] === ids[1]) continue;
        const pairKey = ids.slice().sort().join("|");
        if (emittedPairs.has(pairKey)) continue;
        emittedPairs.add(pairKey);
        ids.forEach(id => pairedIds.add(id));

        const p1 = playerById.get(ids[0]);
        const p2 = playerById.get(ids[1]);
        const name1 = p1?.name || names[ids[0]] || ids[0];
        const name2 = p2?.name || names[ids[1]] || ids[1];
        const rank = String(team.rank || team.tier || "UNRANKED").toUpperCase();

        output.push({
            id: pairKey,
            name: String(name1),
            teammate: String(name2),
            teammateId: ids[1],
            rank,
            type: "DUO",
            status: "Последняя протестированная пара"
        });
    }

    // Fallback for older data formats where teams only has reciprocal
    // per-player entries with a teammate field, but no aggregate pair record.
    for (const p of players) {
        if (pairedIds.has(p.id)) continue;
        const entry = teams[p.id];
        let mateId = "";
        let mateName = "";

        if (typeof entry === "string" || typeof entry === "number") {
            mateId = String(entry);
        } else if (entry && typeof entry === "object" &&
                   entry.teammate !== undefined && entry.teammate !== null) {
            mateId = String(entry.teammate);
            mateName = entry.teammate_name || entry.partner_name || "";
        }

        if (mateId && playerById.has(mateId)) {
            const pairKey = [p.id, mateId].sort().join("|");
            if (emittedPairs.has(pairKey)) {
                pairedIds.add(p.id);
                pairedIds.add(mateId);
                continue;
            }
            emittedPairs.add(pairKey);
            pairedIds.add(p.id);
            pairedIds.add(mateId);
            const mate = playerById.get(mateId);
            output.push({
                id: pairKey,
                name: p.name,
                teammate: String(mateName || mate.name),
                teammateId: mateId,
                rank: p.rank,
                type: "DUO",
                status: "Последняя протестированная пара"
            });
        }
    }

    // Only players not represented by any duo become SOLO rows.
    for (const p of players) {
        if (pairedIds.has(p.id)) continue;
        output.push({
            ...p,
            teammate: "",
            teammateId: "",
            type: "SOLO",
            status: "Нет напарника"
        });
    }

    return output;
}

function render() {
    const search = $("searchInput").value.trim().toLowerCase();
    const order = [
        "HT1", "LT1", "HT2", "LT2", "HT3",
        "LT3", "HT4", "LT4", "HT5", "LT5"
    ];

    const list = rows.filter(p =>
        (selected === "ALL" || p.rank === selected) &&
        (p.name.toLowerCase().includes(search) ||
         p.teammate.toLowerCase().includes(search))
    ).sort((a, b) =>
        ((order.indexOf(a.rank) < 0 ? 99 : order.indexOf(a.rank)) -
         (order.indexOf(b.rank) < 0 ? 99 : order.indexOf(b.rank))) ||
        a.name.localeCompare(b.name)
    );

    $("players").innerHTML = list.length
        ? list.map(p => `
            <tr>
                <td><span class="player">${esc(p.name)}${p.teammate
                    ? ` <span class="plus">+</span> ${esc(p.teammate)}`
                    : ""}</span></td>
                <td><span class="tier tier-${/^[HL]T[1-5]$/.test(p.rank) ? p.rank : ""}">${esc(p.rank)}</span></td>
                <td>${p.teammate
                    ? '<span class="team">● DUO</span>'
                    : '<span class="muted">SOLO</span>'}</td>
                <td><span class="muted">${esc(p.status)}</span></td>
            </tr>
        `).join("")
        : '<tr><td colspan="4" class="empty">Игроки не найдены</td></tr>';

    $("resultCount").textContent = `${list.length} команд и игроков`;
}

async function load() {
    try {
        const response = await fetch("/api/ranks", { cache: "no-store" });
        if (!response.ok) throw Error("HTTP " + response.status);

        const data = await response.json();
        rows = normalizeData(data);

        $("playerCount").textContent = Object.keys(data.ranks || {}).length;
        $("teamCount").textContent = rows.filter(p => p.teammate).length;

        const date = new Date(data.updated_at);
        $("lastUpdated").textContent = isNaN(date.getTime())
            ? "—"
            : date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

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
