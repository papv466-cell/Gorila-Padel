// src/pages/SuperAdminPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";



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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
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
          body: `${club.name} ya está activo en Gorila Pádel. Entra al panel de administración para configurar tus pistas.`,
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
    <div style={{ background: "#080808", minHeight: "100vh", display: "grid", placeItems: "center", color: "#74B800", fontSize: 18, fontWeight: 900 }}>
      Cargando…
    </div>
  );

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "120px 16px 80px" }}>
        {/* Tabs */}
        <div style={{display:'flex', gap:8, marginBottom:20}}>
          {[['clubs','🏟️ Clubs'],['foundations','💚 Asociaciones']].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:'8px 16px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:800, fontSize:13,
                background: tab===t ? 'linear-gradient(135deg,#74B800,#9BE800)' : 'rgba(255,255,255,0.08)',
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
            <div style={{ fontSize: 20, fontWeight: 900, color: "#74B800" }}>🔐 Super Admin</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Panel de aprobación de clubs</div>
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
                {club.website && <a href={club.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#74B800" }}>🌐 Web</a>}
                {club.social_instagram && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>📸 {club.social_instagram}</span>}
              </div>

              {club.courts_info?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>PISTAS</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {club.courts_info.map((c, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(116,184,0,0.1)", color: "#74B800" }}>
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
                    background: "linear-gradient(135deg,#74B800,#9BE800)", color: "#000", opacity: saving === club.id ? 0.6 : 1 }}>
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
                style={{padding:'8px 14px', borderRadius:10, background:'linear-gradient(135deg,#74B800,#9BE800)', border:'none', color:'#000', fontWeight:900, fontSize:12, cursor:'pointer'}}>
                + Nueva
              </button>
            </div>

            {foundations.map(f=>(
              <div key={f.id} style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:14, marginBottom:10}}>
                <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:10}}>
                  <div style={{width:48, height:48, borderRadius:12, background:'rgba(116,184,0,0.1)', display:'grid', placeItems:'center', fontSize:24, flexShrink:0, overflow:'hidden', border:'1px solid rgba(116,184,0,0.2)'}}>
                    {f.logo_url?.startsWith('http') ? <img src={f.logo_url} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : (f.logo_url || '💚')}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14, fontWeight:900, color:'#fff'}}>{f.name}</div>
                    <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2}}>{f.description}</div>
                    {f.iban && <div style={{fontSize:10, color:'rgba(116,184,0,0.6)', marginTop:2, fontFamily:'monospace'}}>IBAN: {f.iban}</div>}
                    {f.contact_email && <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:1}}>✉️ {f.contact_email}</div>}
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end'}}>
                    <span style={{fontSize:10, fontWeight:900, padding:'3px 8px', borderRadius:6, background: f.active?'rgba(116,184,0,0.15)':'rgba(255,255,255,0.05)', color: f.active?'#74B800':'rgba(255,255,255,0.3)'}}>
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
                    style={{padding:'8px 12px', borderRadius:8, background: f.active?'rgba(239,68,68,0.1)':'rgba(116,184,0,0.1)', border:'none', color: f.active?'#ff6b6b':'#74B800', fontWeight:800, fontSize:12, cursor:'pointer'}}>
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

        {/* Modal editar/crear fundación */}
        {editingFoundation && (
          <div onClick={()=>setEditingFoundation(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
            <div onClick={e=>e.stopPropagation()} style={{width:'min(640px,100%)',background:'#111',borderRadius:'20px 20px 0 0',padding:20,paddingBottom:'max(20px,env(safe-area-inset-bottom))'}}>
              <div style={{fontSize:15,fontWeight:900,color:'#74B800',marginBottom:16}}>
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
                    style={{flex:1,padding:'12px',borderRadius:12,background:'linear-gradient(135deg,#74B800,#9BE800)',border:'none',color:'#000',fontWeight:900,fontSize:14,cursor:'pointer',opacity:savingFoundation||!foundationForm.name.trim()?0.5:1}}>
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
