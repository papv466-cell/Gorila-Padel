// src/pages/MatchesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../components/ToastProvider";
import "./MatchesPage.css";

import {
  createMatch, fetchMatches, submitMatchResult, getMatchResult, submitPlayerRating, getMyRatingsForMatch, giveRedCard, triggerSOS,fetchMyRequestsForMatchIds, fetchApprovedCounts,
  requestJoin, cancelMyJoin, fetchPendingRequests, fetchMatchMessages,
  sendMatchMessage, approveRequest, rejectRequest, fetchLatestChatTimes,
  deleteMatch, subscribeMatchesRealtime, subscribeJoinRequestsRealtime,
  subscribeAllMatchMessagesRealtime, subscribeMatchMessagesRealtime,
} from "../services/matches";

import { fetchProfilesByIds } from "../services/profilesPublic";
import { fetchClubsFromGoogleSheet } from "../services/sheets";
import { ensurePushSubscription } from "../services/push";
import { scheduleEndWarningsForEvent, unscheduleEventWarnings } from "../services/gorilaSound";
import { notifyMatchInvite, notifyMatchTransferReceived } from "../services/notifications";

/* ─── Utils ─── */
function toDateInputValue(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function safeParseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) {
    const [y,mo,d] = m[1].split("-").map(Number);
    const dt = new Date(y, mo-1, d, 0, 0, 0, 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}
function combineDateTimeToISO(dateStr, timeStr) {
  const [y,m,d] = String(dateStr||"").split("-").map(Number);
  const [hh,mm] = String(timeStr||"19:00").split(":").map(Number);
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`;
}
function localYMDFromStartAt(startAt) {
  if (!startAt) return "";
  const s = String(startAt);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) return m[1];
  const dt = safeParseDate(startAt);
  return dt ? toDateInputValue(dt) : "";
}
function sortByStartAtAsc(list) {
  return [...(list||[])].sort((a,b) => (safeParseDate(a.start_at)?.getTime()||0) - (safeParseDate(b.start_at)?.getTime()||0));
}
function upsertMatchSorted(prev, match) {
  const next = Array.isArray(prev) ? [...prev] : [];
  const idx = next.findIndex(x => x.id === match.id);
  if (idx >= 0) next[idx] = {...next[idx],...match}; else next.push(match);
  return sortByStartAtAsc(next);
}
function removeMatch(prev, matchId) {
  return Array.isArray(prev) ? prev.filter(x => x.id !== matchId) : [];
}
function uniqById(list) {
  const seen = new Set(), out = [];
  for (const it of list||[]) { if (!it?.id || seen.has(it.id)) continue; seen.add(it.id); out.push(it); }
  return out;
}
function formatWhen(startAt) {
  try {
    const s = String(startAt||"");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)} ${m[4]}:${m[5]}`;
    return s;
  } catch { return String(startAt||""); }
}
function addDays(dateStr, delta) {
  const [y,mo,d] = String(dateStr||"").split("-").map(Number);
  const now = new Date();
  const base = new Date(y||now.getFullYear(),(mo||1)-1,d||1,0,0,0,0);
  base.setDate(base.getDate()+delta);
  return toDateInputValue(base);
}
function fmtDayLabel(dateStr) {
  try {
    const [y,mo,d] = String(dateStr||"").split("-").map(Number);
    const now = new Date();
    return new Date(y||now.getFullYear(),(mo||1)-1,d||1).toLocaleDateString("es-ES",{weekday:"short"});
  } catch { return ""; }
}
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const IS = {
  width:"100%", padding:"11px 12px", borderRadius:10,
  background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
  color:"#fff", fontSize:13, boxSizing:"border-box",
};

