// src/pages/MatchesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";

import {
  createMatch,
  fetchMatches,
  fetchMyRequestsForMatchIds,
  fetchApprovedCounts,
  requestJoin,
  cancelMyJoin,
  fetchPendingRequests,
  fetchMatchMessages,
  sendMatchMessage,
  approveRequest,
  rejectRequest,
  fetchLatestChatTimes,
  deleteMatch,
  subscribeMatchesRealtime,
  subscribeJoinRequestsRealtime,
  subscribeAllMatchMessagesRealtime,
  subscribeMatchMessagesRealtime,
} from "../services/matches";

import { fetchProfilesByIds } from "../services/profilesPublic";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { ensurePushSubscription } from "../services/push";
import { scheduleEndWarningsForEvent, unscheduleEventWarnings } from "../services/gorilaSound";

/* ===================== Utils ===================== */
function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeParseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function localYMDFromStartAt(startAt) {
  const d = safeParseDate(startAt);
  return d ? toDateInputValue(d) : "";
}

function combineDateTimeToISO(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

function uniqById(list) {
  const seen = new Set();
  return (list || []).filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/* ===================== COMPONENT ===================== */
export default function MatchesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });

  const [myReqStatus, setMyReqStatus] = useState({});
  const [approvedCounts, setApprovedCounts] = useState({});
  const [latestChatTsByMatch, setLatestChatTsByMatch] = useState({});
  const [inPlayersByMatchId, setInPlayersByMatchId] = useState({});
  const [playersByMatchId, setPlayersByMatchId] = useState({});
  const [rosterProfilesById, setRosterProfilesById] = useState({});

  const [viewMode, setViewMode] = useState("mine");
  const todayISO = toDateInputValue(new Date());
  const [selectedDay, setSelectedDay] = useState(todayISO);

  const aliveRef = useRef(true);
  useEffect(() => () => (aliveRef.current = false), []);

  /* ===================== SESSION ===================== */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      setAuthReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  /* ===================== LOAD ===================== */
  async function load() {
    try {
      setStatus({ loading: true, error: null });

      const list = await fetchMatches({ limit: 400 });
      if (!aliveRef.current) return;

      const unique = uniqById(list);
      setItems(unique);

      const ids = unique.map((m) => m.id);

      setMyReqStatus(await fetchMyRequestsForMatchIds(ids));
      setApprovedCounts(await fetchApprovedCounts(ids));
      setLatestChatTsByMatch(await fetchLatestChatTimes(ids));

      // 👤 creator profiles
      const creatorIds = [...new Set(unique.map((m) => m.created_by_user).filter(Boolean))];
      if (creatorIds.length) {
        setRosterProfilesById(await fetchProfilesByIds(creatorIds));
      }

      // 👥 REAL players per match (ESTO ES LO QUE TE FALTABA)
      const { data: players } = await supabase
        .from("match_players")
        .select("match_id, player_uuid")
        .in("match_id", ids);

      const map = {};
      const userIds = new Set();

      for (const p of players || []) {
        if (!map[p.match_id]) map[p.match_id] = [];
        map[p.match_id].push(p.player_uuid);
        userIds.add(p.player_uuid);
      }

      const profiles = await fetchProfilesByIds([...userIds]);
      const enriched = {};

      for (const mid in map) {
        enriched[mid] = map[mid].map((uid) => profiles?.[uid]).filter(Boolean);
      }

      setPlayersByMatchId(enriched);
    } catch (e) {
      setStatus({ loading: false, error: e.message });
    } finally {
      setStatus((s) => ({ ...s, loading: false }));
    }
  }

  useEffect(() => {
    if (authReady) load();
  }, [authReady, session?.user?.id]);

  /* ===================== RENDER ===================== */
  return (
    <div className="page">
      <h1>Partidos</h1>

      {items.map((m) => {
        const players = playersByMatchId[m.id] || [];

        return (
          <div key={m.id} className="card">
            <h3>{m.club_name}</h3>
            <div>{localYMDFromStartAt(m.start_at)}</div>

            <div style={{ display: "flex", gap: 8 }}>
              {players.map((p) => (
                <img
                  key={p.id}
                  src={p.avatar_url || "/gorila.png"}
                  alt={p.name}
                  style={{ width: 50, height: 50, borderRadius: 8 }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}