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

    // Stale feed alert banner — shown prominently when any required feed hasn't synced in >26h.
    const staleFeeds = Object.entries(data.feeds).filter(([, f]) => f.stale);
    if (staleFeeds.length > 0) {
        const banner = document.createElement("div");
        banner.className = "alert-banner";
        const icon = document.createElement("div");
        icon.className = "alert-banner-icon";
        icon.textContent = "⚠️";
        const text = document.createElement("div");
        const title = document.createElement("div");
        title.className = "alert-banner-title";
        title.textContent = "Product feed sync stopped";
        const body = document.createElement("div");
        body.className = "alert-banner-body";
        const feedNames = { bikeComponents_de: "bike-components.de", bikeComponents_en: "bike-components.de (EN)" };
        staleFeeds.forEach(([id, f]) => {
            const name = feedNames[id] || id;
            const age = f.ageHours !== null ? Math.round(f.ageHours) + "h" : "unknown";
            const line = document.createElement("div");
            line.textContent = name + " — last synced " + age + " ago (" + fmt(f.synced) + ")";
            body.append(line);
        });
        const note = document.createElement("div");
        note.style.marginTop = "6px";
        note.textContent = "The daily cron may have missed a run. Part search results may be outdated. A background re-sync is triggered automatically on the next search request.";
        body.append(note);
        text.append(title, body);
        banner.append(icon, text);
        root.append(banner);
    }

    // Overall status
    const overall = document.createElement("div");
    overall.className = "overall";
    const dot = document.createElement("div");
    dot.className = "overall-dot";
    dot.style.background = data.status === "ok" ? "var(--green)" : data.status === "degraded" ? "var(--yellow)" : "var(--red)";
    const overallText = document.createElement("div");
    const overallLabel = document.createElement("div");
    overallLabel.className = "overall-label";
    overallLabel.textContent = data.status === "ok" ? "All systems operational" : data.status === "degraded" ? "Degraded — some feeds stale" : "Outage";
    const overallSub = document.createElement("div");
    overallSub.className = "overall-sub";
    overallSub.textContent = "KV storage: " + (data.kvAvailable ? "Available" : "Unavailable") + " · Environment: " + (data.environment || "—");
    overallText.append(overallLabel, overallSub);
    overall.append(dot, overallText);
    root.append(overall);

    // Feeds
    root.append(sectionTitle("Product Feeds"));
    const feedCard = document.createElement("div");
    feedCard.className = "card";
    const feedNames = { bikeComponents_de: "bike-components.de", bikeComponents_en: "bike-components.de (EN)" };
    for (const [id, f] of Object.entries(data.feeds)) {
        // Skip optional feeds that have never been synced (not configured)
        if (!f.synced && id === "bikeComponents_en") continue;
        const age = f.ageHours !== null ? f.ageHours + "h ago" : "—";
        const count = f.count ? f.count.toLocaleString() + " products" : "—";
        const sub = "Last synced: " + fmt(f.synced) + " · " + count;
        const b = f.synced ? (f.stale ? badge("Stale", "yellow") : badge("OK", "green")) : badge("Never synced", "red");
        const ageEl = document.createElement("span");
        ageEl.className = "card-value";
        ageEl.textContent = age;
        feedCard.append(makeCardRow(feedNames[id] || esc(id), sub, [ageEl, b]));
    }
    root.append(feedCard);

    // Stores
    root.append(sectionTitle("Stores"));
    const storeCard = document.createElement("div");
    storeCard.className = "card";
    for (const s of data.stores) {
        storeCard.append(makeCardRow(s.label, "", badge(s.enabled ? "Enabled" : "Disabled", s.enabled ? "green" : "gray")));
    }
    root.append(storeCard);

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
