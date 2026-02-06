import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

export default function AuthConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verificando...');

  useEffect(() => {
    const token = searchParams.get('token');
    const type = searchParams.get('type');

    if (!token) {
      setStatus('❌ Link inválido');
      return;
    }

    (async () => {
      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type || 'signup'
        });

        if (error) throw error;

        setStatus('✅ Email confirmado. Redirigiendo...');
        setTimeout(() => navigate('/'), 2000);
      } catch (e) {
        setStatus('❌ Error: ' + (e?.message || 'No se pudo verificar'));
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="page" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '80vh' 
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1>{status}</h1>
      </div>
    </div>
  );
}