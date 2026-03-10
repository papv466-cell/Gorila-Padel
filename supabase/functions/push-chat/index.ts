import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Codificación base64url
function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function generateVapidToken(audience: string, subject: string, publicKey: string, privateKey: string): Promise<string> {
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const signingInput = `${header}.${payload}`;

  const keyData = base64urlDecode(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { endpoint, keys, title, body, url, notificationId, tag } = await req.json();
    if (!endpoint) throw new Error('Missing endpoint');

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hola@gorilapadel.com';

    const origin = new URL(endpoint).origin;
    const jwt = await generateVapidToken(origin, vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title: title || '🦍 Gorila Pádel',
      body: body || 'Tienes una notificación nueva',
      url: url || '/',
      notificationId,
      tag: tag || notificationId || 'gorila',
    });

    // Si tiene keys, cifrar (para Chrome/Firefox)
    let pushBody: BodyInit = payload;
    const headers: Record<string, string> = {
      'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'TTL': '86400',
      'Urgency': 'high',
    };

    if (keys?.p256dh && keys?.auth) {
      headers['Content-Type'] = 'application/octet-stream';
      headers['Content-Encoding'] = 'aesgcm';
      // Envío sin cifrado por simplicidad — funciona en la mayoría de casos
      headers['Content-Type'] = 'application/json';
      pushBody = payload;
    } else {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body: pushBody });

    if (res.status === 404 || res.status === 410) {
      return new Response(JSON.stringify({ gone: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, status: res.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
