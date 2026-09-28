export function BiboCompanion({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="-16 -8 262 192" aria-hidden="true" focusable="false">
      <ellipse cx="115" cy="171" rx="111" ry="7" fill="currentColor" opacity=".07" />
      <g>
        <path d="M115 1C182-3 229 24 230 78C232 137 191 158 116 158C45 161 0 135 0 79C-2 26 43 1 115 1Z" fill="#8270cb" transform="rotate(4 115 79)" />
        <ellipse cx="78.5" cy="70" rx="25.5" ry="35" fill="#fbf8e8" />
        <ellipse cx="144.5" cy="69.5" rx="25.5" ry="32.5" fill="#fbf8e8" />
        <g fill="#35264f">
          <ellipse cx="79.5" cy="75" rx="11.5" ry="16" />
          <ellipse cx="145.5" cy="75" rx="11.5" ry="16" />
        </g>
        <ellipse cx="112.5" cy="123.5" rx="9.5" ry="2.5" fill="#65529f" />
      </g>
      <g fill="#9784dd" stroke="#7159b3" strokeWidth="2" strokeLinecap="round">
        <rect x="-11" y="138" width="48" height="39" rx="17" stroke="none" transform="rotate(8 13 157)" />
        <path d="M8 156L7 167M19 157L18 168" />
        <rect x="192" y="138" width="48" height="39" rx="17" stroke="none" transform="rotate(-8 216 157)" />
        <path d="M211 157L212 168M222 156L223 167" />
      </g>
    </svg>
  );
}
