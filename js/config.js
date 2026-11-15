/* Public presentation only. Authoritative catalog and USD prices: PostgreSQL /admin. */
window.SITE = {
  name: 'AI EMPIRE', brand: 'AI EMPIRE', telegram: '', email: '', socials: [],
  api: { leads: '/api/v1/leads', bootstrap: '/api/v1/public/bootstrap' },
  tech: ['Claude', 'Codex', 'Python', 'FastAPI', 'PostgreSQL', 'n8n', 'Telegram', 'Docker'],
  services: [
    { id: 'automation', n: '01', image: '/assets/images/automation.webp' },
    { id: 'web', n: '02', image: '/assets/images/web.webp' },
    { id: 'assistants', n: '03', image: '/assets/images/assistant.webp' },
    { id: 'leadgen', n: '04', image: '/assets/images/studio.webp' },
    { id: 'saas', n: '05', image: '/assets/images/products.webp' }
  ],
  currency: 'USD',
  // Indicative offline preview. A running backend replaces these from PostgreSQL.
  plans: [{ id: 'start', price: 299 }, { id: 'business', price: 799, featured: true }, { id: 'custom', price: 1999 }],
  projects: [
    { id: 'p1', category: 'web', tech: ['Design', 'Web', 'CRM'], url: '/portfolio/#p1', image: '/assets/images/portfolio.webp', demo: true },
    { id: 'p2', category: 'assistants', tech: ['AI assistant', 'Telegram'], url: '#demo', image: '/assets/images/assistant.webp', demo: true },
    { id: 'p3', category: 'automation', tech: ['Workflow', 'AI', 'CRM'], url: '#system', image: '/assets/images/automation.webp', demo: true }
  ],
  products: [{ id: 'adminbot', status: 'soon', url: '' }, { id: 'leadfinder', status: 'soon', url: '' }, { id: 'proposal', status: 'soon', url: '' }]
};
