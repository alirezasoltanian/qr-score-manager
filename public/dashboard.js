const tokenInput = document.querySelector("#token");
const statusEl = document.querySelector("#status");
const eventsEl = document.querySelector("#events");
const headers = () => ({ Authorization: `Bearer ${tokenInput.value}` });
async function refresh() {
  if (!tokenInput.value) return;
  try {
    const [eventsRes, statsRes] = await Promise.all([
      fetch("/api/events", { headers: headers() }),
      fetch("/api/stats", { headers: headers() })
    ]);
    if (!eventsRes.ok || !statsRes.ok) throw new Error("توکن نامعتبر یا ارتباط ناموفق");
    const rows = await eventsRes.json(), stats = await statsRes.json();
    document.querySelector("#total").textContent = stats.total;
    document.querySelector("#today").textContent = stats.today;
    eventsEl.innerHTML = rows.length ? rows.map(row => `<tr>
      <td>${row.id}</td><td>${new Date(row.first_seen_at).toLocaleString("fa-IR")}</td>
      <td>${row.expires_at ? new Date(row.expires_at).toLocaleTimeString("fa-IR") : "—"}</td>
      <td class="payload" title="${escapeHtml(row.payload)}">${escapeHtml(row.payload)}</td></tr>`).join("") :
      '<tr><td colspan="4" class="muted">هنوز QR دریافت نشده است.</td></tr>';
    statusEl.textContent = "اتصال برقرار است.";
  } catch (e) { statusEl.textContent = e.message; }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
document.querySelector("#connect").onclick = refresh;
document.querySelector("#refresh").onclick = refresh;
