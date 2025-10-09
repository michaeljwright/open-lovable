import { NextRequest, NextResponse } from 'next/server';
import { parseUserIntentToSiteSpec, siteSpecToPuckData } from '@/lib/site-nlu';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 });
    }

    const spec = parseUserIntentToSiteSpec(prompt);
    const puckData = siteSpecToPuckData(spec);

    const puckConfigJs = `export const config = {
  components: {
    SiteHeader: {
      label: 'Site Header',
      fields: {
        logoAlt: { type: 'text', label: 'Logo Alt' },
        logoSrc: { type: 'text', label: 'Logo Src' },
        nav: {
          type: 'array',
          of: {
            type: 'group',
            fields: { label: { type: 'text' }, href: { type: 'text' } }
          }
        }
      },
      render: ({ logoAlt, logoSrc, nav }) => (
        <header style={{display:'flex',gap:16,alignItems:'center',padding:16,borderBottom:'1px solid #eee'}}>
          {logoSrc ? <img alt={logoAlt} src={logoSrc} style={{height:32}}/> : <strong>{logoAlt}</strong>}
          <nav style={{marginLeft:'auto',display:'flex',gap:12}}>
            {(nav||[]).map((item, i) => <a key={i} href={item.href}>{item.label}</a>)}
          </nav>
        </header>
      )
    },
    Hero: {
      label: 'Hero',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'text', label: 'Subtitle' },
        backgroundImage: { type: 'image', label: 'Background image' },
        cta: { type: 'group', fields: { label: { type: 'text' }, href: { type: 'text' } } }
      },
      render: ({ title, subtitle, backgroundImage, cta }) => (
        <section style={{padding:'64px 24px', color:'#111', backgroundImage: backgroundImage?`url(${backgroundImage})`:undefined, backgroundSize:'cover'}}>
          <h1 style={{fontSize:40, margin:0}}>{title}</h1>
          <p style={{opacity:0.75}}>{subtitle}</p>
          {cta?.href && <a href={cta.href} style={{display:'inline-block',marginTop:12,padding:'8px 12px',background:'#111',color:'#fff',borderRadius:6}}>{cta.label||'Learn more'}</a>}
        </section>
      )
    },
    FeatureGrid: {
      label: 'Feature Grid',
      fields: {
        items: {
          type: 'array',
          of: { type: 'group', fields: { title: { type: 'text' }, desc: { type: 'text' }, icon: { type: 'text' } } }
        }
      },
      render: ({ items=[] }) => (
        <section style={{padding:'24px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0,1fr))',gap:16}}>
            {items.map((it, i)=>(
              <div key={i} style={{padding:16,border:'1px solid #eee',borderRadius:8}}>
                <h3 style={{margin:'0 0 4px'}}>{it.title}</h3>
                <div style={{opacity:0.75}}>{it.desc}</div>
              </div>
            ))}
          </div>
        </section>
      )
    },
    SiteFooter: {
      label: 'Site Footer',
      fields: {
        copyright: { type: 'text', label: 'Copyright' },
        social: { type: 'array', of: { type: 'group', fields: { network: { type: 'text' }, url: { type: 'text' } } } }
      },
      render: ({ copyright }) => (
        <footer style={{padding:16,borderTop:'1px solid #eee'}}>
          <small>{copyright}</small>
        </footer>
      )
    }
  }
};`;

    return NextResponse.json({ success: true, spec, puck: { data: puckData, configJs: puckConfigJs } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'failed' }, { status: 500 });
  }
}
