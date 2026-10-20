import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// The site renders the repository's docs in place: docs/** (guides, reference, and the law in
// docs/framework) and the root decisions.md. Nothing is copied or generated.
const config: Config = {
  title: 'DEVAI',
  tagline: 'A rail and a harness for spec-driven, agent-assisted development.',
  url: 'https://devai-nyx.github.io',
  baseUrl: '/devai-v3/',
  organizationName: 'devai-nyx',
  projectName: 'devai-v3',
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',
  markdown: { format: 'detect', hooks: { onBrokenMarkdownLinks: 'throw' } },
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [
    [
      'classic',
      {
        docs: {
          path: '..',
          include: ['docs/**/*.md', 'decisions.md'],
          exclude: ['**/node_modules/**', 'site/**'],
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/devai-nyx/devai-v3/edit/main/',
        },
        blog: false,
        pages: {},
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: {
      title: 'DEVAI',
      items: [
        { to: '/docs/start/', label: 'Start', position: 'left' },
        { to: '/docs/guides/', label: 'Guides', position: 'left' },
        { to: '/docs/adopters/', label: 'Adopters', position: 'left' },
        { to: '/docs/reference/', label: 'Reference', position: 'left' },
        { to: '/docs/theory/', label: 'Theory', position: 'left' },
        { to: '/docs/framework/charter', label: 'Law', position: 'left' },
        { to: '/docs/dev/', label: 'Develop DEVAI', position: 'right' },
        { href: 'https://github.com/devai-nyx/devai-v3', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'light',
      copyright: 'DEVAI 3 · Apache-2.0 · NYX Knowledge (NYXK)',
    },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula, additionalLanguages: ['bash', 'json', 'yaml', 'sql'] },
  } satisfies Preset.ThemeConfig,
};

export default config;
