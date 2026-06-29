import { useState, useEffect } from "react";

const API = "http://127.0.0.1:5000";

const styles = {
  body: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: "#0f0f0f",
    color: "#e8e6e0",
    minHeight: "100vh",
    padding: "32px 16px",
  },
  container: { maxWidth: 760, margin: "0 auto" },
  h1: { fontSize: 22, fontWeight: 600, letterSpacing: -0.3, color: "#f0ede8" },
  subtitle: { fontSize: 13, color: "#6b6b6b", marginTop: 4 },
  tabs: { display: "flex", gap: 2, marginBottom: 28, borderBottom: "1px solid #222" },
  tab: (active) => ({
    padding: "8px 16px", fontSize: 13, cursor: "pointer",
    border: "none", background: "none",
    color: active ? "#f0ede8" : "#6b6b6b",
    borderBottom: active ? "2px solid #7c6af7" : "2px solid transparent",
    marginBottom: -1, transition: "color 0.15s",
  }),
  label: {
    display: "block", fontSize: 12, color: "#888",
    marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase",
  },
  input: {
    width: "100%", background: "#181818", border: "1px solid #2a2a2a",
    color: "#e8e6e0", borderRadius: 8, padding: "12px 14px",
    fontSize: 14, fontFamily: "inherit", outline: "none",
    transition: "border-color 0.15s",
  },
  textarea: {
    width: "100%", background: "#181818", border: "1px solid #2a2a2a",
    color: "#e8e6e0", borderRadius: 8, padding: "12px 14px",
    fontSize: 14, fontFamily: "inherit", resize: "vertical",
    minHeight: 140, lineHeight: 1.6, outline: "none",
  },
  field: { marginBottom: 16 },
  btn: (disabled) => ({
    background: disabled ? "#333" : "#7c6af7",
    color: disabled ? "#555" : "#fff",
    border: "none", padding: "10px 24px", borderRadius: 8,
    fontSize: 14, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
  }),
  card: {
    marginTop: 24, background: "#181818",
    border: "1px solid #2a2a2a", borderRadius: 10, padding: 20,
  },
  badge: (type) => {
    const map = {
      ai:      { background: "#3d1a1a", color: "#f87171" },
      human:   { background: "#1a3d2b", color: "#4ade80" },
      uncertain: { background: "#2a2a1a", color: "#fbbf24" },
      appeal:  { background: "#1a3d2b", color: "#4ade80" },
    };
    return {
      ...map[type], display: "inline-block", padding: "4px 12px",
      borderRadius: 20, fontSize: 12, fontWeight: 600,
      letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12,
    };
  },
  scoreRow: { display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" },
  scoreItem: {
    background: "#111", border: "1px solid #222", borderRadius: 8,
    padding: "10px 14px", flex: 1, minWidth: 120,
  },
  scoreLabel: { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" },
  scoreVal: { fontSize: 20, fontWeight: 600, color: "#f0ede8", marginTop: 2 },
  scoreBar: { height: 4, background: "#222", borderRadius: 2, marginTop: 8, overflow: "hidden" },
  labelText: {
    fontSize: 13, color: "#a8a49e", lineHeight: 1.6,
    borderLeft: "3px solid #7c6af7", paddingLeft: 12, marginTop: 12,
  },
  idRow: { marginTop: 14, fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  idVal: { fontFamily: "monospace", color: "#888" },
  copyBtn: {
    background: "#222", border: "1px solid #333", color: "#888",
    padding: "2px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer",
  },
  appealBtn: {
    background: "#1a1a2e", border: "1px solid #2a2a4a", color: "#9b8ff7",
    padding: "3px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer",
  },
  error: { marginTop: 16, color: "#f87171", fontSize: 13 },
  logEntry: {
    background: "#181818", border: "1px solid #222",
    borderRadius: 8, padding: 16, marginBottom: 10,
  },
  logHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" },
  logType: (type) => ({
    fontSize: 11, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em", padding: "2px 8px", borderRadius: 4,
    background: type === "appeal" ? "#1a2e1a" : "#1e1e3a",
    color: type === "appeal" ? "#4ade80" : "#9b8ff7",
  }),
  logTime: { fontSize: 11, color: "#555", marginLeft: "auto" },
  logRow: { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 4 },
  logField: { fontSize: 12, color: "#666" },
  refreshBtn: {
    background: "#181818", border: "1px solid #2a2a2a", color: "#888",
    padding: "7px 16px", borderRadius: 8, fontSize: 13,
    cursor: "pointer", marginBottom: 20,
  },
  empty: { color: "#444", fontSize: 13, textAlign: "center", padding: "40px 0" },
};

function barColor(score) {
  if (score >= 0.8) return "#f87171";
  if (score <= 0.25) return "#4ade80";
  return "#fbbf24";
}

function badgeType(result) {
  if (result === "Likely AI-generated") return "ai";
  if (result === "Likely human-written") return "human";
  return "uncertain";
}

function ScoreBar({ score }) {
  return (
    <div style={styles.scoreBar}>
      <div style={{ height: "100%", borderRadius: 2, width: `${score * 100}%`, background: barColor(score), transition: "width 0.4s ease" }} />
    </div>
  );
}

function SubmitPanel({ onAppeal }) {
  const [creatorId, setCreatorId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setResult(null); setError("");
    try {
      const res = await fetch(`${API}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_id: creatorId, text }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError("Could not reach the server. Is app.py running?");
    } finally {
      setLoading(false);
    }
  }

  const llm   = result?.signals?.find(s => s.name === "llm_classifier")?.score ?? 0;
  const stylo = result?.signals?.find(s => s.name === "stylometric_heuristics")?.score ?? 0;

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div style={styles.field}>
          <label style={styles.label}>Creator ID</label>
          <input style={styles.input} value={creatorId} onChange={e => setCreatorId(e.target.value)} placeholder="e.g. creator_123" required />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Text to analyse</label>
          <textarea style={styles.textarea} value={text} onChange={e => setText(e.target.value)} placeholder="Paste a poem, blog post, or story excerpt here..." required />
        </div>
        <button type="submit" style={styles.btn(loading)} disabled={loading}>
          {loading ? "Analysing…" : "Analyse"}
        </button>
      </form>
      {error && <p style={styles.error}>{error}</p>}
      {result && (
        <div style={styles.card}>
          <span style={styles.badge(badgeType(result.result))}>{result.result}</span>
          <div style={styles.scoreRow}>
            <div style={styles.scoreItem}>
              <div style={styles.scoreLabel}>Confidence</div>
              <div style={styles.scoreVal}>{(result.confidence * 100).toFixed(0)}%</div>
              <ScoreBar score={result.confidence} />
            </div>
            <div style={styles.scoreItem}>
              <div style={styles.scoreLabel}>LLM signal</div>
              <div style={styles.scoreVal}>{(llm * 100).toFixed(0)}%</div>
              <ScoreBar score={llm} />
            </div>
            <div style={styles.scoreItem}>
              <div style={styles.scoreLabel}>Stylometric</div>
              <div style={styles.scoreVal}>{(stylo * 100).toFixed(0)}%</div>
              <ScoreBar score={stylo} />
            </div>
          </div>
          <div style={styles.labelText}>{result.transparency_label}</div>
          <div style={styles.idRow}>
            <span>Content ID:</span>
            <span style={styles.idVal}>{result.content_id}</span>
            <button style={styles.copyBtn} onClick={() => navigator.clipboard.writeText(result.content_id)}>Copy</button>
            <button style={styles.appealBtn} onClick={() => onAppeal(result.content_id)}>Use for appeal</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppealPanel({ prefillId }) {
  const [contentId, setContentId] = useState(prefillId || "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { if (prefillId) setContentId(prefillId); }, [prefillId]);

  async function handleAppeal(e) {
    e.preventDefault();
    setLoading(true); setResult(null); setError("");
    try {
      const res = await fetch(`${API}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: contentId, creator_reasoning: reason }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError("Could not reach the server. Is app.py running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleAppeal}>
        <div style={styles.field}>
          <label style={styles.label}>Content ID</label>
          <input style={styles.input} value={contentId} onChange={e => setContentId(e.target.value)} placeholder="Paste the content_id from your submission" required />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Your reasoning</label>
          <textarea style={{ ...styles.textarea, minHeight: 100 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why you believe this classification is incorrect..." required />
        </div>
        <button type="submit" style={styles.btn(loading)} disabled={loading}>
          {loading ? "Submitting…" : "Submit appeal"}
        </button>
      </form>
      {error && <p style={styles.error}>{error}</p>}
      {result && (
        <div style={styles.card}>
          <span style={styles.badge("appeal")}>Appeal received</span>
          <p style={{ fontSize: 13, color: "#a8a49e", marginTop: 8 }}>{result.message}</p>
          <div style={styles.idRow}>
            <span>Appeal ID:</span>
            <span style={styles.idVal}>{result.appeal_id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LogPanel() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadLog() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/log`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLog(); }, []);

  return (
    <div>
      <button style={styles.refreshBtn} onClick={loadLog}>{loading ? "Loading…" : "Refresh log"}</button>
      {entries.length === 0 && !loading && <p style={styles.empty}>No entries yet.</p>}
      {entries.map((e, i) => {
        if (e.event_type === "attribution_decision") {
          const llm   = e.signals?.find(s => s.name === "llm_classifier")?.score ?? e.llm_score ?? 0;
          const stylo = e.signals?.find(s => s.name === "stylometric_heuristics")?.score ?? e.stylometric_score ?? 0;
          const statusColor = e.status === "under_review" ? "#fbbf24" : "#555";
          return (
            <div key={i} style={styles.logEntry}>
              <div style={styles.logHeader}>
                <span style={styles.logType("decision")}>Decision</span>
                <span style={{ ...styles.badge(badgeType(e.result)), fontSize: 11, padding: "2px 8px", marginBottom: 0 }}>{e.result}</span>
                <span style={{ fontSize: 11, color: statusColor }}>{e.status}</span>
                <span style={styles.logTime}>{e.timestamp?.slice(0, 19).replace("T", " ")}</span>
              </div>
              <div style={styles.logRow}>
                <div style={styles.logField}>Confidence <span style={{ color: "#c8c5bf" }}>{((e.confidence || 0) * 100).toFixed(0)}%</span></div>
                <div style={styles.logField}>LLM <span style={{ color: "#c8c5bf" }}>{(llm * 100).toFixed(0)}%</span></div>
                <div style={styles.logField}>Stylometric <span style={{ color: "#c8c5bf" }}>{(stylo * 100).toFixed(0)}%</span></div>
                <div style={styles.logField}>Creator <span style={{ color: "#c8c5bf" }}>{e.creator_id}</span></div>
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>ID <span style={{ fontFamily: "monospace", color: "#666" }}>{e.content_id}</span></div>
            </div>
          );
        }
        return (
          <div key={i} style={styles.logEntry}>
            <div style={styles.logHeader}>
              <span style={styles.logType("appeal")}>Appeal</span>
              <span style={styles.logTime}>{e.timestamp?.slice(0, 19).replace("T", " ")}</span>
            </div>
            <div style={styles.logRow}>
              <div style={styles.logField}>Creator <span style={{ color: "#c8c5bf" }}>{e.creator_id}</span></div>
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6, lineHeight: 1.5 }}>
              <span>Reason: </span><span style={{ color: "#888" }}>{e.reason}</span>
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>Content ID <span style={{ fontFamily: "monospace", color: "#666" }}>{e.content_id}</span></div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("submit");
  const [appealId, setAppealId] = useState("");

  function handleAppeal(contentId) {
    setAppealId(contentId);
    setTab("appeal");
  }

  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={styles.h1}>Provenance Guard</h1>
          <p style={styles.subtitle}>AI authorship detection for creative platforms</p>
        </div>
        <div style={styles.tabs}>
          {["submit", "appeal", "log"].map(t => (
            <button key={t} style={styles.tab(tab === t)} onClick={() => setTab(t)}>
              {t === "submit" ? "Analyse text" : t === "appeal" ? "Submit appeal" : "Audit log"}
            </button>
          ))}
        </div>
        {tab === "submit" && <SubmitPanel onAppeal={handleAppeal} />}
        {tab === "appeal" && <AppealPanel prefillId={appealId} />}
        {tab === "log"    && <LogPanel />}
      </div>
    </div>
  );
}