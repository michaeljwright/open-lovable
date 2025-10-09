export type SiteSection = {
  type: string;
  props: Record<string, any>;
};

export type SiteSpec = {
  pages: Array<{
    path: string;
    title?: string;
    sections: SiteSection[];
  }>;
  theme: {
    colors?: Record<string, string>;
    fonts?: { body?: string; heading?: string };
    mode?: 'light' | 'dark';
  };
};

export function parseUserIntentToSiteSpec(prompt: string): SiteSpec {
  const lower = prompt.toLowerCase();
  const wantsDark = /dark(\s|\-|_)mode|dark theme/.test(lower);

  // Naive extraction of brand/title
  const titleMatch = prompt.match(/(?:called|named|for)\s+([A-Z][\w\s&'-]{2,40})/i);
  const siteTitle = titleMatch ? titleMatch[1].trim() : 'My Site';

  const heroTitle = (prompt.match(/"([^"]{5,120})"/) || [null, `${siteTitle}`])[1];

  const sections: SiteSection[] = [
    {
      type: 'SiteHeader',
      props: {
        id: 'SiteHeader-1',
        logoAlt: siteTitle,
        logoSrc: '',
        nav: [
          { label: 'Home', href: '/' },
          { label: 'Contact', href: '/contact' }
        ]
      }
    },
    {
      type: 'Hero',
      props: {
        id: 'Hero-1',
        title: heroTitle,
        subtitle: '',
        backgroundImage: '',
        cta: { label: 'Get started', href: '/#' }
      }
    },
    {
      type: 'FeatureGrid',
      props: {
        id: 'FeatureGrid-1',
        items: [
          { title: 'Feature A', desc: 'Describe a key benefit', icon: 'spark' },
          { title: 'Feature B', desc: 'What makes you unique', icon: 'star' },
          { title: 'Feature C', desc: 'Another highlight', icon: 'bolt' }
        ]
      }
    },
    {
      type: 'SiteFooter',
      props: {
        id: 'SiteFooter-1',
        copyright: `© ${new Date().getFullYear()} ${siteTitle}`,
        social: []
      }
    }
  ];

  return {
    pages: [
      { path: '/', title: siteTitle, sections },
    ],
    theme: {
      mode: wantsDark ? 'dark' : 'light'
    }
  };
}

export function siteSpecToPuckData(spec: SiteSpec) {
  const home = spec.pages.find(p => p.path === '/') || spec.pages[0];
  return {
    content: home.sections,
    root: {
      props: {
        title: home.title || 'My Site',
        theme: spec.theme.mode || 'light'
      }
    },
    zones: {}
  };
}
