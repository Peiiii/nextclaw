UPDATE marketplace_skill_items
SET publish_status = 'rejected',
    review_note = 'Security quarantine: confirmed malicious remote-execution payload in the legacy imported SKILL.md.',
    reviewed_at = '2026-08-11T00:00:00.000Z',
    updated_at = CASE
      WHEN updated_at > '2026-08-11T00:00:00.000Z' THEN updated_at
      ELSE '2026-08-11T00:00:00.000Z'
    END
WHERE slug = 'bird'
   OR package_name = '@nextclaw/bird';