export default function MatchesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const normStatus = s => String(s||"").trim().toLowerCase();
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current=true; return ()=>{ aliveRef.current=false; }; }, []);

  const todayISO = toDateInputValue(new Date());
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const clubIdParam = searchParams.get("clubId")||"";
  const clubNameParam = searchParams.get("clubName")||"";
  const courtIdParam = searchParams.get("courtId")||"";
  const courtNameParam = searchParams.get("courtName")||"";
  const courtLatParam = parseFloat(searchParams.get("lat")||"0")||null;
  const courtLngParam = parseFloat(searchParams.get("lng")||"0")||null;
  const createParam = searchParams.get("create")==="1";
  const isClubFilter = !!(clubIdParam||clubNameParam);
  const openChatParam = qs.get("openChat")||(typeof window!=="undefined"&&window.sessionStorage?.getItem?.("openChat"))||"";
  const openRequestsParam = qs.get("openRequests")||"";

  /* ─── Auth ─── */
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => { setSession(session); setAuthReady(true); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  /* ─── Data ─── */
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({loading:true,error:null});
  const [myReqStatus, setMyReqStatus] = useState({});
  const [approvedCounts, setApprovedCounts] = useState({});
  const [inPlayersByMatchId, setInPlayersByMatchId] = useState({});
  const [playersByMatchId, setPlayersByMatchId] = useState({});
  const [rosterProfilesById, setRosterProfilesById] = useState({});

  /* ─── UI ─── */
  const [viewMode, setViewMode] = useState("mine");
  const [selectedDay, setSelectedDay] = useState(todayISO);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState("");
  const [filterUltimaHora, setFilterUltimaHora] = useState(false);
  const [filterClubSearch, setFilterClubSearch] = useState("");
  const [filterClubObj, setFilterClubObj] = useState(null);
  const [clubFilterQuery, setClubFilterQuery] = useState("");
  const [showClubFilterSuggest, setShowClubFilterSuggest] = useState(false);
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [filterDistKm, setFilterDistKm] = useState(10);
  const [filterNearMe, setFilterNearMe] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const hasFilters = !!(filterLevel||filterUltimaHora||filterClubSearch||filterNearMe);

  /* ─── Modals ─── */
  const [requestsOpenFor, setRequestsOpenFor] = useState(null);
  const [pending, setPending] = useState([]);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [profilesById, setProfilesById] = useState({});
  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [chatItems, setChatItems] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [cedeOpenFor, setCedeOpenFor] = useState(null);
  const [cedeQuery, setCedeQuery] = useState("");
  const [cedeBusy, setCedeBusy] = useState(false);
  const [cedeResults, setCedeResults] = useState([]);
  const [inviteOpenFor, setInviteOpenFor] = useState(null);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteSelected, setInviteSelected] = useState([]);

  /* ─── Crear ─── */
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [clubsSheet, setClubsSheet] = useState([]);
  const [clubQuery, setClubQuery] = useState("");
  const [showClubSuggest, setShowClubSuggest] = useState(false);
  const [moodOpenFor, setMoodOpenFor] = useState(null);
  const [postOpenFor, setPostOpenFor] = useState(null);
  const [postResult, setPostResult] = useState(null);
  const [postRoster, setPostRoster] = useState([]);
  const [postSets, setPostSets] = useState([{l:0,r:0}]);
  const [postNotes, setPostNotes] = useState("");
  const [postRatings, setPostRatings] = useState({});
  const [postVibes, setPostVibes] = useState({});
  const [postSaving, setPostSaving] = useState(false);
  const [postMyRatings, setPostMyRatings] = useState([]);
  const [form, setForm] = useState({
    clubName:"", clubId:"", date:todayISO, time:"19:00",
    durationMin:90, level:"medio", alreadyPlayers:1, pricePerPlayer:"",
  });

  function closeAllModals() { setChatOpenFor(null); setRequestsOpenFor(null); setInviteOpenFor(null); setCedeOpenFor(null); }
  function goLogin() { navigate("/login",{replace:true,state:{from:location.pathname+location.search}}); }

  /* ─── Fetch helpers ─── */
  async function fetchInPlayersMap(matchIds, uid) {
    const out = {};
    if (!uid||!matchIds?.length) return out;
    try {
      const {data,error} = await supabase.from("match_players").select("match_id").in("match_id",matchIds).eq("player_uuid",String(uid));
      if (!error) { for (const r of data||[]) out[String(r.match_id)]=true; return out; }
    } catch {}
    return out;
  }
  async function fetchRosterProfilesByMatch(matchIds) {
    if (!matchIds?.length) return {};
    let rows = [];
    try {
      const {data,error} = await supabase.from("match_players").select("match_id, player_uuid").in("match_id",matchIds);
      if (!error&&Array.isArray(data)) rows = data.map(r=>({match_id:r.match_id,user_id:r.player_uuid})).filter(r=>r.user_id);
    } catch {}
    try {
      const {data,error} = await supabase.from("match_join_requests").select("match_id, user_id").in("match_id",matchIds).eq("status","approved");
      if (!error&&Array.isArray(data)) {
        for (const r of data) {
          if (!rows.find(x=>String(x.match_id)===String(r.match_id)&&String(x.user_id)===String(r.user_id))) {
            rows.push({match_id:r.match_id, user_id:r.user_id});
          }
        }
      }
    } catch {}
    if (!rows.length) return {};
    const mapIds = {}, allUserIds = new Set();
    for (const r of rows) {
      const mid=String(r.match_id), uid=String(r.user_id);
      if (!mapIds[mid]) mapIds[mid]=[];
      mapIds[mid].push(uid); allUserIds.add(uid);
    }
    const profiles = await fetchProfilesByIds(Array.from(allUserIds));
    const enriched = {};
    for (const [mid,uids] of Object.entries(mapIds)) {
      enriched[mid] = (uids||[]).map(uid=>profiles?.[String(uid)]).filter(Boolean);
    }
    return enriched;
  }

  async function load() {
    try {
      setStatus({loading:true,error:null});
      const list = await fetchMatches({limit:400});
      if (!aliveRef.current) return;
      const unique = uniqById(list);
      setItems(sortByStartAtAsc(unique));
      const ids = unique.map(m=>m.id);
      const [my,counts,roster] = await Promise.all([
        fetchMyRequestsForMatchIds(ids),
        fetchApprovedCounts(ids),
        fetchRosterProfilesByMatch(ids),
      ]);
      if (!aliveRef.current) return;
      setMyReqStatus(my||{});
      setApprovedCounts(counts||{});
      setPlayersByMatchId(roster||{});
      const uid = session?.user?.id ? String(session.user.id) : "";
      const map = await fetchInPlayersMap(ids, uid);
      if (aliveRef.current) setInPlayersByMatchId(map||{});
      const creatorIds = Array.from(new Set(unique.map(m=>m?.created_by_user).filter(Boolean).map(String)));
      const rosterPlayerIds = Array.from(new Set(Object.values(roster||{}).flat().map(p=>String(p?.id||"")).filter(Boolean)));
      const allProfileIds = Array.from(new Set([...creatorIds, ...rosterPlayerIds]));
      if (allProfileIds.length) {
        const profs = await fetchProfilesByIds(allProfileIds);
        if (aliveRef.current) setRosterProfilesById(prev=>({...prev,...(profs||{})}));
      }
    } catch(e) {
      if (!aliveRef.current) return;
      setStatus({loading:false,error:e?.message||"Error cargando partidos"});
      setItems([]);
    } finally {
      if (aliveRef.current) setStatus(s=>({...s,loading:false}));
    }
  }

  useEffect(() => { if(authReady) load(); }, [authReady, session?.user?.id]);
  useEffect(() => {
    fetchClubsFromGoogleSheet().then(r=>setClubsSheet(Array.isArray(r)?r:[])).catch(()=>setClubsSheet([]));
  }, []);
  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel("matches-changes").on("postgres_changes",{event:"*",schema:"public",table:"matches"},()=>load()).subscribe();
    return () => supabase.removeChannel(ch);
  }, [session]);
  useEffect(() => {
    const u1 = subscribeMatchesRealtime(p=>{ const t=p?.eventType,r=p?.new||p?.old; if(!r?.id) return; if(t==="DELETE") setItems(prev=>removeMatch(prev,r.id)); else setItems(prev=>upsertMatchSorted(prev,r)); });
    const u2 = subscribeJoinRequestsRealtime(()=>load());
    const u3 = subscribeAllMatchMessagesRealtime(()=>load());
    return () => { u1?.(); u2?.(); u3?.(); };
  }, [session?.user?.id]);
  useEffect(() => {
    if (!session?.user?.id) return;
    ensurePushSubscription().catch(()=>{});
  }, [session?.user?.id]);
  useEffect(() => {
    const onPush = e => { const p=e?.detail||{}; const t=String(p.title||"Gorila Pádel"); const b=String(p.body||""); toast.success(b?`${t}: ${b}`:t); };
    if (typeof window!=="undefined") { window.addEventListener("gp:push",onPush); return ()=>window.removeEventListener("gp:push",onPush); }
  }, [toast]);

  /* ─── Calendar ─── */
  const calendarDays = useMemo(() => {
    const out = [];
    for (let i=-3; i<=10; i++) out.push(addDays(selectedDay||todayISO, i));
    return out;
  }, [selectedDay, todayISO]);
  const dayCounts = useMemo(() => {
    let list = clubIdParam ? items.filter(m=>String(m.club_id)===String(clubIdParam)) : items;
    const map = {};
    for (const m of list||[]) { const k=localYMDFromStartAt(m.start_at); if(k) map[k]=(map[k]||0)+1; }
    return map;
  }, [items, clubIdParam]);

  /* ─── Filtros ─── */
  const filteredList = useMemo(() => {
    let list = items;
    if (clubIdParam) list = list.filter(m => String(m.club_id) === String(clubIdParam));
    if (!filterClubSearch) {
      if (selectedDay) list = list.filter(m => localYMDFromStartAt(m.start_at) === selectedDay);
    }
    if (filterLevel) list = list.filter(m => String(m.level||"").toLowerCase() === filterLevel.toLowerCase());
    if (filterClubObj) {
      list = list.filter(m => String(m.club_id||"") === String(filterClubObj.id||"") || String(m.club_name||"").toLowerCase() === String(filterClubObj.name||"").toLowerCase());
    } else if (filterClubSearch) {
      list = list.filter(m => String(m.club_name||"").toLowerCase().includes(filterClubSearch.toLowerCase()));
    }
    if (filterUltimaHora) {
      const now = Date.now(), in2h = now + 2*60*60*1000;
      list = list.filter(m => { const t = safeParseDate(m.start_at)?.getTime(); return t && t >= now && t <= in2h; });
    }
    if (filterNearMe && userLat && userLng) {
      list = list.filter(m => {
        const club = clubsSheet.find(c => String(c.name||"").toLowerCase() === String(m.club_name||"").toLowerCase());
        if (!club?.lat || !club?.lng) return false;
        return haversineKm(userLat, userLng, club.lat, club.lng) <= filterDistKm;
      });
    }
    return list;
  }, [items, clubIdParam, selectedDay, filterLevel, filterClubSearch, filterClubObj, filterUltimaHora, filterNearMe, filterDistKm, userLat, userLng, clubsSheet]);

  const myList = useMemo(() => {
    if (!session) return [];
    const uid = String(session.user.id);
    return filteredList.filter(m => { const st = normStatus(myReqStatus?.[m.id]); return String(m.created_by_user) === uid || st === "approved" || st === "pending"; });
  }, [filteredList, myReqStatus, session]);

  const visibleList = viewMode === "mine" ? myList : filteredList;

  /* ─── Sonidos fin partido ─── */
  useEffect(() => {
    if (!authReady) return;
    const uid = session?.user?.id ? String(session.user.id) : "";
    const desired = new Set();
    for (const m of visibleList||[]) {
      if (!uid||String(m.created_by_user)!==uid&&myReqStatus?.[m.id]!=="approved") continue;
      const startMs = safeParseDate(m.start_at)?.getTime?.();
      const endMs = Number.isFinite(startMs) ? startMs+(Number(m.duration_min)||90)*60000 : NaN;
      if (!Number.isFinite(endMs)) continue;
      const key = `match:${m.id}`; desired.add(key);
      scheduleEndWarningsForEvent({key,endMs,warn5MinTimes:2,endTimes:4});
    }
    unscheduleEventWarnings(key=>key.startsWith("match:")&&!desired.has(key));
  }, [authReady, session?.user?.id, visibleList, myReqStatus]);

  /* ─── Club suggestions (modal crear) ─── */
  const clubSuggestions = useMemo(() => {
    const q = (clubQuery||"").trim().toLowerCase();
    if (!q||q.length<2) return [];
    return (clubsSheet||[]).filter(c=>String(c?.name||"").toLowerCase().includes(q)).slice(0,10);
  }, [clubQuery, clubsSheet]);
  function pickClub(c) { setForm(prev=>({...prev,clubId:String(c?.id??""),clubName:String(c?.name??"")})); setClubQuery(String(c?.name??"")); setShowClubSuggest(false); }

  /* ─── Search profiles ─── */
  async function searchPublicProfiles(q) {
    if (String(q||"").trim().length<3) return [];
    const {data,error} = await supabase.from("profiles_public").select("id, name, handle, avatar_url").or(`name.ilike.%${q}%,handle.ilike.%${q}%`).limit(12);
    if (error) throw error;
    return Array.isArray(data)?data:[];
  }
  useEffect(() => {
    let t; const q=cedeQuery.trim();
    if (q.length<3) { setCedeResults([]); return; }
    t = setTimeout(async()=>{ try{ const r=await searchPublicProfiles(q); if(aliveRef.current) setCedeResults(r); }catch{ if(aliveRef.current) setCedeResults([]); } },220);
    return ()=>clearTimeout(t);
  }, [cedeQuery]);
  useEffect(() => {
    let t; const q=inviteQuery.trim();
    if (q.length<3) { setInviteResults([]); return; }
    t = setTimeout(async()=>{ try{ const r=await searchPublicProfiles(q); if(aliveRef.current) setInviteResults(r); }catch{ if(aliveRef.current) setInviteResults([]); } },220);
    return ()=>clearTimeout(t);
  }, [inviteQuery]);

  /* ─── Open from URL params ─── */
  useEffect(() => { if(!openChatParam||!authReady) return; if(!session){goLogin();return;} try{window.sessionStorage?.removeItem?.("openChat");}catch{} openChat(openChatParam); }, [openChatParam,authReady,session]);
  useEffect(() => { if(!openRequestsParam||!authReady) return; if(!session){goLogin();return;} openRequests(openRequestsParam); }, [openRequestsParam,authReady,session]);
  useEffect(() => {
    if(!createParam||!authReady) return; if(!session){goLogin();return;}
    const isPrivateCourt = !!courtIdParam; setOpenCreate(true); setForm(prev=>({...prev,clubId:isPrivateCourt?"private:"+courtIdParam:clubIdParam||prev.clubId,clubName:isPrivateCourt?courtNameParam:clubNameParam||prev.clubName,date:selectedDay||prev.date||todayISO,isPrivateCourt,lat:isPrivateCourt?courtLatParam:null,lng:isPrivateCourt?courtLngParam:null})); setClubQuery(isPrivateCourt?courtNameParam:clubNameParam||""); setShowClubSuggest(false);
  }, [createParam,clubIdParam,clubNameParam,authReady,session,todayISO,selectedDay]);

  /* ─── Actions ─── */
  async function handleCreate() {
    if (!session) return goLogin();
    try {
      setSaveError(null); setSaving(true);
      if (!String(form.clubName||"").trim()) throw new Error("Pon el nombre del club.");
      if (!form.isPrivateCourt && !String(form.clubId||"").trim()) throw new Error("Selecciona el club de la lista.");
      await createMatch({clubId:form.clubId,clubName:form.clubName,startAtISO:combineDateTimeToISO(form.date,form.time),durationMin:Number(form.durationMin)||90,level:form.level,alreadyPlayers:Number(form.alreadyPlayers)||1,pricePerPlayer:form.pricePerPlayer,userId:session.user.id,lat:form.lat||null,lng:form.lng||null});
      setSelectedDay(form.date); setOpenCreate(false);
      setForm({clubName:"",clubId:"",date:todayISO,time:"19:00",durationMin:90,level:"medio",alreadyPlayers:1,pricePerPlayer:""}); setClubQuery("");
      toast.success("Partido creado ✅"); await load(); setViewMode("mine");
      try { const {data:p}=await supabase.from("profiles_public").select("id,name,handle,avatar_url").eq("id",session.user.id).single(); if(p&&aliveRef.current) setRosterProfilesById(prev=>({...prev,[String(session.user.id)]:p})); } catch {}
    } catch(e) { setSaveError(e?.message||"No se pudo crear"); toast.error(e?.message||"Error"); } finally { setSaving(false); }
  }

  async function transferSpot({matchId,toUserId}) {
    if (!session) return goLogin();
    setCedeBusy(true);
    try {
      const {error} = await supabase.rpc("gp_transfer_match_spot",{p_match_id:matchId,p_to_user_id:toUserId});
      if (error) throw error;
      toast.success("Plaza cedida ✅"); setCedeOpenFor(null); setCedeQuery(""); setCedeResults([]); await load();
      try { const {data:match}=await supabase.from("matches").select("club_name").eq("id",matchId).single(); const {data:fromUser}=await supabase.from("profiles_public").select("name,handle").eq("id",session.user.id).single(); await notifyMatchTransferReceived({matchId,matchName:match?.club_name||"Partido",fromUserName:fromUser?.name||fromUser?.handle||"Un jugador",toUserId}); } catch {}
    } catch(e) { toast.error(e?.message||"No se pudo ceder"); } finally { setCedeBusy(false); }
  }

  async function sendInvites({matchId,userIds}) {
    if (!session) return goLogin();
    const uniq = Array.from(new Set((userIds||[]).map(String).filter(Boolean))).slice(0,10);
    if (!matchId||uniq.length===0) return;
    setInviteBusy(true);
    try {
      const {data:existing} = await supabase.from("match_invites").select("to_user_id").eq("match_id",matchId).in("to_user_id",uniq);
      const existingSet = new Set((existing||[]).map(r=>String(r.to_user_id)));
      const toInsert = uniq.filter(id=>!existingSet.has(String(id)));
      if (toInsert.length===0) { toast.success("Ya estaban invitados ✅"); setInviteOpenFor(null); setInviteQuery(""); setInviteResults([]); setInviteSelected([]); return; }
      const {error} = await supabase.from("match_invites").insert(toInsert.map(to=>({match_id:matchId,from_user_id:session.user.id,to_user_id:to})));
      if (error) throw error;
      try { const {data:match}=await supabase.from("matches").select("club_name").eq("id",matchId).single(); const {data:fromUser}=await supabase.from("profiles_public").select("name,handle").eq("id",session.user.id).single(); for (const toUserId of toInsert) await notifyMatchInvite({matchId,matchName:match?.club_name||"Partido",fromUserId:session.user.id,fromUserName:fromUser?.name||fromUser?.handle||"Un jugador",toUserId}); } catch {}
      toast.success(`Invitaciones enviadas ✅ (${toInsert.length})`); setInviteOpenFor(null); setInviteQuery(""); setInviteResults([]); setInviteSelected([]);
    } catch(e) { toast.error(e?.message||"Error"); } finally { setInviteBusy(false); }
  }

  async function openRequests(matchId) {
    try {
      closeAllModals(); setRequestsOpenFor(matchId); setPendingBusy(true);
      const rows = await fetchPendingRequests(matchId); setPending(Array.isArray(rows)?rows:[]);
      const profs = {}; for (const r of rows||[]) if(r.profiles_public) profs[String(r.user_id)]=r.profiles_public; setProfilesById(profs);
    } catch(e) { toast.error(e?.message||"Error"); setPending([]); } finally { setPendingBusy(false); }
  }

  async function handleApprove(requestId) {
    try {
      await approveRequest({requestId});
      try { const req=pending.find(r=>r.id===requestId); if(req){ const {data:match}=await supabase.from("matches").select("id,club_name").eq("id",requestsOpenFor).single(); const {notifyMatchApproved}=await import("../services/notifications"); await notifyMatchApproved({matchId:match.id,matchName:match.club_name,toUserId:req.user_id}); } } catch {}
      await openRequests(requestsOpenFor); toast.success("Aprobado ✅"); await load(); try { const req=pending.find(r=>r.id===requestId); if(req){ const {data:prof}=await supabase.from("profiles").select("name,handle").eq("id",req.user_id).single(); const pname=prof?.name||prof?.handle||"Un jugador"; await sendMatchMessage({matchId:requestsOpenFor, message: pname+" se ha unido al partido 🦍"}); } } catch {}
    } catch(e) { toast.error(e?.message??"Error"); }
  }

  async function handleReject(requestId) {
    try {
      await rejectRequest({requestId});
      try { const req=pending.find(r=>r.id===requestId); if(req){ const {data:match}=await supabase.from("matches").select("id,club_name").eq("id",requestsOpenFor).single(); const {notifyMatchRejected}=await import("../services/notifications"); await notifyMatchRejected({matchId:match.id,matchName:match.club_name,toUserId:req.user_id}); } } catch {}
      await openRequests(requestsOpenFor); toast.success("Rechazado"); await load();
    } catch(e) { toast.error(e?.message??"Error"); }
  }

  async function handleDelete(matchId) {
    if (!confirm("¿Eliminar este partido? No se puede deshacer.")) return;
    try { await deleteMatch(matchId); toast.success("Partido eliminado"); await load(); } catch(e) { toast.error(e?.message||"Error"); }
  }

  async function openChat(matchId) {
    try { closeAllModals(); setChatOpenFor(matchId); setChatItems([]); setChatText(""); setChatLoading(true); const rows=await fetchMatchMessages(matchId); setChatItems(Array.isArray(rows)?rows:[]); } catch(e) { toast.error(e?.message||"Error"); } finally { setChatLoading(false); }
  }

  async function openPostPartido(matchId) {
    closeAllModals();
    const match = visibleList.find(m => m.id === matchId);
    if (!match) return;
    setPostOpenFor(matchId);
    setPostScoreL(0); setPostScoreR(0); setPostNotes(""); setPostRatings({}); setPostVibes({});
    try {
      const [result, myRatings] = await Promise.all([getMatchResult(matchId), getMyRatingsForMatch(matchId)]);
      setPostResult(result || null);
      setPostMyRatings(myRatings || []);
      if (result) { setPostSets(result.sets||[{l:result.score_left||0,r:result.score_right||0}]); setPostNotes(result.notes||""); }
      const roster = playersByMatchId?.[String(matchId)] || [];
      const creatorId = match.created_by_user ? String(match.created_by_user) : "";
      const creatorProf = rosterProfilesById?.[creatorId] || null;
      const allPlayers = [...(creatorProf ? [creatorProf] : []), ...roster.filter(p => String(p?.id||"") !== creatorId)].filter(p => p?.id && String(p.id) !== String(session?.user?.id));
      setPostRoster(allPlayers);
    } catch(e) { toast.error(e?.message||"Error"); }
  }

  async function handleSendChat() {
    if (!chatOpenFor) return;
    try {
      const message = chatText.trim(); if (!message) return; setChatText("");
      await sendMatchMessage({matchId:chatOpenFor,message});
      try { const {data:match}=await supabase.from("matches").select("id,club_name,created_by_user").eq("id",chatOpenFor).single(); const {data:players}=await supabase.from("match_players").select("player_uuid").eq("match_id",chatOpenFor); const {data:senderProfile}=await supabase.from("profiles_public").select("name,handle").eq("id",session.user.id).single(); const participants=new Set([match.created_by_user,...(players||[]).map(p=>p.player_uuid)]); participants.delete(session.user.id); const {notifyMatchMessage}=await import("../services/notifications"); for (const userId of participants) await notifyMatchMessage({matchId:match.id,matchName:match.club_name,fromUserId:session.user.id,fromUserName:senderProfile?.name||senderProfile?.handle||"Un jugador",toUserId:userId,messagePreview:message.substring(0,50)}); } catch {}
      const rows = await fetchMatchMessages(chatOpenFor); setChatItems(Array.isArray(rows)?rows:[]);
    } catch(e) { toast.error(e?.message||"Error"); }
  }

  useEffect(() => {
    if (!chatOpenFor) return;
    const unsub = subscribeMatchMessagesRealtime(chatOpenFor, async()=>{ try{ const rows=await fetchMatchMessages(chatOpenFor); if(aliveRef.current) setChatItems(Array.isArray(rows)?rows:[]); }catch{} });
    return ()=>unsub?.();
  }, [chatOpenFor]);

  /* ══════════════════════════════════════
     RENDER
  ══════════════════════════════════════ */
  async function buscarJugarAhora() {
    setJugarAhoraData(p=>({...p, loading:true}));
    try {
      const now = new Date();
      const in2h = new Date(now.getTime() + 2*60*60*1000);
      const today = now.toISOString().slice(0,10);
      const fromTime = now.toTimeString().slice(0,5);
      const toTime = in2h.toTimeString().slice(0,5);

      // Pistas libres en clubs Gorila en las próximas 2h
      const {data: slots} = await supabase
        .from('court_slots')
        .select('*, club_courts(name, court_type)')
        .eq('date', today)
        .eq('status', 'available')
        .gte('start_time', fromTime)
        .lte('start_time', toTime)
        .limit(10);

      // Partidos con hueco hoy próximas 2h
      const {data: matchRows} = await supabase
        .from('matches')
        .select('*, match_join_requests(status)')
        .eq('start_at::date', today)
        .gte('start_at', now.toISOString())
        .lte('start_at', in2h.toISOString())
        .limit(10);

      // Filtrar partidos con hueco
      const matchesConHueco = (matchRows||[]).filter(m => {
        const aprobados = (m.match_join_requests||[]).filter(r=>r.status==='approved').length;
        return (1 + aprobados) < 4;
      });

      setJugarAhoraData({ slots: slots||[], matches: matchesConHueco, loading:false });
    } catch(e) {
      setJugarAhoraData(p=>({...p, loading:false}));
    }
  }

  return (
    <div className="page pageWithHeader gpMatchesPage">
      <style>{`
        .gpMatchesPage .gpDayPill{min-width:38px;padding:6px 4px;border-radius:10px;border:none;cursor:pointer;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);text-align:center;flex-shrink:0;transition:all .15s;}
        .gpMatchesPage .gpDayPill.isActive{background:#74B800;color:#000;font-weight:900;}
        .gpMatchesPage .gpDayPill.hasMatches .gpDayNum::after{content:"·";color:#74B800;font-size:16px;line-height:0;vertical-align:middle;margin-left:1px;}
        .gpMatchesPage .gpDayPill.isActive.hasMatches .gpDayNum::after{color:#000;}
        .gpMatchesPage .gpDayLbl{font-size:9px;font-weight:700;text-transform:uppercase;opacity:.8;}
        .gpMatchesPage .gpDayNum{font-size:14px;font-weight:900;margin-top:1px;}
        .gpMatchesPage .gpInfoChip{font-size:9px!important;padding:1px 5px!important;line-height:1.3!important;display:inline-flex;align-items:center;background:rgba(255,255,255,0.08);border-radius:999px;color:rgba(255,255,255,0.75);}
        .gpMatchesPage .mCard{background:#111;border:1px solid rgba(116,184,0,0.2);border-radius:12px;overflow:hidden;}
        .gpMatchesPage .mCard .mHead{padding:6px 10px;background:#000;border-bottom:1px solid rgba(116,184,0,0.15);display:flex;justify-content:space-between;align-items:center;}
        .gpMatchesPage .mCard .mInfo{padding:4px 8px;background:rgba(0,0,0,0.35);display:flex;gap:5px;flex-wrap:wrap;align-items:center;}
        .gpMatchesPage .mCard .mActions{padding:6px 8px;background:#111;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:5px;flex-wrap:wrap;}
        .gpMatchesPage .mBtn{border:none;cursor:pointer;border-radius:8px;font-weight:900;font-size:12px;transition:opacity .15s;}
        .gpMatchesPage .mBtn:hover{opacity:.85;}
        .gpMatchesPage .mBtn.primary{flex:1;padding:7px 0;background:linear-gradient(135deg,#74B800,#9BE800);color:#000;}
        .gpMatchesPage .mBtn.danger{width:34px;height:30px;background:rgba(220,38,38,0.15);color:#ff6b6b;font-size:15px;}
        .gpMatchesPage .mBtn.icon{width:34px;height:30px;background:rgba(255,255,255,0.08);color:#fff;font-size:15px;}
        .gpMatchesPage .mBtn.leave{flex:1;padding:7px 0;background:rgba(220,38,38,0.15);color:#ff6b6b;border:1px solid rgba(220,38,38,0.3);}
      `}</style>

      <div className="pageWrap">
        <div className="container">

          {/* ── HEADER ── */}
          <div style={{padding:"10px 0 6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <h1 style={{margin:0,fontSize:22,fontWeight:900,color:"#fff"}}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="22" height="22" style={{marginRight:6,verticalAlign:"middle"}}><rect x="29" y="42" width="6" height="14" rx="3" fill="#fff"/><ellipse cx="32" cy="28" rx="13" ry="16" fill="#74B800" stroke="#111" strokeWidth="2"/><circle cx="28" cy="24" r="2" fill="#9BE800"/><circle cx="36" cy="24" r="2" fill="#9BE800"/><circle cx="32" cy="30" r="2" fill="#9BE800"/></svg><span style={{color:"#74B800"}}>Partidos</span>
              </h1>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>
                {status.loading ? "Cargando…" : `${visibleList.length} partido(s)`}
                {isClubFilter ? ` · ${clubNameParam||clubIdParam}` : ""}
              </div>
            </div>
            <button
              onClick={e=>{e.preventDefault();e.stopPropagation();setOpenCreate(true);setForm(prev=>({...prev,date:selectedDay||todayISO}));}}
              onTouchEnd={e=>{e.preventDefault();setOpenCreate(true);setForm(prev=>({...prev,date:selectedDay||todayISO}));}}
              style={{padding:"10px 16px",borderRadius:12,background:"linear-gradient(135deg,#74B800,#9BE800)",color:"#000",fontWeight:900,border:"none",fontSize:13,cursor:"pointer",whiteSpace:"nowrap",touchAction:"manipulation",zIndex:999}}
            >➕ Crear</button>
          </div>

          {/* ── JUGAR AHORA ── */}
          <div onClick={()=>{setJugarAhora(true);buscarJugarAhora();}}
            style={{margin:'6px 0 10px',padding:'12px 16px',borderRadius:14,background:'linear-gradient(135deg,rgba(116,184,0,0.15),rgba(155,232,0,0.08))',border:'1px solid rgba(116,184,0,0.3)',cursor:'pointer',display:'flex',alignItems:'center',gap:12,touchAction:'manipulation'}}>
            <div style={{fontSize:28}}>⚡</div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:900,color:'#9BE800'}}>Jugar ahora</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:2}}>Pistas libres y partidos con hueco en las próximas 2h</div>
            </div>
            <div style={{color:'#74B800',fontSize:20}}>›</div>
          </div>

          {/* ── CALENDARIO ── */}
          <div style={{display:"flex",gap:5,overflowX:"auto",padding:"4px 0 6px",WebkitOverflowScrolling:"touch"}}>
            {calendarDays.map(d => (
              <button key={d} className={`gpDayPill ${d===selectedDay?"isActive":""} ${(dayCounts[d]||0)>0?"hasMatches":""}`} onClick={()=>setSelectedDay(d)}>
                <div className="gpDayLbl">{fmtDayLabel(d)}</div>
                <div className="gpDayNum">{d.slice(8,10)}</div>
              </button>
            ))}
          </div>

          {/* ── BARRA CONTROLES ── */}
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
            {!isClubFilter && (
              <div style={{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:10,overflow:"hidden",flexShrink:0}}>
                <button onClick={()=>setViewMode("mine")} style={{padding:"7px 12px",border:"none",cursor:"pointer",fontSize:11,fontWeight:900,background:viewMode==="mine"?"#74B800":"transparent",color:viewMode==="mine"?"#000":"rgba(255,255,255,0.7)"}}>Los míos</button>
                <button onClick={()=>setViewMode("all")} style={{padding:"7px 12px",border:"none",cursor:"pointer",fontSize:11,fontWeight:900,background:viewMode==="all"?"#74B800":"transparent",color:viewMode==="all"?"#000":"rgba(255,255,255,0.7)"}}>Todos</button>
              </div>
            )}
            <input type="date" value={selectedDay} onChange={e=>setSelectedDay(e.target.value)}
              style={{padding:"6px 8px",borderRadius:8,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",fontSize:11,flex:1,minWidth:80}} />
            <button onClick={()=>setFiltersOpen(f=>!f)}
              style={{padding:"7px 12px",borderRadius:10,border:hasFilters?"1px solid #74B800":"1px solid transparent",cursor:"pointer",fontSize:11,fontWeight:900,whiteSpace:"nowrap",background:hasFilters?"rgba(116,184,0,0.2)":"rgba(255,255,255,0.08)",color:hasFilters?"#74B800":"rgba(255,255,255,0.7)"}}>
              🔍 {hasFilters?"Filtros ✓":"Filtros"}
            </button>
          </div>

          {/* ── PANEL FILTROS ── */}
          {filtersOpen && (
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:10,marginBottom:8,display:"flex",flexDirection:"column",gap:8}}>

              {/* BUSCADOR INTELIGENTE DE CLUBS */}
              <div style={{position:"relative"}}>
                {filterClubObj ? (
                  <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",borderRadius:9,background:"rgba(116,184,0,0.12)",border:"1px solid rgba(116,184,0,0.35)"}}>
                    <span style={{fontSize:12,fontWeight:800,color:"#74B800",flex:1}}>
                      🏟️ {filterClubObj.name}
                      {filterClubObj.city ? <span style={{fontWeight:400,color:"rgba(116,184,0,0.7)",marginLeft:4}}>· {filterClubObj.city}</span> : null}
                    </span>
                    <button onClick={()=>{setFilterClubObj(null);setFilterClubSearch("");setClubFilterQuery("");}}
                      style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:14,lineHeight:1,padding:"0 2px"}}>✕</button>
                  </div>
                ) : (
                  <>
                    <input
                      placeholder="🔍 Buscar club por nombre o ciudad..."
                      value={clubFilterQuery}
                      onChange={e=>{setClubFilterQuery(e.target.value);setFilterClubSearch(e.target.value);setFilterClubObj(null);setShowClubFilterSuggest(true);}}
                      onFocus={()=>setShowClubFilterSuggest(true)}
                      onBlur={()=>setTimeout(()=>setShowClubFilterSuggest(false),150)}
                      style={{...IS,padding:"7px 10px",fontSize:12}}
                    />
                    {showClubFilterSuggest && clubFilterQuery.length >= 2 && (()=>{
                      const q = clubFilterQuery.trim().toLowerCase();
                      const sugs = (clubsSheet||[]).filter(c=>{
                        const name = String(c?.name||"").toLowerCase();
                        const city = String(c?.city||"").toLowerCase();
                        return name.startsWith(q)||name.includes(q)||city.includes(q)||name.split(/\s+/).some(w=>w.startsWith(q));
                      }).sort((a,b)=>{
                        const an=String(a?.name||"").toLowerCase(), bn=String(b?.name||"").toLowerCase();
                        return (an.startsWith(q)?0:1)-(bn.startsWith(q)?0:1)||an.localeCompare(bn);
                      }).slice(0,8);
                      if (!sugs.length) return null;
                      return (
                        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:99,background:"#1a1a1a",border:"1px solid rgba(116,184,0,0.25)",borderRadius:10,overflow:"hidden",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
                          {sugs.map((c,i)=>(
                            <div key={c.id||i}
                              onMouseDown={()=>{setFilterClubObj(c);setFilterClubSearch(String(c.name||""));setClubFilterQuery(String(c.name||""));setShowClubFilterSuggest(false);}}
                              style={{padding:"9px 12px",cursor:"pointer",borderBottom:i<sugs.length-1?"1px solid rgba(255,255,255,0.05)":"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                              onMouseEnter={e=>e.currentTarget.style.background="rgba(116,184,0,0.08)"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <div>
                                <div style={{fontSize:13,fontWeight:800,color:"#fff"}}>
                                  {(()=>{const name=String(c.name||""),idx=name.toLowerCase().indexOf(q);if(idx===-1)return name;return<>{name.slice(0,idx)}<mark style={{background:"rgba(116,184,0,0.3)",color:"#74B800",borderRadius:2,padding:"0 1px"}}>{name.slice(idx,idx+q.length)}</mark>{name.slice(idx+q.length)}</>;})()}
                                </div>
                                {c.city && <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>📍 {c.city}</div>}
                              </div>
                              <span style={{fontSize:10,color:"rgba(116,184,0,0.6)",fontWeight:800}}>🏟️</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* NIVEL */}
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {["","iniciacion","medio","alto"].map(lvl=>(
                  <button key={lvl} onClick={()=>setFilterLevel(lvl)}
                    style={{padding:"4px 10px",borderRadius:999,border:"none",cursor:"pointer",fontSize:11,fontWeight:800,
                      background:filterLevel===lvl?"#74B800":"rgba(255,255,255,0.08)",
                      color:filterLevel===lvl?"#000":"#fff"}}>
                    {lvl===""?"Todos":lvl.charAt(0).toUpperCase()+lvl.slice(1)}
                  </button>
                ))}
              </div>

              {/* ÚLTIMA HORA */}
              <button onClick={()=>setFilterUltimaHora(f=>!f)}
                style={{padding:"6px 10px",borderRadius:8,border:filterUltimaHora?"1px solid #74B800":"1px solid transparent",cursor:"pointer",fontSize:11,fontWeight:800,textAlign:"left",
                  background:filterUltimaHora?"rgba(116,184,0,0.2)":"rgba(255,255,255,0.08)",
                  color:filterUltimaHora?"#74B800":"#fff"}}>
                ⚡ Última Hora — partidos en menos de 2h
              </button>

              {/* CERCA DE MÍ */}
              <div>
                <button onClick={async () => {
                  if (filterNearMe) { setFilterNearMe(false); return; }
                  setGeoLoading(true);
                  try {
                    await new Promise((resolve, reject) => {
                      navigator.geolocation.getCurrentPosition(
                        pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); resolve(); },
                        reject, { timeout: 8000 }
                      );
                    });
                    setFilterNearMe(true);
                  } catch(e) {
                    const msg = e?.code === 1 ? "Permiso denegado — activa la ubicación en tu navegador"
                      : e?.code === 2 ? "Ubicación no disponible"
                      : e?.code === 3 ? "Tiempo de espera agotado"
                      : "No se pudo obtener tu ubicación";
                    toast.error(msg);
                  } finally { setGeoLoading(false); }
                }}
                style={{width:"100%",padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:800,textAlign:"left",
                  background:filterNearMe?"rgba(116,184,0,0.2)":"rgba(255,255,255,0.08)",
                  color:filterNearMe?"#74B800":"#fff",
                  border:filterNearMe?"1px solid #74B800":"1px solid transparent"}}>
                  {geoLoading ? "📍 Obteniendo ubicación…" : filterNearMe ? "📍 Cerca de mí ✓" : "📍 Cerca de mí"}
                </button>
                {filterNearMe && (
                  <div style={{marginTop:8,padding:"0 4px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Distancia máxima</span>
                      <span style={{fontSize:11,fontWeight:900,color:"#74B800"}}>🦍 {filterDistKm} km</span>
                    </div>
                    <input type="range" min="1" max="50" step="1" value={filterDistKm}
                      onChange={e=>setFilterDistKm(Number(e.target.value))}
                      style={{width:"100%",accentColor:"#74B800",cursor:"pointer"}} />
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:2}}>
                      <span>1 km</span><span>50 km</span>
                    </div>
                  </div>
                )}
              </div>

              {/* LIMPIAR */}
              {hasFilters && (
                <button onClick={()=>{setFilterLevel("");setFilterUltimaHora(false);setFilterClubSearch("");setFilterClubObj(null);setClubFilterQuery("");setFilterNearMe(false);}}
                  style={{padding:"5px 10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:800,background:"rgba(220,38,38,0.2)",color:"#ff6b6b"}}>
                  ✕ Limpiar filtros
                </button>
              )}
            </div>
          )}

          {status.error && <div style={{padding:10,borderRadius:8,background:"rgba(220,38,38,0.2)",color:"#ff6b6b",fontSize:12,fontWeight:700,marginBottom:8}}>{status.error}</div>}

          {/* ── LISTA DE PARTIDOS ── */}
          <ul style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:8}}>
            {status.loading ? (
              <div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.5)"}}>Cargando…</div>
            ) : visibleList.length===0 ? (
              <div style={{background:"#111",borderRadius:12,padding:28,textAlign:"center",border:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{fontSize:40}}>🦍</div>
                <div style={{fontWeight:900,color:"#fff",marginTop:8}}>No hay partidos</div>
                <div style={{color:"rgba(255,255,255,0.5)",fontSize:12,marginTop:4}}>
                  {viewMode==="mine" ? "Crea uno o únete a un partido" : "Sin partidos para este día y filtros"}
                </div>
                <button onClick={()=>{setOpenCreate(true);setForm(prev=>({...prev,date:selectedDay||todayISO}));}}
                  style={{marginTop:14,padding:"9px 20px",borderRadius:10,background:"linear-gradient(135deg,#74B800,#9BE800)",color:"#000",fontWeight:900,border:"none",cursor:"pointer",fontSize:12}}>
                  ➕ Crear partido
                </button>
              </div>
            ) : visibleList.map(m => {
              const myStatus2 = normStatus(myReqStatus?.[m.id]??null);
              const isCreator = !!(session?.user?.id&&String(m.created_by_user)===String(session.user.id));
              const occupied = Math.min(4, 1 + (approvedCounts[m.id]||0));
              const left = Math.max(0,4-occupied);
              const iAmInPlayers = !!inPlayersByMatchId?.[String(m.id)];
              const iAmInside = isCreator||iAmInPlayers||myStatus2==="approved"||myStatus2==="pending";
              const creatorId = m.created_by_user ? String(m.created_by_user) : "";
              const creatorProf = rosterProfilesById?.[creatorId]||null;
              const creatorAvatar = creatorProf?.avatar_url||"";
              const matchPlayerIds = (playersByMatchId?.[String(m.id)]||[]).map(p=>String(p?.id||p?.player_uuid||"")).filter(id=>id&&id!==creatorId);
              const roster = matchPlayerIds.map(uid=>rosterProfilesById?.[uid]).filter(Boolean).slice(0,3);
              const leftTeam = [{name:creatorProf?.name||"Creador",avatar:creatorAvatar,isCreator:true,id:creatorId},roster[0]||null];
              const rightTeam = [roster[1]||null,roster[2]||null];

              return (
                <li key={m.id} className="mCard">
                  <div className="mHead">
                    <div style={{fontSize:13,fontWeight:900,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      <span style={{cursor:"pointer", textDecoration:"underline"}} 
                      onClick={e=>{e.stopPropagation(); navigate(`/club/${m.club_id}?name=${encodeURIComponent(m.club_name)}`)}}>
                      📍 {m.club_name}
                    </span>
                    </div>
                    <div style={{fontSize:10,fontWeight:800,flexShrink:0,marginLeft:8}}>
                      {isCreator && <span style={{color:"#FFD700"}}>👑 Creador</span>}
                      {!isCreator&&myStatus2==="approved" && <span style={{color:"#74B800"}}>✅ Dentro</span>}
                      {!isCreator&&myStatus2==="pending" && <span style={{color:"#FFA500"}}>⏳ Pendiente</span>}
                    </div>
                  </div>
                  <div className="gpMatchRoster">
                    <div className="gpTeamSide left">
                      {[0,1].map(idx => {
                        const player = leftTeam[idx];
                        const avatar = player?.avatar||player?.avatar_url;
                        const pid = player?.isCreator ? creatorId : player?.id;
                        return (
                          <div key={idx} style={{width:36,height:52,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {avatar ? <img src={avatar} alt="" onClick={e=>{e.stopPropagation();if(pid)navigate(`/usuario/${pid}`);}} style={{width:36,height:52,objectFit:"cover",borderRadius:6,cursor:pid?"pointer":"default"}} /> : <span style={{fontSize:28}}>🦍</span>}
                          </div>
                        );
                      })}
                    </div>
                    <img src="/images/vs-icon.png" alt="VS" className="gpVsIcon" />
                    <div className="gpTeamSide right">
                      {[0,1].map(idx => {
                        const player = rightTeam[idx];
                        const avatar = player?.avatar_url||player?.avatar;
                        const pid = player?.id;
                        return (
                          <div key={idx} style={{width:36,height:52,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {avatar ? <img src={avatar} alt="" onClick={e=>{e.stopPropagation();if(pid)navigate(`/usuario/${pid}`);}} style={{width:36,height:52,objectFit:"cover",borderRadius:6,cursor:pid?"pointer":"default"}} /> : <span style={{fontSize:28}}>🦍</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mInfo">
                    <span className="gpInfoChip">🗓️ {formatWhen(m.start_at)}</span>
                    <span className="gpInfoChip">⏱️ {m.duration_min}min</span>
                    <span className="gpInfoChip">🎚️ {String(m.level||"").toUpperCase()}</span>
                    {m.price_per_player ? <span className="gpInfoChip">💶 {m.price_per_player}€</span> : null}
                    {filterNearMe && userLat && userLng && (() => {
                      const club = clubsSheet.find(c => String(c.name||"").toLowerCase() === String(m.club_name||"").toLowerCase());
                      if (!club?.lat || !club?.lng) return null;
                      const km = haversineKm(userLat, userLng, club.lat, club.lng);
                      return <span className="gpInfoChip" style={{color:"#74B800"}}>📍 {km.toFixed(1)} km</span>;
                    })()}
                    <span className="gpInfoChip" style={{marginLeft:"auto",color:left>0?"rgba(116,184,0,0.9)":"rgba(255,100,0,0.9)"}}>
                      {left>0 ? `${left} plaza${left>1?"s":""} libre${left>1?"s":""}` : "Completo"}
                    </span>
                  </div>
                  <div className="mActions">
                    {!session && <button className="mBtn primary" onClick={goLogin}>PARTICIPAR</button>}
                    {session&&!isCreator&&!myStatus2&&left>0 && <button className="mBtn primary" onClick={()=>setMoodOpenFor(m.id)}>PARTICIPAR</button>}
                    {session&&!isCreator&&myStatus2==="approved" && (
                      <button className="mBtn leave" onClick={async()=>{ try{ await cancelMyJoin({matchId: m.id}); setMyReqStatus(prev=>{const n={...prev};delete n[m.id];return n;}); setInPlayersByMatchId(prev=>{const n={...prev};delete n[String(m.id)];return n;}); setPlayersByMatchId(prev=>{const n={...prev};if(n[String(m.id)])n[String(m.id)]=n[String(m.id)].filter(p=>String(p?.id||p?.player_uuid||'')!==String(session?.user?.id||''));return n;}); setApprovedCounts(prev=>({...prev,[m.id]:Math.max(0,(prev[m.id]||1)-1)})); toast.success("Has salido"); setTimeout(()=>load(),500); }catch(e){ toast.error(e?.message||"Error"); } }}>Salir</button>
                    )}
                    {isCreator && <button className="mBtn icon" onClick={()=>openRequests(m.id)} title="Solicitudes">📥</button>}
                    {session&&(isCreator||myStatus2==="approved"||iAmInPlayers) && (
                      <button className="mBtn icon" onClick={()=>{closeAllModals();setCedeOpenFor(m.id);setCedeQuery("");setCedeResults([]);}} title="Ceder plaza">🤝</button>
                    )}
                    {session&&iAmInside && <button className="mBtn icon" onClick={()=>openChat(m.id)} title="Chat">💬</button>}
                    {session&&isCreator && (
                      <button className="mBtn icon" onClick={()=>{closeAllModals();setInviteOpenFor(m.id);setInviteQuery("");setInviteResults([]);setInviteSelected([]);}} title="Invitar">📣</button>
                    )}
                    {session && iAmInside && (() => {
                      const startMs = safeParseDate(m.start_at)?.getTime();
                      const endMs = startMs ? startMs + (Number(m.duration_min)||90)*60000 : null;
                      const hasEnded = endMs && Date.now() > endMs;
                      if (!hasEnded) return null;
                      return (
                        <button className="mBtn icon" onClick={()=>openPostPartido(m.id)} title="Post partido"
                          style={{background:"rgba(116,184,0,0.15)",border:"1px solid rgba(116,184,0,0.3)",color:"#74B800"}}>📊</button>
                      );
                    })()}
                    {session && isCreator && (
                      <button className="mBtn icon" title="SOS Cuarto Jugador"
                        onClick={async () => {
                          if (!confirm("¿Activar SOS? Se notificará a todos los usuarios disponibles.")) return;
                          try { const { sent } = await triggerSOS({ matchId: m.id }); toast.success(`🆘 SOS enviado a ${sent} jugadores`); await load(); }
                          catch(e) { toast.error(e?.message || "Error"); }
                        }}
                        style={{width:34,height:30,borderRadius:8,background:m.sos_active?"rgba(220,38,38,0.3)":"rgba(255,165,0,0.2)",border:m.sos_active?"1px solid rgba(220,38,38,0.5)":"1px solid rgba(255,165,0,0.4)",color:m.sos_active?"#ff6b6b":"#FFA500",fontWeight:900,fontSize:13,cursor:"pointer"}}>
                        {m.sos_active ? "🆘" : "SOS"}
                      </button>
                    )}
                    {session&&isCreator && <button className="mBtn danger" onClick={()=>handleDelete(m.id)} title="Eliminar">🗑️</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ══════════════════════════════
          MODAL: CREAR PARTIDO
      ══════════════════════════════ */}
      {openCreate && (
        <div onClick={()=>setOpenCreate(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10000,padding:20,backdropFilter:"blur(4px)"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1a1a1a",borderRadius:20,padding:24,maxWidth:500,width:"100%",maxHeight:"85vh",overflowY:"auto",border:"1px solid rgba(116,184,0,0.25)"}}>
            <h2 style={{color:"#74B800",marginBottom:20,fontSize:20,fontWeight:900}}>➕ Crear Partido</h2>
            {saveError && <div style={{background:"rgba(220,38,38,0.2)",padding:10,borderRadius:8,color:"#ff6b6b",marginBottom:12,fontSize:12,fontWeight:700}}>{saveError}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={{color:"#fff",display:"block",marginBottom:6,fontSize:12,fontWeight:700}}>Club *</label>
                <input type="text" value={clubQuery} onChange={e=>{setClubQuery(e.target.value);setShowClubSuggest(true);}} placeholder="Buscar club..." disabled={saving} style={IS} />
                {showClubSuggest&&clubSuggestions.length>0 && (
                  <div style={{background:"#2a2a2a",borderRadius:10,marginTop:6,maxHeight:180,overflowY:"auto",border:"1px solid rgba(255,255,255,0.1)"}}>
                    {clubSuggestions.map((c,idx)=>(
                      <div key={c.id||idx} onClick={()=>pickClub(c)} style={{padding:10,cursor:"pointer",color:"#fff",fontSize:13,borderBottom:idx<clubSuggestions.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{color:"#fff",display:"block",marginBottom:6,fontSize:12,fontWeight:700}}>Fecha</label>
                  <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} disabled={saving} style={IS} />
                </div>
                <div>
                  <label style={{color:"#fff",display:"block",marginBottom:6,fontSize:12,fontWeight:700}}>Hora</label>
                  <input type="time" step="900" value={form.time} onChange={e=>{ const [h,min]=e.target.value.split(":"); const rm=Math.round(+min/15)*15; setForm({...form,time:`${h}:${String(rm%60).padStart(2,"0")}`}); }} disabled={saving} style={IS} />
                </div>
              </div>
              <div>
                <label style={{color:"#fff",display:"block",marginBottom:6,fontSize:12,fontWeight:700}}>Nivel</label>
                <select value={form.level} onChange={e=>setForm({...form,level:e.target.value})} disabled={saving} style={IS}>
                  <option value="iniciacion" style={{background:"#1a1a1a"}}>Iniciación</option>
                  <option value="medio" style={{background:"#1a1a1a"}}>Medio</option>
                  <option value="alto" style={{background:"#1a1a1a"}}>Alto</option>
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{color:"#fff",display:"block",marginBottom:6,fontSize:12,fontWeight:700}}>Duración (min)</label>
                  <input type="number" value={form.durationMin} onChange={e=>setForm({...form,durationMin:parseInt(e.target.value)||90})} disabled={saving} min="30" max="180" step="15" style={IS} />
                </div>
                <div>
                  <label style={{color:"#fff",display:"block",marginBottom:6,fontSize:12,fontWeight:700}}>Precio/jugador €</label>
                  <input type="number" value={form.pricePerPlayer} onChange={e=>setForm({...form,pricePerPlayer:e.target.value})} disabled={saving} placeholder="0" min="0" step="0.5" style={IS} />
                </div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:6}}>
                <button onClick={handleCreate} disabled={saving}
                  style={{flex:1,padding:14,borderRadius:12,background:saving?"rgba(116,184,0,0.4)":"linear-gradient(135deg,#74B800,#9BE800)",color:"#000",fontWeight:900,border:"none",cursor:saving?"not-allowed":"pointer",fontSize:14,boxShadow:"0 4px 12px rgba(116,184,0,0.3)"}}>
                  {saving?"⏳ Creando...":"✅ Crear Partido"}
                </button>
                <button onClick={()=>setOpenCreate(false)} disabled={saving}
                  style={{padding:"14px 18px",borderRadius:12,background:"rgba(255,255,255,0.08)",color:"#fff",fontWeight:700,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",fontSize:14}}>❌</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          MODAL: CHAT
      ══════════════════════════════ */}
            {chatOpenFor && (
        <div onClick={()=>setChatOpenFor(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:30000,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:"env(safe-area-inset-bottom)",overscrollBehavior:"contain"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"min(640px,100%)",background:"#0f0f0f",borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.1)",display:"flex",flexDirection:"column",maxHeight:"80vh",overflow:"hidden"}}>
            <div style={{padding:"14px 16px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div>
                <div style={{fontWeight:900,color:"#fff",fontSize:15}}>💬 Chat del partido</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{Object.keys(rosterProfilesById||{}).length} jugadores</div>
              </div>
              <button onClick={()=>setChatOpenFor(null)} style={{width:30,height:30,borderRadius:999,background:"rgba(255,255,255,0.08)",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:16,display:"grid",placeItems:"center"}}>✕</button>
            </div>
            <div style={{padding:"8px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",gap:8,overflowX:"auto",flexShrink:0}}>
              {Object.values(rosterProfilesById||{}).slice(0,8).map((p,i)=>{
                const pname = p?.name||p?.handle||"?";
                return (
                  <div key={p?.id||i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
                    <div style={{width:32,height:32,borderRadius:999,overflow:"hidden",background:"rgba(116,184,0,0.2)",border:"1.5px solid rgba(116,184,0,0.3)",display:"grid",placeItems:"center"}}>
                      {p?.avatar_url ? <img src={p.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:14,fontWeight:900,color:"#74B800"}}>{pname[0].toUpperCase()}</span>}
                    </div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700,maxWidth:36,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pname.split(" ")[0]}</div>
                  </div>
                );
              })}
            </div>
            <div style={{flex:"1 1 auto",overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:8,WebkitOverflowScrolling:"touch"}}
              ref={el=>{if(el){el.scrollTop=el.scrollHeight;}}}>
              {chatLoading
                ? <div style={{textAlign:"center",color:"rgba(255,255,255,0.4)",padding:20}}>Cargando…</div>
                : chatItems.length===0
                  ? <div style={{textAlign:"center",padding:"30px 0"}}>
                      <div style={{fontSize:32,marginBottom:8}}>💬</div>
                      <div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>Sé el primero en escribir</div>
                    </div>
                  : chatItems.map((it,idx)=>{
                      const isMe = String(it.user_id)===String(session?.user?.id);
                      const prof = rosterProfilesById?.[String(it.user_id)];
                      const pname = prof?.name||prof?.handle||"Jugador";
                      const avatar = prof?.avatar_url;
                      const showName = !isMe && (idx===0||chatItems[idx-1]?.user_id!==it.user_id);
                      const time = it.created_at ? new Date(it.created_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}) : "";
                      return (
                        <div key={it.id||idx} style={{display:"flex",flexDirection:isMe?"row-reverse":"row",alignItems:"flex-end",gap:6}}>
                          {!isMe && (
                            <div style={{width:26,height:26,borderRadius:999,overflow:"hidden",background:"rgba(116,184,0,0.2)",flexShrink:0,display:"grid",placeItems:"center",visibility:showName?"visible":"hidden"}}>
                              {avatar ? <img src={avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:12,fontWeight:900,color:"#74B800"}}>{pname[0].toUpperCase()}</span>}
                            </div>
                          )}
                          <div style={{maxWidth:"72%",display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",gap:2}}>
                            {showName && <div style={{fontSize:10,color:"#74B800",fontWeight:800,paddingLeft:4}}>{pname}</div>}
                            <div style={{padding:"8px 12px",borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",background:isMe?"linear-gradient(135deg,#74B800,#9BE800)":"rgba(255,255,255,0.09)",color:isMe?"#000":"#fff",fontSize:13,lineHeight:1.4,overflowWrap:"anywhere",fontWeight:isMe?700:400}}>
                              {it.message||it.text||""}
                            </div>
                            <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",paddingLeft:4,paddingRight:4}}>{time}</div>
                          </div>
                        </div>
                      );
                    })
              }
            </div>
            <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",gap:8,alignItems:"center",flexShrink:0,paddingBottom:"max(10px,env(safe-area-inset-bottom))"}}>
              <input value={chatText} onChange={e=>setChatText(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSendChat();}}}
                placeholder="Escribe un mensaje…"
                style={{flex:1,padding:"10px 14px",borderRadius:999,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",fontSize:14,outline:"none",minWidth:0}} />
              <button onClick={handleSendChat} disabled={!chatText.trim()}
                style={{width:38,height:38,borderRadius:999,background:chatText.trim()?"linear-gradient(135deg,#74B800,#9BE800)":"rgba(255,255,255,0.08)",border:"none",color:chatText.trim()?"#000":"rgba(255,255,255,0.3)",cursor:chatText.trim()?"pointer":"default",fontSize:18,display:"grid",placeItems:"center",flexShrink:0,transition:"all .15s"}}>↑</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          MODAL: SOLICITUDES
      ══════════════════════════════ */}
      {requestsOpenFor && (
        <div onClick={()=>setRequestsOpenFor(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:28000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"#111",borderRadius:18,border:"1px solid rgba(255,255,255,0.14)",padding:16,maxHeight:"80vh",overflow:"auto",boxSizing:"border-box"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:900,color:"#74B800",fontSize:16}}>📥 Solicitudes pendientes</div>
              <button onClick={()=>setRequestsOpenFor(null)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,color:"#fff",padding:"4px 10px",cursor:"pointer",fontWeight:900}}>❌</button>
            </div>
            {pendingBusy ? <div style={{color:"rgba(255,255,255,0.6)"}}>Cargando…</div>
            : pending.length===0 ? <div style={{color:"rgba(255,255,255,0.6)"}}>No hay solicitudes pendientes.</div>
            : pending.map(r=>{
              const pid=String(r.user_id||"");
              const p=profilesById?.[pid]||null;
              const name=(p?.name&&String(p.name).trim())||(p?.handle&&String(p.handle).trim())||pid.slice(0,8);
              return (
                <div key={r.id} style={{marginTop:8,padding:12,borderRadius:12,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                  <div>
                    <div style={{color:"#fff",fontWeight:900}}>
                      {name}
                      {(Number(profilesById?.[pid]?.red_cards)||0) >= 3 && <span style={{marginLeft:6}}>🟥🟥🟥</span>}
                      {(Number(profilesById?.[pid]?.red_cards)||0) === 2 && <span style={{marginLeft:6}}>🟥🟥</span>}
                      {(Number(profilesById?.[pid]?.red_cards)||0) === 1 && <span style={{marginLeft:6}}>🟥</span>}
                    </div>
                    <div style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>@{p?.handle||pid.slice(0,6)}</div>
                    {r.mood && (
                      <div style={{fontSize:11,marginTop:3}}>
                        {r.mood==="win"?"🔥 Viene a ganar":r.mood==="fun"?"😎 A pasarlo bien":r.mood==="beer"?"🍺 Penúltimo Sed":""}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>handleApprove(r.id)} style={{padding:"7px 12px",borderRadius:8,background:"#74B800",color:"#000",fontWeight:900,border:"none",cursor:"pointer",fontSize:12}}>Aprobar</button>
                    <button onClick={()=>handleReject(r.id)} style={{padding:"7px 12px",borderRadius:8,background:"rgba(255,255,255,0.08)",color:"#fff",fontWeight:900,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",fontSize:12}}>Rechazar</button>
                    {(normStatus(r.status)==="approved"||normStatus(r.status)==="red_carded") && (
                      <button
                        onClick={async()=>{
                          if (!confirm(`¿Dar tarjeta roja a este jugador por no presentarse?`)) return;
                          try { const {newCount} = await giveRedCard({matchId:requestsOpenFor, toUserId:r.user_id}); toast.success(`🟥 Tarjeta roja dada (total: ${newCount})`); await openRequests(requestsOpenFor); }
                          catch(e) { toast.error(e?.message||"Error"); }
                        }}
                        style={{padding:"7px 10px",borderRadius:8,background:"rgba(220,38,38,0.2)",color:"#ff6b6b",fontWeight:900,border:"1px solid rgba(220,38,38,0.3)",cursor:"pointer",fontSize:14}}
                        title="Tarjeta roja — no se presentó">🟥</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          MODAL: INVITAR
      ══════════════════════════════ */}
      {inviteOpenFor && (
        <div onClick={()=>setInviteOpenFor(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:29000,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"min(560px,calc(100% - 24px))",background:"#111",borderRadius:18,border:"1px solid rgba(255,255,255,0.14)",padding:16,maxHeight:"70vh",overflow:"auto",boxSizing:"border-box"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:900,color:"#74B800",fontSize:16}}>📣 Invitar jugadores</div>
              <button onClick={()=>setInviteOpenFor(null)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,color:"#fff",padding:"4px 10px",cursor:"pointer",fontWeight:900}}>❌</button>
            </div>
            <input value={inviteQuery} onChange={e=>setInviteQuery(e.target.value)} placeholder="Busca por nombre o @handle… (mín. 3 letras)" style={{...IS,marginBottom:10}} />
            {inviteSelected.length>0 && (
              <div style={{marginBottom:10,display:"flex",gap:6,flexWrap:"wrap"}}>
                {inviteSelected.map(id=>(
                  <button key={id} onClick={()=>setInviteSelected(prev=>prev.filter(x=>x!==id))}
                    style={{padding:"3px 8px",borderRadius:8,background:"rgba(116,184,0,0.2)",border:"1px solid #74B800",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:800}}>
                    ✅ {String(id).slice(0,8)} ✕
                  </button>
                ))}
              </div>
            )}
            {inviteQuery.trim().length<3 ? <div style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>Escribe al menos 3 letras.</div>
            : inviteResults.length===0 ? <div style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>Sin resultados.</div>
            : inviteResults.map(p=>{
              const pid=String(p.id);
              const name=(p?.name&&String(p.name).trim())||(p?.handle&&String(p.handle).trim())||pid.slice(0,8);
              const selected=inviteSelected.includes(pid);
              return (
                <button key={pid} onClick={()=>setInviteSelected(prev=>prev.includes(pid)?prev.filter(x=>x!==pid):[...prev,pid].slice(0,10))}
                  style={{width:"100%",textAlign:"left",marginBottom:6,padding:10,borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:selected?"rgba(116,184,0,0.18)":"rgba(255,255,255,0.04)",color:"#fff",cursor:"pointer"}}>
                  <div style={{fontWeight:900}}>{selected?"✅ ":""}{name}</div>
                  <div style={{opacity:0.5,fontSize:11}}>@{p?.handle||pid.slice(0,6)}</div>
                </button>
              );
            })}
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>sendInvites({matchId:inviteOpenFor,userIds:inviteSelected})} disabled={inviteBusy||inviteSelected.length===0}
                style={{flex:1,padding:12,borderRadius:10,background:inviteBusy||inviteSelected.length===0?"rgba(116,184,0,0.3)":"#74B800",color:"#000",fontWeight:900,border:"none",cursor:inviteBusy||inviteSelected.length===0?"not-allowed":"pointer",fontSize:13}}>
                {inviteBusy?"Enviando…":`Enviar (${inviteSelected.length})`}
              </button>
              <button onClick={()=>{setInviteQuery("");setInviteResults([]);setInviteSelected([]);}}
                style={{padding:"12px 14px",borderRadius:10,background:"rgba(255,255,255,0.08)",color:"#fff",fontWeight:700,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",fontSize:12}}>Limpiar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          MODAL: CEDER PLAZA
      ══════════════════════════════ */}
      {cedeOpenFor && (
        <div onClick={()=>setCedeOpenFor(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:26000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"#111",borderRadius:18,border:"1px solid rgba(255,255,255,0.14)",padding:16,maxHeight:"80vh",overflow:"auto",boxSizing:"border-box"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:900,color:"#74B800",fontSize:16}}>🤝 Ceder plaza</div>
              <button onClick={()=>setCedeOpenFor(null)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,color:"#fff",padding:"4px 10px",cursor:"pointer",fontWeight:900}}>❌</button>
            </div>
            <input value={cedeQuery} onChange={e=>setCedeQuery(e.target.value)} placeholder="Busca a quién ceder (mín. 3 letras)…" style={IS} />
            <div style={{marginTop:10}}>
              {cedeQuery.trim().length<3 ? <div style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>Escribe al menos 3 letras.</div>
              : cedeResults.length===0 ? <div style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>Sin resultados.</div>
              : cedeResults.map(p=>{
                const pid=String(p.id);
                const name=(p?.name&&String(p.name).trim())||(p?.handle&&String(p.handle).trim())||pid.slice(0,8);
                return (
                  <div key={pid} style={{marginTop:8,padding:10,borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                    <div>
                      <div style={{fontWeight:900}}>{name}</div>
                      <div style={{opacity:0.5,fontSize:11}}>@{p?.handle||pid.slice(0,6)}</div>
                    </div>
                    <button onClick={()=>transferSpot({matchId:cedeOpenFor,toUserId:pid})} disabled={cedeBusy}
                      style={{padding:"7px 14px",borderRadius:8,background:"#74B800",color:"#000",fontWeight:900,border:"none",cursor:cedeBusy?"not-allowed":"pointer",fontSize:12,opacity:cedeBusy?0.6:1}}>
                      {cedeBusy?"Cediendo…":"Ceder"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          MODAL: POST PARTIDO
      ══════════════════════════════ */}
      {postOpenFor && (
        <div onClick={()=>setPostOpenFor(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:35000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:500,background:"#1a1a1a",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto",border:"1px solid rgba(116,184,0,0.25)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:18,fontWeight:900,color:"#74B800"}}>📊 Post Partido</div>
              <button onClick={()=>setPostOpenFor(null)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,color:"#fff",padding:"4px 10px",cursor:"pointer",fontWeight:900}}>❌</button>
            </div>
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:14,marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:800,color:"rgba(255,255,255,0.6)",marginBottom:10}}>RESULTADO</div>
              {postResult ? (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(postResult.sets||[{l:postResult.score_left,r:postResult.score_right}]).map((s,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,padding:"8px",borderRadius:10,background:"rgba(255,255,255,0.04)"}}>
                      <span style={{fontSize:22,fontWeight:900,color:s.l>s.r?"#74B800":"rgba(255,255,255,0.5)"}}>{s.l}</span>
                      <span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Set {i+1}</span>
                      <span style={{fontSize:22,fontWeight:900,color:s.r>s.l?"#74B800":"rgba(255,255,255,0.5)"}}>{s.r}</span>
                    </div>
                  ))}
                  <div style={{textAlign:"center",fontSize:14,fontWeight:900,color:"#74B800",marginTop:4}}>
                    {(()=>{const wL=(postResult.sets||[]).filter(s=>s.l>s.r).length;const wR=(postResult.sets||[]).filter(s=>s.r>s.l).length;return wL||wR?`Resultado: Eq. A ${wL} — ${wR} Eq. B`:""})()}
                  </div>
                  {postResult.notes && <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:4,textAlign:"center"}}>{postResult.notes}</div>}
                </div>
              ) : (
                visibleList.find(m=>m.id===postOpenFor)?.created_by_user === session?.user?.id ? (
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <div style={{fontSize:11,fontWeight:900,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1}}>Sets</div>
                      <button onClick={()=>setPostSets(s=>[...s,{l:0,r:0}])} style={{padding:"4px 10px",borderRadius:8,background:"rgba(116,184,0,0.2)",border:"1px solid rgba(116,184,0,0.3)",color:"#74B800",fontWeight:900,fontSize:11,cursor:"pointer"}}>+ Set</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto 1fr auto",alignItems:"center",gap:4,marginBottom:4}}>
                      <div style={{fontSize:10,fontWeight:900,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>Eq. A</div>
                      <div/>
                      <div style={{fontSize:10,fontWeight:900,color:"rgba(255,255,255,0.3)",textAlign:"center"}}></div>
                      <div/>
                      <div style={{fontSize:10,fontWeight:900,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>Eq. B</div>
                    </div>
                    {postSets.map((set,si)=>(
                      <div key={si} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr auto",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                          <button onClick={()=>setPostSets(s=>s.map((x,i)=>i===si?{...x,l:Math.max(0,x.l-1)}:x))} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.08)",border:"none",color:"#fff",cursor:"pointer",fontWeight:900}}>−</button>
                          <span style={{fontSize:24,fontWeight:900,color:set.l>set.r?"#74B800":set.l<set.r?"rgba(255,255,255,0.4)":"#fff",minWidth:28,textAlign:"center"}}>{set.l}</span>
                          <button onClick={()=>setPostSets(s=>s.map((x,i)=>i===si?{...x,l:x.l+1}:x))} style={{width:26,height:26,borderRadius:6,background:"rgba(116,184,0,0.2)",border:"none",color:"#fff",cursor:"pointer",fontWeight:900}}>+</button>
                        </div>
                        <div style={{fontSize:14,fontWeight:900,color:"rgba(255,255,255,0.2)",textAlign:"center"}}>—</div>
                        <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                          <button onClick={()=>setPostSets(s=>s.map((x,i)=>i===si?{...x,r:Math.max(0,x.r-1)}:x))} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.08)",border:"none",color:"#fff",cursor:"pointer",fontWeight:900}}>−</button>
                          <span style={{fontSize:24,fontWeight:900,color:set.r>set.l?"#74B800":set.r<set.l?"rgba(255,255,255,0.4)":"#fff",minWidth:28,textAlign:"center"}}>{set.r}</span>
                          <button onClick={()=>setPostSets(s=>s.map((x,i)=>i===si?{...x,r:x.r+1}:x))} style={{width:26,height:26,borderRadius:6,background:"rgba(116,184,0,0.2)",border:"none",color:"#fff",cursor:"pointer",fontWeight:900}}>+</button>
                        </div>
                        {postSets.length>1 && <button onClick={()=>setPostSets(s=>s.filter((_,i)=>i!==si))} style={{width:22,height:22,borderRadius:6,background:"rgba(220,38,38,0.15)",border:"none",color:"#ff6b6b",cursor:"pointer",fontSize:12,fontWeight:900}}>✕</button>}
                        {postSets.length===1 && <div style={{width:22}}/>}
                      </div>
                    ))}
                    {(()=>{const wL=postSets.filter(s=>s.l>s.r).length;const wR=postSets.filter(s=>s.r>s.l).length;if(!wL&&!wR)return null;return(<div style={{textAlign:"center",padding:"8px",borderRadius:10,background:wL>wR?"rgba(116,184,0,0.1)":wR>wL?"rgba(116,184,0,0.1)":"rgba(255,255,255,0.04)",border:"1px solid rgba(116,184,0,0.2)",marginTop:4}}><span style={{fontSize:13,fontWeight:900,color:"#74B800"}}>{wL>wR?"🏆 Gana Equipo A":"🏆 Gana Equipo B"} · {wL}–{wR}</span></div>);})()}
                    <input placeholder="Notas del partido (opcional)…" value={postNotes} onChange={e=>setPostNotes(e.target.value)} style={{...IS,fontSize:12,padding:"8px 10px"}} />
                    <button onClick={async()=>{
                      try { setPostSaving(true); const winsL=postSets.filter(s=>s.l>s.r).length; const winsR=postSets.filter(s=>s.r>s.l).length; const r = await submitMatchResult({matchId:postOpenFor,scoreLeft:winsL,scoreRight:winsR,notes:postNotes,sets:postSets}); setPostResult(r); toast.success("Resultado guardado ✅"); }
                      catch(e){ toast.error(e?.message||"Error"); } finally { setPostSaving(false); }
                    }} disabled={postSaving}
                      style={{padding:"10px",borderRadius:10,background:"linear-gradient(135deg,#74B800,#9BE800)",color:"#000",fontWeight:900,border:"none",cursor:"pointer",fontSize:13}}>
                      {postSaving?"Guardando…":"✅ Guardar resultado"}
                    </button>
                  </div>
                ) : (
                  <div style={{textAlign:"center",color:"rgba(255,255,255,0.5)",fontSize:12}}>El creador aún no ha publicado el resultado.</div>
                )
              )}
            </div>
            {postRoster.length > 0 && (
              <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:14}}>
                <div style={{fontSize:12,fontWeight:800,color:"rgba(255,255,255,0.6)",marginBottom:10}}>VALORA A TUS COMPAÑEROS</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {postRoster.map(p => {
                    const pid = String(p.id);
                    const myRating = postMyRatings.find(r=>r.to_user_id===pid);
                    const currentRating = postRatings[pid] || myRating?.rating || 0;
                    const currentVibe = postVibes[pid] || myRating?.vibe || "";
                    const alreadyRated = !!myRating;
                    return (
                      <div key={pid} style={{padding:10,borderRadius:10,background:"rgba(255,255,255,0.04)",border:`1px solid ${alreadyRated?"rgba(116,184,0,0.3)":"rgba(255,255,255,0.08)"}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          {p.avatar_url ? <img src={p.avatar_url} alt="" style={{width:28,height:28,borderRadius:"50%",objectFit:"cover"}} /> : <span style={{fontSize:20}}>🦍</span>}
                          <div style={{fontWeight:800,color:"#fff",fontSize:13}}>{p.name||p.handle||"Jugador"}</div>
                          {alreadyRated && <span style={{marginLeft:"auto",fontSize:10,color:"#74B800",fontWeight:800}}>✅ Valorado</span>}
                        </div>
                        <div style={{display:"flex",gap:4,marginBottom:8}}>
                          {[1,2,3,4,5].map(star=>(
                            <button key={star} onClick={()=>setPostRatings(prev=>({...prev,[pid]:star}))}
                              style={{flex:1,padding:"6px 0",borderRadius:6,border:"none",cursor:"pointer",fontSize:16,background:currentRating>=star?"rgba(116,184,0,0.3)":"rgba(255,255,255,0.06)"}}>
                              {currentRating>=star?"⭐":"☆"}
                            </button>
                          ))}
                        </div>
                        <div style={{display:"flex",gap:4,marginBottom:8}}>
                          {["🔥","😎","🤝","💪","🧠"].map(v=>(
                            <button key={v} onClick={()=>setPostVibes(prev=>({...prev,[pid]:v}))}
                              style={{flex:1,padding:"4px 0",borderRadius:6,border:currentVibe===v?"1px solid #74B800":"1px solid transparent",cursor:"pointer",fontSize:16,background:currentVibe===v?"rgba(116,184,0,0.2)":"rgba(255,255,255,0.06)"}}>
                              {v}
                            </button>
                          ))}
                        </div>
                        {!alreadyRated && currentRating > 0 && (
                          <button onClick={async()=>{
                            try { await submitPlayerRating({matchId:postOpenFor,toUserId:pid,rating:currentRating,vibe:currentVibe}); setPostMyRatings(prev=>[...prev,{to_user_id:pid,rating:currentRating,vibe:currentVibe}]); toast.success("Valoración enviada 🦍"); }
                            catch(e){ toast.error(e?.message||"Error"); }
                          }}
                            style={{width:"100%",padding:"7px",borderRadius:8,background:"#74B800",color:"#000",fontWeight:900,border:"none",cursor:"pointer",fontSize:12}}>
                            Enviar valoración
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          MODAL: GORILA MOOD
      ══════════════════════════════ */}
      {moodOpenFor && (
        <div onClick={()=>setMoodOpenFor(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:40000,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0 0 env(safe-area-inset-bottom)"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,background:"#1a1a1a",borderRadius:"20px 20px 0 0",padding:"24px 20px 32px",border:"1px solid rgba(116,184,0,0.25)"}}>
            <div style={{width:40,height:4,background:"rgba(255,255,255,0.2)",borderRadius:999,margin:"0 auto 20px"}} />
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:32}}>🦍</div>
              <div style={{fontSize:18,fontWeight:900,color:"#fff",marginTop:6}}>¿Con qué Gorila Mood vienes?</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:4}}>El creador verá tu actitud</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {key:"win", emoji:"🔥", label:"Vengo a ganar", desc:"Sin piedad"},
                {key:"fun", emoji:"😎", label:"A pasarlo bien", desc:"El resultado da igual"},
                {key:"beer", emoji:"🍺", label:"Lo importante es el Penúltimo Sed", desc:"Prioridades claras"},
              ].map(mood=>(
                <button key={mood.key}
                  onClick={async()=>{
                    const matchId = moodOpenFor;
                    setMoodOpenFor(null);
                    try { await requestJoin(matchId, mood.key); toast.success(`Solicitud enviada ${mood.emoji}`); await load(); }
                    catch(e) { toast.error(e?.message||"Error"); }
                  }}
                  style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",cursor:"pointer",textAlign:"left"}}
                  onMouseOver={e=>e.currentTarget.style.background="rgba(116,184,0,0.15)"}
                  onMouseOut={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}>
                  <span style={{fontSize:32,flexShrink:0}}>{mood.emoji}</span>
                  <div>
                    <div style={{color:"#fff",fontWeight:900,fontSize:15}}>{mood.label}</div>
                    <div style={{color:"rgba(255,255,255,0.5)",fontSize:12,marginTop:2}}>{mood.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={()=>setMoodOpenFor(null)} style={{width:"100%",marginTop:14,padding:"11px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:"none",color:"rgba(255,255,255,0.5)",fontWeight:700,cursor:"pointer",fontSize:13}}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>

      {/* ── MODAL JUGAR AHORA ── */}
      {jugarAhora && (
        <div onClick={()=>setJugarAhora(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:60000,overflowY:'auto'}}>
          <div onClick={e=>e.stopPropagation()} style={{maxWidth:640,margin:'0 auto',padding:'20px 16px',paddingBottom:'max(32px,env(safe-area-inset-bottom))'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
              <button onClick={()=>setJugarAhora(false)} style={{background:'none',border:'none',color:'#74B800',fontSize:22,cursor:'pointer'}}>←</button>
              <div>
                <div style={{fontSize:18,fontWeight:900,color:'#9BE800'}}>⚡ Jugar ahora</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Próximas 2 horas</div>
              </div>
            </div>

            {jugarAhoraData.loading && (
              <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.4)'}}>Buscando opciones…</div>
            )}

            {!jugarAhoraData.loading && (
              <>
                {/* Pistas libres */}
                {jugarAhoraData.slots.length > 0 && (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>🏟️ Pistas libres ahora</div>
                    {jugarAhoraData.slots.map(s=>(
                      <div key={s.id} onClick={()=>{setJugarAhora(false); navigate(`/club/${s.club_id}?tab=reservar`);}}
                        style={{background:'#111',borderRadius:12,border:'1px solid rgba(116,184,0,0.2)',padding:'12px 14px',marginBottom:8,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:900,color:'#fff'}}>{s.club_courts?.name || 'Pista'} {s.club_courts?.court_type==='indoor'?'🏠':'☀️'}</div>
                          <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginTop:2}}>🕐 {s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</div>
                          <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:2}}>{s.club_id}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:20,fontWeight:900,color:'#74B800'}}>{s.price}€</div>
                          <div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>por hora</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Partidos con hueco */}
                {jugarAhoraData.matches.length > 0 && (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>🏓 Partidos con hueco</div>
                    {jugarAhoraData.matches.map(m=>{
                      const aprobados = (m.match_join_requests||[]).filter(r=>r.status==='approved').length;
                      const ocupados = 1 + aprobados;
                      const libres = 4 - ocupados;
                      return (
                        <div key={m.id} onClick={()=>{setJugarAhora(false); navigate(`/partidos?openChat=${m.id}`);}}
                          style={{background:'#111',borderRadius:12,border:'1px solid rgba(116,184,0,0.2)',padding:'12px 14px',marginBottom:8,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:900,color:'#fff'}}>{m.club_name||'Partido'}</div>
                            <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginTop:2}}>🕐 {String(m.start_at||'').slice(11,16)} · {m.level}</div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:16,fontWeight:900,color:'#74B800'}}>{libres} libre{libres!==1?'s':''}</div>
                            <div style={{display:'flex',gap:3,marginTop:4}}>
                              {[0,1,2,3].map(i=>(
                                <div key={i} style={{width:14,height:14,borderRadius:3,background:i<ocupados?'#74B800':'rgba(255,255,255,0.1)'}}/>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {jugarAhoraData.slots.length === 0 && jugarAhoraData.matches.length === 0 && (
                  <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.4)'}}>
                    <div style={{fontSize:40,marginBottom:8}}>😔</div>
                    <div style={{fontSize:15,fontWeight:900,color:'#fff',marginBottom:6}}>Nada disponible ahora</div>
                    <div style={{fontSize:12,marginBottom:20}}>No hay pistas libres ni partidos con hueco en las próximas 2h</div>
                    <button onClick={()=>{setJugarAhora(false);setOpenCreate(true);}}
                      style={{padding:'12px 24px',borderRadius:12,background:'linear-gradient(135deg,#74B800,#9BE800)',border:'none',color:'#000',fontWeight:900,fontSize:13,cursor:'pointer'}}>
                      ➕ Crear un partido
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}