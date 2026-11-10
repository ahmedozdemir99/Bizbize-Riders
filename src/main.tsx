import {useEffect,useState} from 'react';
import {getDeviceId} from './services/supabase';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed: ', err);
    });
  });
}

function IdentityRoot(){
  const [id,setId]=useState(getDeviceId);
  useEffect(()=>{
    const update=()=>setId(getDeviceId());
    window.addEventListener('rider:identity-changed',update);window.addEventListener('storage',update);
    return()=>{window.removeEventListener('rider:identity-changed',update);window.removeEventListener('storage',update);};
  },[]);
  return <App key={id}/>;
}
createRoot(document.getElementById('root')!).render(<IdentityRoot/>);
