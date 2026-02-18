// src/pages/CheckoutPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../services/supabaseClient';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements, PaymentElement, ExpressCheckoutElement,
  useStripe, useElements
} from '@stripe/react-stripe-js';

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
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
        <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 900 }}>O PAGA CON TARJETA</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <PaymentElement options={{ layout: { type: 'tabs', defaultCollapsed: false } }} />
      </div>
      {error && (
        <div style={{ padding: 12, borderRadius: 12, marginBottom: 16, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 14, fontWeight: 800 }}>
          ⚠️ {error}
        </div>
      )}
      <button type="submit" disabled={!stripe || loading} style={{
        width: '100%', padding: 18, borderRadius: 14, border: 'none',
        background: loading ? 'rgba(116,184,0,0.5)' : '#74B800',
        color: '#111', fontWeight: 950, fontSize: 17, cursor: loading ? 'not-allowed' : 'pointer'
      }}>
        {loading ? '⏳ Procesando...' : `💳 Pagar €${total}`}
      </button>
      <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, opacity: 0.7, textAlign: 'center' }}>
        🧪 Test: <strong>4242 4242 4242 4242</strong> · 12/26 · 123
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
    } catch (err) {
      setError(err?.message || 'Error desconocido');
    } finally { setLoading(false); }
  }

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 900, marginBottom: 6, opacity: 0.7 };

  if (items.length === 0) return (
    <div className="page pageWithHeader"><div className="pageWrap">
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>🛒</div>
        <h1 style={{ fontSize: 24, fontWeight: 950, marginBottom: 12 }}>Tu carrito está vacío</h1>
        <Link to="/tienda" className="btn" style={{ background: '#74B800' }}>Ver productos</Link>
      </div>
    </div></div>
  );

  return (
    <div className="page pageWithHeader">
      <div className="pageWrap">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>

          <div style={{ marginBottom: 24 }}>
            <button className="btn ghost" onClick={() => navigate('/tienda/carrito')} style={{ marginBottom: 12, padding: '8px 12px' }}>
              ← Carrito
            </button>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 950 }}>💳 Finalizar Compra</h1>
          </div>

          {/* RESUMEN EN MÓVIL - arriba */}
          {isMobile && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 950, marginBottom: 14 }}>🛍️ Tu pedido</h2>
              {items.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', position: 'relative' }}>
                    {item.product?.images?.[0]
                      ? <img src={item.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 16, opacity: 0.3 }}>📦</div>}
                    <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 999, background: '#74B800', color: '#111', fontSize: 9, fontWeight: 950, display: 'grid', placeItems: 'center', border: '1.5px solid #000' }}>{item.quantity}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.3 }}>{item.product?.title}</div>
                  <div style={{ fontSize: 14, fontWeight: 950, color: '#74B800' }}>€{(item.product?.price * item.quantity).toFixed(2)}</div>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ opacity: 0.7 }}>Subtotal</span>
                <span style={{ fontWeight: 900 }}>€{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                <span style={{ opacity: 0.7 }}>Envío</span>
                <span style={{ fontWeight: 900, color: shipping === 0 ? '#74B800' : '#fff' }}>{shipping === 0 ? '🎉 GRATIS' : `€${shipping.toFixed(2)}`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 950, fontSize: 18 }}>Total</span>
                <span style={{ fontWeight: 950, fontSize: 20, color: '#74B800' }}>€{total}</span>
              </div>
            </div>
          )}

          {/* GRID: 1 columna en móvil, 2 en desktop */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap: 24 }}>

            {/* IZQUIERDA: Dirección + Pago */}
            <div>
              {/* DIRECCIÓN */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: isMobile ? 16 : 24, marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 950, marginBottom: 4 }}>📦 Dirección de envío</h2>
                <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>Datos pre-rellenados de tu perfil</p>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>NOMBRE *</label>
                      <input style={inputStyle} type="text" value={address.name} onChange={e => setAddress({ ...address, name: e.target.value })} placeholder="Tu nombre" />
                    </div>
                    <div>
                      <label style={labelStyle}>EMAIL *</label>
                      <input style={inputStyle} type="email" value={address.email} onChange={e => setAddress({ ...address, email: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>DIRECCIÓN *</label>
                    <input style={inputStyle} type="text" value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })} placeholder="Calle, número, piso..." />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>CIUDAD *</label>
                      <input style={inputStyle} type="text" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} placeholder="Madrid" />
                    </div>
                    <div>
                      <label style={labelStyle}>CÓDIGO POSTAL *</label>
                      <input style={inputStyle} type="text" value={address.postalCode} onChange={e => setAddress({ ...address, postalCode: e.target.value })} placeholder="28001" maxLength={5} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>TELÉFONO</label>
                    <input style={inputStyle} type="tel" value={address.phone} onChange={e => setAddress({ ...address, phone: e.target.value })} placeholder="+34 600 000 000" />
                  </div>
                </div>
              </div>

              {/* PAGO */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: isMobile ? 16 : 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 950, marginBottom: 20 }}>💳 Método de pago</h2>
                {error ? (
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 800, marginBottom: 16 }}>
                    ⚠️ {error}
                    <button onClick={createPaymentIntent} style={{ display: 'block', marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 900, cursor: 'pointer', fontSize: 13 }}>
                      🔄 Reintentar
                    </button>
                  </div>
                ) : loading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                    <div style={{ fontWeight: 900, opacity: 0.75 }}>Preparando pago...</div>
                  </div>
                ) : clientSecret && stripePromise ? (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#74B800', colorBackground: '#1a1a1a', colorText: '#ffffff', colorDanger: '#ef4444', fontFamily: 'system-ui, sans-serif', borderRadius: '10px' } } }}>
                    <CheckoutForm total={total} orderData={{ email: profile?.email, orderNumber, items: items.map(i => ({ title: i.product?.title, price: i.product?.price, quantity: i.quantity })), total, address }} />
                  </Elements>
                ) : (
                  <div style={{ textAlign: 'center', padding: 30, opacity: 0.5 }}>Rellena tu dirección para continuar</div>
                )}
              </div>
            </div>

            {/* DERECHA: Resumen solo en desktop */}
            {!isMobile && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, height: 'fit-content', position: 'sticky', top: 80 }}>
                <h2 style={{ fontSize: 18, fontWeight: 950, marginBottom: 20 }}>Resumen</h2>
                {profile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: 'rgba(116,184,0,0.08)', border: '1px solid rgba(116,184,0,0.15)', marginBottom: 20 }}>
                    {profile.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: 999, objectFit: 'cover' }} />
                      : <div style={{ width: 36, height: 36, borderRadius: 999, background: '#74B800', color: '#111', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 950 }}>{(profile.name || profile.email || '?')[0].toUpperCase()}</div>}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 950 }}>{profile.name || 'Usuario'}</div>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>{profile.email}</div>
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', position: 'relative' }}>
                        {item.product?.images?.[0]
                          ? <img src={item.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 20, opacity: 0.3 }}>📦</div>}
                        <div style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 999, background: '#74B800', color: '#111', fontSize: 10, fontWeight: 950, display: 'grid', placeItems: 'center', border: '1.5px solid #000' }}>{item.quantity}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.3 }}>{item.product?.title}</div>
                      <div style={{ fontSize: 14, fontWeight: 950, color: '#74B800' }}>€{(item.product?.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.10)', marginBottom: 14 }} />
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ opacity: 0.75 }}>Subtotal</span>
                    <span style={{ fontWeight: 900 }}>€{subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ opacity: 0.75 }}>Envío</span>
                    <span style={{ fontWeight: 900, color: shipping === 0 ? '#74B800' : '#fff' }}>{shipping === 0 ? '🎉 GRATIS' : `€${shipping.toFixed(2)}`}</span>
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.10)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 950, fontSize: 18 }}>Total</span>
                    <span style={{ fontWeight: 950, fontSize: 22, color: '#74B800' }}>€{total}</span>
                  </div>
                </div>
                <div style={{ marginTop: 16, padding: 10, borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', fontSize: 12, opacity: 0.8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span>🔒</span><span>Pago 100% seguro con Stripe.</span>
                </div>
              </div>
            )}
          </div>

          {/* SEGURIDAD en móvil - abajo */}
          {isMobile && (
            <div style={{ margin: '16px 0 32px', padding: 12, borderRadius: 12, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔒</span><span>Pago 100% seguro con Stripe.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}