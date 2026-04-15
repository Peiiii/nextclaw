const PORTAL_SECTION_LINKS = [
  {
    href: "#overview",
    label: "方向总览",
    shortLabel: "总览"
  },
  {
    href: "#roadmap",
    label: "产品路线图",
    shortLabel: "路线图"
  },
  {
    href: "#community",
    label: "社区反馈",
    shortLabel: "反馈"
  },
  {
    href: "#updates",
    label: "近期交付",
    shortLabel: "已交付"
  }
] as const;

export function PortalSectionNav(): JSX.Element {
  return (
    <nav className="portal-section-nav" aria-label="公开产品进展导航">
      {PORTAL_SECTION_LINKS.map((link) => (
        <a key={link.href} href={link.href} className="portal-section-nav__link" aria-label={link.label}>
          <span className="portal-section-nav__mobile-label">{link.shortLabel}</span>
          <strong>{link.label}</strong>
        </a>
      ))}
    </nav>
  );
}
