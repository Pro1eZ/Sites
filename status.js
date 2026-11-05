const API = "https://api.trailrig.app/v1/status";

function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function fmt(ms) {
    if (!ms) return "—";
    return new Date(ms).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short"
    });
}

function badge(text, type) {
    const span = document.createElement("span");
    span.className = "badge badge-" + type;
    span.textContent = text;
    return span;
}

function makeCardRow(labelText, subText, rightEl) {
    const row = document.createElement("div");
    row.className = "card-row";

    const left = document.createElement("div");
    const lbl = document.createElement("div");
    lbl.className = "card-label";
    lbl.textContent = labelText;
    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = subText;
    left.append(lbl, sub);

    const right = document.createElement("div");
    right.className = "card-right";
    if (Array.isArray(rightEl)) rightEl.forEach(el => right.append(el));
    else right.append(rightEl);

    row.append(left, right);
    return row;
}

function sectionTitle(text) {
    const el = document.createElement("div");
    el.className = "section-title";
    el.textContent = text;
    return el;
}

function render(data) {
    const root = document.getElementById("root");
    root.textContent = "";

    // BUY-PARTS-PAUSED: stale feed alert banner removed until partner store onboarded.
    // const staleFeeds = Object.entries(data.feeds || {}).filter(([, f]) => f.stale);
    // if (staleFeeds.length > 0) { ... }

    // Overall status — based on KV availability, not feed staleness
    const allOk = data.kvAvailable && data.eventsKvAvailable && data.bikeRegistryAvailable;
    const overall = document.createElement("div");
    overall.className = "overall";
    const dot = document.createElement("div");
    dot.className = "overall-dot";
    dot.style.background = allOk ? "var(--green)" : "var(--yellow)";
    const overallText = document.createElement("div");
    const overallLabel = document.createElement("div");
    overallLabel.className = "overall-label";
    overallLabel.textContent = allOk ? "All systems operational" : "Degraded — check KV bindings";
    const overallSub = document.createElement("div");
    overallSub.className = "overall-sub";
    overallSub.textContent = "KV storage: " + (data.kvAvailable ? "Available" : "Unavailable") + " · Environment: " + (data.environment || "—");
    overallText.append(overallLabel, overallSub);
    overall.append(dot, overallText);
    root.append(overall);

    // BUY-PARTS-PAUSED: Product Feeds section removed until partner store onboarded.
    // root.append(sectionTitle("Product Feeds"));
    // ...

    // BUY-PARTS-PAUSED: Stores section removed until partner store onboarded.
    // root.append(sectionTitle("Stores"));
    // ...

    // Infrastructure
    root.append(sectionTitle("Infrastructure"));
    const infraCard = document.createElement("div");
    infraCard.className = "card";
    infraCard.append(makeCardRow("KV Storage", "SEARCH_CACHE binding", badge(data.kvAvailable ? "Available" : "Unavailable", data.kvAvailable ? "green" : "red")));
    infraCard.append(makeCardRow("Events KV", "EVENTS_KV binding", badge(data.eventsKvAvailable ? "Available" : "Unavailable", data.eventsKvAvailable ? "green" : "red")));
    infraCard.append(makeCardRow("Events Backup", "EVENTS_BACKUP R2 bucket", badge(data.eventsBackupAvailable ? "Available" : "Unavailable", data.eventsBackupAvailable ? "green" : "red")));
    infraCard.append(makeCardRow("Bike Registry KV", "BIKE_REGISTRY_KV binding", badge(data.bikeRegistryAvailable ? "Available" : "Unavailable", data.bikeRegistryAvailable ? "green" : "red")));
    infraCard.append(makeCardRow("Bike Registry Backup", "R2 bucket", badge(data.bikeRegistryBackupAvailable ? "Available" : "Unavailable", data.bikeRegistryBackupAvailable ? "green" : "red")));
    root.append(infraCard);

    // API
    root.append(sectionTitle("API"));
    const apiCard = document.createElement("div");
    apiCard.className = "card";
    apiCard.append(makeCardRow("Search API", "", badge("Operational", "green")));
    apiCard.append(makeCardRow("Status API", "", badge("Operational", "green")));
    root.append(apiCard);

    document.getElementById("updated-at").textContent = "Last checked: " + fmt(data.checkedAt);
    const refresh = document.createElement("a");
    refresh.href = "#";
    refresh.textContent = "Refresh";
    refresh.style.marginLeft = "6px";
    refresh.style.color = "var(--purple)";
    refresh.onclick = (e) => { e.preventDefault(); load(); };
    document.getElementById("updated-at").append(" · ", refresh);
}

async function load() {
    try {
        const res = await fetch(API);
        if (!res.ok) throw new Error("HTTP " + res.status);
        render(await res.json());
    } catch {
        // Fallback when the status API itself is unreachable (H10). Don't leave a bare error —
        // explain what it means (the check couldn't run; the app may still be fine) and give a
        // working Retry action instead of a dead page.
        const root = document.getElementById("root");
        root.textContent = "";
        const err = document.createElement("div");
        err.className = "error-box";
        const line1 = document.createElement("p");
        line1.style.margin = "0 0 8px";
        line1.textContent = "We couldn't reach the status service just now.";
        const line2 = document.createElement("p");
        line2.style.margin = "0 0 12px";
        line2.style.opacity = "0.8";
        line2.textContent = "This checks the backend from your browser, so a network hiccup here doesn't necessarily mean TrailRig is down. Try again in a moment.";
        const retry = document.createElement("a");
        retry.href = "#";
        retry.textContent = "Retry";
        retry.style.color = "var(--purple)";
        retry.onclick = (e) => { e.preventDefault(); load(); };
        err.append(line1, line2, retry);
        root.append(err);
        document.getElementById("updated-at").textContent = "Status check unavailable — last attempt just now.";
    }
}

load();
