"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Lazy load Puck to avoid SSR issues if user later installs it
const PuckEditor: any = dynamic(async () => {
  try {
    const mod: any = await import('@measured/puck');
    return mod.Editor as any;
  } catch (e) {
    return () => <div style={{padding:24}}>Install <code>@measured/puck</code> to use the editor.</div>;
  }
}, { ssr: false });

export default function EditPage() {
  const [data, setData] = useState<any>({ content: [], root: { props: { title: 'My Site', theme: 'light' } }, zones: {} });
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    // Fetch minimal config/data from API if available
    (async () => {
      try {
        const res = await fetch('/api/create-site', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Starter site' }) });
        const json = await res.json();
        if (json?.puck?.data) setData(json.puck.data);
        if (json?.puck?.configJs) {
          // Evaluate config string without bundler
          const fn = new Function('React', `${json.puck.configJs}; return config;`);
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const React = require('react');
          setConfig(fn(React));
        }
      } catch {}
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      {config ? (
        <PuckEditor config={config} data={data} onPublish={(d: any)=>setData(d)} />
      ) : (
        <div style={{padding:24}}>Loading editor…</div>
      )}
    </div>
  );
}
