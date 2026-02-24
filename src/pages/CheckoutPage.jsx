// src/pages/CheckoutPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../services/supabaseClient';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

function CheckoutForm({ total, orderData }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function sendEmail() {
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-order-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ to: orderData?.email, orderNumber: orderData?.orderNumber, items: orderData?.items || [], total: orderData?.total, address: orderData?.address })
      });
    } catch (err) { console.warn('Email no enviado:', err); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true); setError(null);
    const { error: submitError } = await elements.submit();
    if (submitError) { setError(submitError.message); setLoading(false); return; }
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/tienda/pedido-confirmado` },
      redirect: 'if_required'
    });
    if (confirmError) { setError(confirmError.message); setLoading(false); return; }
    if (paymentIntent?.status === 'succeeded') {
      await sendEmail();
      window.location.href = `/tienda/pedido-confirmado?payment_intent=${paymentIntent.id}`;
    }
  }

  async function handleExpressConfirm() {
    if (!stripe || !elements) return;
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/tienda/pedido-confirmado` },
      redirect: 'if_required'
    });
    if (confirmError) { setError(confirmError.message); return; }
    if (paymentIntent?.status === 'succeeded') {
      await sendEmail();
      window.location.href = `/tienda/pedido-confirmado?payment_intent=${paymentIntent.id}`;
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <ExpressCheckoutElement onConfirm={handleExpressConfirm}
          options={{ buttonType: { applePay: 'buy', googlePay: 'buy' }, layout: { maxRows: 1, maxColumns: 3, overflow: 'never' } }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 900, letterSpacing: 1 }}>O PAGA CON TARJETA</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <PaymentElement options={{ layout: { type: 'tabs', defaultCollapsed: false } }} />
      </div>
      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13, fontWeight: 800 }}>
          ⚠️ {error}
        </div>
      )}
      <button type="submit" disabled={!stripe || loading}
        style={{ width: '100%', padding: '15px', borderRadius: 12, border: 'none', background: loading ? 'rgba(116,184,0,0.4)' : 'linear-gradient(135deg,#74B800,#9BE800)', color: '#000', fontWeight: 900, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all .2s' }}>
        {loading ? '⏳ Procesando...' : `💳 Pagar €${total}`}
      </button>
      <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
        🧪 Test: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>4242 4242 4242 4242</strong> · 12/26 · 123
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal } = useCart();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [address, setAddress] = useState({ name: '', email: '', street: '', city: '', postalCode: '', phone: '' });

  const shipping = subtotal > 50 ? 0 : 4.99;
  const total = (subtotal + shipping).toFixed(2);

  useEffect(() => { loadUserData(); }, []);
  useEffect(() => { if (profile && items.length > 0 && !clientSecret) createPaymentIntent(); }, [profile, items]);

  async function loadUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/login?redirect=/tienda/checkout'); return; }
    const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).maybeSingle();
    setProfile({ ...user, ...prof });
    setAddress(prev => ({ ...prev, name: prof?.name || user.user_metadata?.full_name || '', email: user.email || '' }));
  }

  async function createPaymentIntent() {
    try {
      setLoading(true); setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({
            userId: user?.id, email: user?.email, address,
            items: items.map(i => ({ productId: i.product_id, title: i.product?.title || '', price: i.product?.price || 0, quantity: i.quantity, sellerId: i.product?.seller?.id || null })),
            shipping: { cost: shipping }
          })
        }
      );
      const data = await response.json();
      if (!response.ok || data.error) { setError(data.error || `Error ${response.status}`); return; }
      setClientSecret(data.clientSecret);
      setOrderNumber(data.orderNumber);
    } catch (err) { setError(err?.message || 'Error desconocido'); }
    finally { setLoading(false); }
  }

  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none', transition: 'border-color .2s' };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 900, marginBottom: 5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 };

  if (items.length === 0) return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a' }}>
      <div className="pageWrap">
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🛒</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 16 }}>Tu carrito está vacío</h1>
          <Link to="/tienda" style={{ padding: '11px 22px', borderRadius: 12, background: '#74B800', color: '#000', fontWeight: 900, textDecoration: 'none' }}>Ver productos</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page pageWithHeader" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <style>{`
        .gcInput:focus { border-color: rgba(116,184,0,0.5) !important; box-shadow: 0 0 0 3px rgba(116,184,0,0.1) !important; }
      `}</style>
      <div className="pageWrap">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 12px 40px' : '0 24px 60px' }}>

          <div style={{ padding: '14px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/tienda/carrito')}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              ← Carrito
            </button>
            <h1 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900, color: '#fff', margin: 0 }}>💳 Finalizar Compra</h1>
          </div>

          {/* Resumen compacto en móvil */}
          {isMobile && (
            <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Tu pedido</div>
              {items.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
                    {item.product?.images?.[0]
                      ? <img src={item.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 16, opacity: 0.2 }}>📦</div>}
                    <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 999, background: '#74B800', color: '#000', fontSize: 9, fontWeight: 900, display: 'grid', placeItems: 'center' }}>{item.quantity}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{item.product?.title}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#74B800' }}>€{(item.product?.price * item.quantity).toFixed(2)}</div>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Envío</span>
                <span style={{ fontWeight: 800, color: shipping === 0 ? '#74B800' : '#fff' }}>{shipping === 0 ? '🎉 GRATIS' : `€${shipping.toFixed(2)}`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 900 }}>Total</span>
                <span style={{ fontWeight: 900, fontSize: 18, color: '#74B800' }}>€{total}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 20 }}>

            {/* IZQUIERDA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Dirección */}
              <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: isMobile ? 14 : 20 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 4 }}>📦 Dirección de envío</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Datos pre-rellenados de tu perfil</div>

                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Nombre *</label>
                      <input className="gcInput" style={inputStyle} type="text" value={address.name} onChange={e => setAddress({ ...address, name: e.target.value })} placeholder="Tu nombre" />
                    </div>
                    <div>
                      <label style={labelStyle}>Email *</label>
                      <input className="gcInput" style={inputStyle} type="email" value={address.email} onChange={e => setAddress({ ...address, email: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Dirección *</label>
                    <input className="gcInput" style={inputStyle} type="text" value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })} placeholder="Calle, número, piso..." />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Ciudad *</label>
                      <input className="gcInput" style={inputStyle} type="text" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} placeholder="Málaga" />
                    </div>
                    <div>
                      <label style={labelStyle}>Código postal *</label>
                      <input className="gcInput" style={inputStyle} type="text" value={address.postalCode} onChange={e => setAddress({ ...address, postalCode: e.target.value })} placeholder="29001" maxLength={5} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Teléfono</label>
                    <input className="gcInput" style={inputStyle} type="tel" value={address.phone} onChange={e => setAddress({ ...address, phone: e.target.value })} placeholder="+34 600 000 000" />
                  </div>
                </div>
              </div>

              {/* Pago */}
              <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: isMobile ? 14 : 20 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 20 }}>💳 Método de pago</div>
                {error ? (
                  <div style={{ padding: 14, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 800, fontSize: 13, marginBottom: 14 }}>
                    ⚠️ {error}
                    <button onClick={createPaymentIntent} style={{ display: 'block', marginTop: 10, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#ef4444', fontWeight: 900, cursor: 'pointer', fontSize: 12 }}>
                      🔄 Reintentar
                    </button>
                  </div>
                ) : loading ? (
                  <div style={{ textAlign: 'center', padding: 36, color: 'rgba(255,255,255,0.4)' }}>
                    <div style={{ fontSize: 28 }}>⏳</div>
                    <div style={{ marginTop: 8, fontWeight: 800, fontSize: 13 }}>Preparando pago seguro...</div>
                  </div>
                ) : clientSecret && stripePromise ? (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#74B800', colorBackground: '#111', colorText: '#ffffff', colorDanger: '#ef4444', fontFamily: 'system-ui, sans-serif', borderRadius: '10px' } } }}>
                    <CheckoutForm total={total} orderData={{ email: profile?.email, orderNumber, items: items.map(i => ({ title: i.product?.title, price: i.product?.price, quantity: i.quantity })), total, address }} />
                  </Elements>
                ) : (
                  <div style={{ textAlign: 'center', padding: 28, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                    Rellena tu dirección para continuar
                  </div>
                )}
              </div>
            </div>

            {/* DERECHA - solo desktop */}
            {!isMobile && (
              <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, height: 'fit-content', position: 'sticky', top: 80 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Resumen</div>

                {profile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(116,184,0,0.07)', border: '1px solid rgba(116,184,0,0.12)', marginBottom: 16 }}>
                    {profile.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: 999, objectFit: 'cover' }} />
                      : <div style={{ width: 34, height: 34, borderRadius: 999, background: '#74B800', color: '#000', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 900 }}>{(profile.name || profile.email || '?')[0].toUpperCase()}</div>}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{profile.name || 'Usuario'}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{profile.email}</div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '46px 1fr auto', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 46, height: 46, borderRadius: 8, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
                        {item.product?.images?.[0]
                          ? <img src={item.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 18, opacity: 0.2 }}>📦</div>}
                        <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 999, background: '#74B800', color: '#000', fontSize: 9, fontWeight: 900, display: 'grid', placeItems: 'center' }}>{item.quantity}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{item.product?.title}</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#74B800' }}>€{(item.product?.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Subtotal</span>
                  <span style={{ fontWeight: 800 }}>€{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Envío</span>
                  <span style={{ fontWeight: 800, color: shipping === 0 ? '#74B800' : '#fff' }}>{shipping === 0 ? '🎉 GRATIS' : `€${shipping.toFixed(2)}`}</span>
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 10 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontWeight: 900, fontSize: 16 }}>Total</span>
                  <span style={{ fontWeight: 900, fontSize: 20, color: '#74B800' }}>€{total}</span>
                </div>
                <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 6 }}>
                  🔒 Pago 100% seguro con Stripe
                </div>
              </div>
            )}
          </div>

          {isMobile && (
            <div style={{ margin: '14px 0 24px', padding: '10px 12px', borderRadius: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 6 }}>
              🔒 Pago 100% seguro con Stripe
            </div>
          )}
        </div>
      </div>
    </div>
  );
}