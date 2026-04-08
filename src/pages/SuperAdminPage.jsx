// src/pages/SuperAdminPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useFeatures } from "../contexts/FeaturesContext";



const AUDIT_CHECKLIST = {
  bronce: ["Rampa de entrada", "Aseo adaptado", "Aparcamiento accesible"],
  plata: ["Rampa de entrada", "Aseo adaptado", "Aparcamiento accesible", "Vestuarios adaptados", "Pistas accesibles", "Señalética clara"],
  oro: ["Rampa de entrada", "Aseo adaptado", "Aparcamiento accesible", "Vestuarios adaptados", "Pistas accesibles", "Señalética clara", "Silla de ruedas disponible", "Personal formado", "Programa inclusivo activo"],
};

const LEVEL_CONFIG = {
  bronce: { emoji: "🥉", label: "Bronce", color: "#CD7F32", bg: "rgba(205,127,50,0.12)", border: "rgba(205,127,50,0.35)" },
  plata:  { emoji: "🥈", label: "Plata",  color: "#C0C0C0", bg: "rgba(192,192,192,0.12)", border: "rgba(192,192,192,0.35)" },
  oro:    { emoji: "🥇", label: "Oro",    color: "#FFD700", bg: "rgba(255,215,0,0.12)",   border: "rgba(255,215,0,0.35)" },
};

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("clubs");
  const [pendingClubs, setPendingClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [foundations, setFoundations] = useState([]);
  const [foundationForm, setFoundationForm] = useState({name:'',description:'',logo_url:'',website:'',iban:'',contact_email:''});
  const [editingFoundation, setEditingFoundation] = useState(null);
  const [savingFoundation, setSavingFoundation] = useState(false);
  const [appFeatures, setAppFeatures] = useState([]);
  const [audits, setAudits] = useState([]);
  const [projects, setProjects] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [projectForm, setProjectForm] = useState({ title: '', description: '', goal_amount: '', category: 'inclusivo', featured: false });
  const [editingProject, setEditingProject] = useState(null);
  const [savingProject, setSavingProject] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [auditForm, setAuditForm] = useState({ club_id: "", level: "bronce", notes: "" });
  const [savingAudit, setSavingAudit] = useState(false);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [savingFeature, setSavingFeature] = useState(null);
  const { loadFeatures } = useFeatures();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data?.session) {
        navigate("/");
        return;
      }
      // Verificar is_super_admin en BD
      const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", data.session.user.id).single();
      if (!profile?.is_super_admin) {
        navigate("/");
        return;
      }
      setSession(data.session);
      loadPendingClubs();
      loadFoundations();
      loadAppFeatures();
      loadAudits();
      loadProjects();
      loadProposals();
      loadClubs();
    });
  }, []);

  async function loadPendingClubs() {
    setLoading(true);
    const { data } = await supabase
      .from("clubs")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: false });
    setPendingClubs(data || []);
    setLoading(false);
  }

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setProjects(data || []);
  }

  async function loadProposals() {
    const { data } = await supabase.from('project_proposals').select('*, profiles(name)').order('created_at', { ascending: false });
    setProposals(data || []);
  }

  async function saveProject() {
    if (!projectForm.title.trim()) return;
    setSavingProject(true);
    try {
      if (editingProject && editingProject !== 'new') {
        await supabase.from('projects').update({ ...projectForm, goal_amount: parseFloat(projectForm.goal_amount) || 1000, updated_at: new Date().toISOString() }).eq('id', editingProject);
      } else {
        await supabase.from('projects').insert({ ...projectForm, goal_amount: parseFloat(projectForm.goal_amount) || 1000, current_amount: 0, active: true });
      }
      await loadProjects();
      setEditingProject(null);
      setProjectForm({ title: '', description: '', goal_amount: '', category: 'inclusivo', featured: false });
    } catch(e) { alert(e.message); }
    finally { setSavingProject(false); }
  }

  async function toggleProject(id, active) {
    await supabase.from('projects').update({ active }).eq('id', id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, active } : p));
  }

  async function updateProposalStatus(id, status) {
    await supabase.from('project_proposals').update({ status }).eq('id', id);
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  }

  async function loadAudits() {
    const { data } = await supabase.from("club_audits").select("*, clubs(name)").eq("active", true).order("audited_at", { ascending: false });
    setAudits(data || []);
  }

  async function loadClubs() {
    const { data } = await supabase.from("clubs").select("id, name").eq("status", "approved").order("name");
    setClubs(data || []);
  }

  async function saveAudit() {
    if (!auditForm.club_id || !auditForm.level) return;
    setSavingAudit(true);
    try {
      await supabase.from("club_audits").insert({
        club_id: auditForm.club_id,
        level: auditForm.level,
        notes: auditForm.notes || null,
        audited_by: session?.user?.id,
        checklist: AUDIT_CHECKLIST[auditForm.level],
      });
      await supabase.from("clubs").update({ accessibility_level: auditForm.level }).eq("id", auditForm.club_id);
      await loadAudits();
      setShowAuditForm(false);
      setAuditForm({ club_id: "", level: "bronce", notes: "" });
    } catch(e) { alert(e.message); }
    finally { setSavingAudit(false); }
  }

  async function revokeAudit(id, clubId) {
    await supabase.from("club_audits").update({ active: false }).eq("id", id);
    await supabase.from("clubs").update({ accessibility_level: null }).eq("id", clubId);
    setAudits(prev => prev.filter(a => a.id !== id));
  }

  async function loadAppFeatures() {
    const { data } = await supabase.from("app_features").select("*").order("key");
    setAppFeatures(data || []);
  }

  async function toggleFeature(key, enabled) {
    setSavingFeature(key);
    await supabase.from("app_features").update({ enabled, updated_at: new Date().toISOString() }).eq("key", key);
    setAppFeatures(prev => prev.map(f => f.key === key ? { ...f, enabled } : f));
    await loadFeatures();
    setSavingFeature(null);
  }

  async function loadFoundations() {
    const {data} = await supabase.from('foundations').select('*').order('created_at');
    setFoundations(data || []);
  }

  async function saveFoundation() {
    if (!foundationForm.name.trim()) return;
    try {
      setSavingFoundation(true);
      if (editingFoundation && editingFoundation !== 'new') {
        const {error} = await supabase.from('foundations').update(foundationForm).eq('id', editingFoundation);
        if (error) throw error;
      } else {
        const {error} = await supabase.from('foundations').insert({...foundationForm, active: true});
        if (error) throw error;
      }
      await loadFoundations();
      setEditingFoundation(null);
      setFoundationForm({name:'',description:'',logo_url:'',website:'',iban:'',contact_email:''});
    } catch(e) { alert(e.message); }
    finally { setSavingFoundation(false); }
  }

  async function toggleFoundation(id, active) {
    await supabase.from('foundations').update({active}).eq('id', id);
    setFoundations(prev => prev.map(f => f.id === id ? {...f, active} : f));
  }

  async function approveClub(club) {
    setSaving(club.id);
    try {
      // 1. Aprobar club
      await supabase.from("clubs").update({ status: "approved", active: true, verified: true }).eq("id", club.id);

      // 2. Crear entrada en club_admins para el gestor
      if (club.owner_user_id) {
        await supabase.from("club_admins").upsert({
          user_id: club.owner_user_id,
          club_id: club.id,
          club_name: club.name,
          status: "approved",
        }, { onConflict: "user_id,club_id" });

        // 3. Notificar al gestor
        await supabase.from("notifications").insert({
          user_id: club.owner_user_id,
          type: "club_approved",
          title: "🎉 ¡Tu club ha sido aprobado!",
          body: `${club.name} ya está activo en GorilaGo!. Entra al panel de administración para configurar tus pistas.`,
          data: { club_id: club.id },
        });
      }

      setPendingClubs(prev => prev.filter(c => c.id !== club.id));
    } catch (e) { alert(e.message); }
    finally { setSaving(null); }
  }

  async function rejectClub(club) {
    const reason = window.prompt("Motivo del rechazo (opcional):");
    setSaving(club.id);
    try {
      await supabase.from("clubs").update({ status: "rejected", rejection_reason: reason || null }).eq("id", club.id);
      if (club.owner_user_id) {
        await supabase.from("notifications").insert({
          user_id: club.owner_user_id,
          type: "club_rejected",
          title: "❌ Solicitud de club no aprobada",
          body: reason ? `${club.name}: ${reason}` : `No hemos podido aprobar ${club.name}. Contáctanos para más info.`,
          data: { club_id: club.id },
        });
      }
      setPendingClubs(prev => prev.filter(c => c.id !== club.id));
    } catch (e) { alert(e.message); }
    finally { setSaving(null); }
  }

  if (loading) return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--sport-color)", fontSize: 18, fontWeight: 900 }}>
      Cargando…
    </div>
  );

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "120px 16px 80px" }}>
        {/* Tabs */}
        <div style={{display:'flex', gap:8, marginBottom:20}}>
          {[['clubs','🏟️ Clubs'],['foundations','💚 Asociaciones'],['app','📱 App'],['auditorias','🏅 Auditorías'],['proyectos','🏗️ Proyectos']].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:800, fontSize:13,
                background: tab===t ? 'linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))' : 'rgba(255,255,255,0.08)',
                color: tab===t ? '#000' : '#fff'}}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate("/")}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            ← Volver
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--sport-color)" }}>🔐 Super Admin</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Panel de administración GorilaGo!</div>
          </div>
        </div>

        {tab === 'clubs' && <div>
        {/* Clubs pendientes */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 14 }}>
            🏟️ Clubs pendientes
            <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 20, background: pendingClubs.length > 0 ? "rgba(255,165,0,0.2)" : "rgba(255,255,255,0.08)", color: pendingClubs.length > 0 ? "#FFA500" : "rgba(255,255,255,0.4)", fontSize: 12 }}>
              {pendingClubs.length}
            </span>
          </div>

          {pendingClubs.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
              ✅ No hay clubs pendientes de aprobación
            </div>
          )}

          {pendingClubs.map(club => (
            <div key={club.id} style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{club.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>📍 {club.city} {club.address ? `· ${club.address}` : ""}</div>
                  {club.submitted_at && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      Enviado: {new Date(club.submitted_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
                <div style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(255,165,0,0.15)", color: "#FFA500", fontSize: 11, fontWeight: 800 }}>
                  ⏳ Pendiente
                </div>
              </div>

              {club.description && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 10, padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  {club.description}
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {club.opening_time && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>⏰ {club.opening_time}–{club.closing_time}</span>}
                {club.phone && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>📞 {club.phone}</span>}
                {club.email && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>✉️ {club.email}</span>}
                {club.website && <a href={club.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--sport-color)" }}>🌐 Web</a>}
                {club.social_instagram && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>📸 {club.social_instagram}</span>}
              </div>

              {club.courts_info?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>PISTAS</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {club.courts_info.map((c, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(var(--sport-color-rgb, 46,204,113),0.1)", color: "var(--sport-color)" }}>
                        {c.name} · {c.type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {club.amenities && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
                  ✅ {(Array.isArray(club.amenities) ? club.amenities : club.amenities.split(",")).join(" · ")}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => approveClub(club)} disabled={saving === club.id}
                  style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 900, fontSize: 13,
                    background: "linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))", color: "#000", opacity: saving === club.id ? 0.6 : 1 }}>
                  {saving === club.id ? "⏳ Guardando…" : "✅ Aprobar"}
                </button>
                <button onClick={() => rejectClub(club)} disabled={saving === club.id}
                  style={{ padding: "11px 16px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 900, fontSize: 13,
                    background: "rgba(220,38,38,0.1)", color: "#ff6b6b", opacity: saving === club.id ? 0.6 : 1 }}>
                  ❌ Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
        </div>}

        {tab === 'foundations' && (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <div style={{fontSize:15, fontWeight:900, color:'#fff'}}>💚 Asociaciones benéficas</div>
              <button onClick={()=>{setEditingFoundation('new');setFoundationForm({name:'',description:'',logo_url:'',website:'',iban:'',contact_email:'',active:true});}}
                style={{padding:'8px 14px', borderRadius:10, background:'linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))', border:'none', color:'#000', fontWeight:900, fontSize:12, cursor:'pointer'}}>
                + Nueva
              </button>
            </div>

            {foundations.map(f=>(
              <div key={f.id} style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:14, marginBottom:10}}>
                <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:10}}>
                  <div style={{width:48, height:48, borderRadius:12, background:'rgba(var(--sport-color-rgb, 46,204,113),0.1)', display:'grid', placeItems:'center', fontSize:24, flexShrink:0, overflow:'hidden', border:'1px solid rgba(var(--sport-color-rgb, 46,204,113),0.2)'}}>
                    {f.logo_url?.startsWith('http') ? <img src={f.logo_url} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : (f.logo_url || '💚')}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14, fontWeight:900, color:'#fff'}}>{f.name}</div>
                    <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2}}>{f.description}</div>
                    {f.iban && <div style={{fontSize:10, color:'rgba(var(--sport-color-rgb, 46,204,113),0.6)', marginTop:2, fontFamily:'monospace'}}>IBAN: {f.iban}</div>}
                    {f.contact_email && <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:1}}>✉️ {f.contact_email}</div>}
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end'}}>
                    <span style={{fontSize:10, fontWeight:900, padding:'3px 8px', borderRadius:6, background: f.active?'rgba(var(--sport-color-rgb, 46,204,113),0.15)':'rgba(255,255,255,0.05)', color: f.active?'var(--sport-color)':'rgba(255,255,255,0.3)'}}>
                      {f.active ? '● Activa' : '○ Inactiva'}
                    </span>
                  </div>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button onClick={()=>{setEditingFoundation(f.id);setFoundationForm({name:f.name,description:f.description||'',logo_url:f.logo_url||'',website:f.website||'',iban:f.iban||'',contact_email:f.contact_email||''});}}
                    style={{flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer'}}>
                    ✏️ Editar
                  </button>
                  <button onClick={()=>toggleFoundation(f.id, !f.active)}
                    style={{padding:'8px 12px', borderRadius:8, background: f.active?'rgba(239,68,68,0.1)':'rgba(var(--sport-color-rgb, 46,204,113),0.1)', border:'none', color: f.active?'#ff6b6b':'var(--sport-color)', fontWeight:800, fontSize:12, cursor:'pointer'}}>
                    {f.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}

            {foundations.length === 0 && (
              <div style={{textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)'}}>
                <div style={{fontSize:40, marginBottom:8}}>💚</div>
                No hay asociaciones. ¡Crea la primera!
              </div>
            )}
          </div>
        )}

        {/* Tab App Features */}
        {tab === 'app' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 6 }}>📱 Secciones de la app</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
              Activa o desactiva secciones. Los cambios se aplican al instante para todos los usuarios.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {appFeatures.map(f => (
                <div key={f.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#111', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '14px 16px',
                  opacity: savingFeature === f.key ? 0.6 : 1,
                  transition: 'opacity 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>/{f.key}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFeature(f.key, !f.enabled)}
                    disabled={savingFeature === f.key}
                    style={{
                      width: 52, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer',
                      background: f.enabled ? 'linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))' : 'rgba(255,255,255,0.12)',
                      position: 'relative', transition: 'background 0.25s', flexShrink: 0
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3, left: f.enabled ? 27 : 3,
                      width: 22, height: 22, borderRadius: 999,
                      background: f.enabled ? '#000' : 'rgba(255,255,255,0.5)',
                      transition: 'left 0.25s', display: 'block'
                    }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Auditorías */}
        {tab === 'auditorias' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>🏅 Auditorías de accesibilidad</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Oro · Plata · Bronce — renovación anual</div>
              </div>
              <button onClick={() => setShowAuditForm(true)}
                style={{ padding: '8px 14px', borderRadius: 10, background: 'linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))', border: 'none', color: '#000', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
                + Nueva
              </button>
            </div>

            {/* Formulario nueva auditoría */}
            {showAuditForm && (
              <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--sport-color)', marginBottom: 14 }}>Nueva auditoría</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select value={auditForm.club_id} onChange={e => setAuditForm(p => ({ ...p, club_id: e.target.value }))}
                    style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13 }}>
                    <option value="">Selecciona un club…</option>
                    {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['bronce','plata','oro'].map(lvl => {
                      const cfg = LEVEL_CONFIG[lvl];
                      return (
                        <button key={lvl} onClick={() => setAuditForm(p => ({ ...p, level: lvl }))}
                          style={{ flex: 1, padding: '12px 8px', borderRadius: 12, border: auditForm.level === lvl ? `2px solid ${cfg.color}` : '1px solid rgba(255,255,255,0.10)', background: auditForm.level === lvl ? cfg.bg : 'rgba(255,255,255,0.04)', color: cfg.color, fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
                          {cfg.emoji} {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.40)', marginBottom: 8 }}>REQUISITOS {auditForm.level.toUpperCase()}</div>
                    {AUDIT_CHECKLIST[auditForm.level].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13, color: 'rgba(255,255,255,0.70)' }}>
                        <span style={{ color: 'var(--sport-color)' }}>✓</span> {item}
                      </div>
                    ))}
                  </div>
                  <textarea placeholder="Notas internas (opcional)" value={auditForm.notes}
                    onChange={e => setAuditForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, resize: 'none', fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveAudit} disabled={savingAudit || !auditForm.club_id}
                      style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))', border: 'none', color: '#000', fontWeight: 900, fontSize: 14, cursor: 'pointer', opacity: savingAudit || !auditForm.club_id ? 0.5 : 1 }}>
                      {savingAudit ? 'Guardando…' : '✅ Guardar auditoría'}
                    </button>
                    <button onClick={() => setShowAuditForm(false)}
                      style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista auditorías */}
            {audits.length === 0 && !showAuditForm && (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.30)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🏅</div>
                No hay auditorías todavía
              </div>
            )}
            {audits.map(a => {
              const cfg = LEVEL_CONFIG[a.level];
              const exp = a.expires_at ? new Date(a.expires_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
              return (
                <div key={a.id} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{a.clubs?.name || a.club_id}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>
                        Auditado: {new Date(a.audited_at).toLocaleDateString('es-ES')} {exp ? `· Expira: ${exp}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 900, padding: '4px 10px', borderRadius: 8, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {cfg.emoji} {cfg.label}
                    </span>
                  </div>
                  {a.notes && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', marginBottom: 8 }}>{a.notes}</div>}
                  <button onClick={() => revokeAudit(a.id, a.club_id)}
                    style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#ff6b6b', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                    Revocar
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab Proyectos */}
        {tab === 'proyectos' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>🏗️ Proyectos activos</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:4 }}>Crowdfunding inclusivo</div>
              </div>
              <button onClick={() => { setEditingProject('new'); setProjectForm({ title:'', description:'', goal_amount:'', category:'inclusivo', featured:false }); }}
                style={{ padding:'8px 14px', borderRadius:10, background:'linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))', border:'none', color:'#000', fontWeight:900, fontSize:12, cursor:'pointer' }}>
                + Nuevo
              </button>
            </div>

            {/* Formulario */}
            {editingProject && (
              <div style={{ background:'#111', border:'1px solid rgba(255,255,255,0.10)', borderRadius:16, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:900, color:'var(--sport-color)', marginBottom:14 }}>
                  {editingProject === 'new' ? '+ Nuevo proyecto' : '✏️ Editar proyecto'}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[['title','Título *'],['description','Descripción'],['category','Categoría']].map(([f,ph]) => (
                    <input key={f} placeholder={ph} value={projectForm[f]}
                      onChange={e => setProjectForm(p => ({ ...p, [f]: e.target.value }))}
                      style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', fontSize:13 }} />
                  ))}
                  <input type="number" placeholder="Meta (€)" value={projectForm.goal_amount}
                    onChange={e => setProjectForm(p => ({ ...p, goal_amount: e.target.value }))}
                    style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', fontSize:13 }} />
                  <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'rgba(255,255,255,0.70)', cursor:'pointer' }}>
                    <input type="checkbox" checked={projectForm.featured}
                      onChange={e => setProjectForm(p => ({ ...p, featured: e.target.checked }))} />
                    Proyecto destacado
                  </label>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={saveProject} disabled={savingProject || !projectForm.title.trim()}
                      style={{ flex:1, padding:'12px', borderRadius:12, background:'linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))', border:'none', color:'#000', fontWeight:900, fontSize:14, cursor:'pointer', opacity: savingProject || !projectForm.title.trim() ? 0.5 : 1 }}>
                      {savingProject ? 'Guardando…' : '✅ Guardar'}
                    </button>
                    <button onClick={() => setEditingProject(null)}
                      style={{ padding:'12px 16px', borderRadius:12, background:'rgba(255,255,255,0.06)', border:'none', color:'#fff', fontWeight:900, cursor:'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista proyectos */}
            {projects.map(p => {
              const pct = Math.min(100, Math.round((p.current_amount / p.goal_amount) * 100));
              return (
                <div key={p.id} style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${p.featured ? 'rgba(var(--sport-color-rgb, 46,204,113),0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius:14, padding:14, marginBottom:10 }}>
                  {p.featured && <div style={{ fontSize:11, fontWeight:900, color:'var(--sport-color)', marginBottom:6 }}>⭐ Destacado</div>}
                  <div style={{ fontSize:14, fontWeight:900, color:'#fff', marginBottom:4 }}>{p.title}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.50)', marginBottom:10 }}>{p.description}</div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                      <span style={{ color:'var(--sport-color)', fontWeight:700 }}>{(p.current_amount||0).toFixed(0)} €</span>
                      <span style={{ color:'rgba(255,255,255,0.40)' }}>de {p.goal_amount} € · {pct}%</span>
                    </div>
                    <div style={{ height:6, borderRadius:999, background:'rgba(255,255,255,0.10)' }}>
                      <div style={{ height:'100%', width:`${pct}%`, borderRadius:999, background:'linear-gradient(90deg,var(--sport-color),var(--sport-color-dark))' }} />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => { setEditingProject(p.id); setProjectForm({ title:p.title, description:p.description||'', goal_amount:p.goal_amount, category:p.category||'inclusivo', featured:p.featured||false }); }}
                      style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => toggleProject(p.id, !p.active)}
                      style={{ padding:'8px 12px', borderRadius:8, background: p.active ? 'rgba(239,68,68,0.10)' : 'rgba(var(--sport-color-rgb, 46,204,113),0.10)', border:'none', color: p.active ? '#ff6b6b' : 'var(--sport-color)', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                      {p.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Propuestas */}
            {proposals.length > 0 && (
              <div style={{ marginTop:24 }}>
                <div style={{ fontSize:14, fontWeight:900, color:'#fff', marginBottom:12 }}>💡 Propuestas recibidas</div>
                {proposals.map(p => (
                  <div key={p.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:12, marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div style={{ fontSize:13, fontWeight:900, color:'#fff' }}>{p.title}</div>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background: p.status==='pending' ? 'rgba(245,158,11,0.15)' : p.status==='approved' ? 'rgba(var(--sport-color-rgb, 46,204,113),0.15)' : 'rgba(239,68,68,0.15)', color: p.status==='pending' ? '#f59e0b' : p.status==='approved' ? 'var(--sport-color)' : '#ff6b6b', fontWeight:800 }}>
                        {p.status}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.50)', marginBottom:8 }}>{p.description}</div>
                    {p.profiles?.name && <div style={{ fontSize:11, color:'rgba(255,255,255,0.30)', marginBottom:8 }}>Por: {p.profiles.name}</div>}
                    {p.status === 'pending' && (
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => updateProposalStatus(p.id, 'approved')}
                          style={{ flex:1, padding:'7px', borderRadius:8, background:'rgba(var(--sport-color-rgb, 46,204,113),0.12)', border:'1px solid rgba(var(--sport-color-rgb, 46,204,113),0.25)', color:'var(--sport-color)', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                          ✅ Aprobar
                        </button>
                        <button onClick={() => updateProposalStatus(p.id, 'rejected')}
                          style={{ padding:'7px 12px', borderRadius:8, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.25)', color:'#ff6b6b', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                          ❌ Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal editar/crear fundación */}
        {editingFoundation && (
          <div onClick={()=>setEditingFoundation(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
            <div onClick={e=>e.stopPropagation()} style={{width:'min(640px,100%)',background:'#111',borderRadius:'20px 20px 0 0',padding:20,paddingBottom:'max(20px,env(safe-area-inset-bottom))'}}>
              <div style={{fontSize:15,fontWeight:900,color:'var(--sport-color)',marginBottom:16}}>
                {editingFoundation==='new' ? '+ Nueva asociación' : '✏️ Editar asociación'}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  ['name','Nombre *','text'],
                  ['description','Descripción','text'],
                  ['logo_url','Logo URL o emoji (ej: 💚 o https://...)','text'],
                  ['website','Web (https://...)','text'],
                  ['iban','IBAN bancario','text'],
                  ['contact_email','Email de contacto','email'],
                ].map(([field, placeholder, type])=>(
                  <input key={field} type={type} placeholder={placeholder} value={foundationForm[field]}
                    onChange={e=>setFoundationForm(p=>({...p,[field]:e.target.value}))}
                    style={{padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',color:'#fff',fontSize:13,outline:'none'}}/>
                ))}
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  <button onClick={saveFoundation} disabled={savingFoundation||!foundationForm.name.trim()}
                    style={{flex:1,padding:'12px',borderRadius:12,background:'linear-gradient(135deg,var(--sport-color),var(--sport-color-dark))',border:'none',color:'#000',fontWeight:900,fontSize:14,cursor:'pointer',opacity:savingFoundation||!foundationForm.name.trim()?0.5:1}}>
                    {savingFoundation?'Guardando…':'✅ Guardar'}
                  </button>
                  <button onClick={()=>setEditingFoundation(null)}
                    style={{padding:'12px 16px',borderRadius:12,background:'rgba(255,255,255,0.08)',border:'none',color:'#fff',fontWeight:900,cursor:'pointer'}}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
