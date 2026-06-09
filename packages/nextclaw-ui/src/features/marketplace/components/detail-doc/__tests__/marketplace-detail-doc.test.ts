import { buildGenericDetailDataUrl } from "@/features/marketplace/components/marketplace-detail-doc";

function readDetailHtml(params: Parameters<typeof buildGenericDetailDataUrl>[0]) {
  return decodeURIComponent(buildGenericDetailDataUrl(params));
}

describe("buildGenericDetailDataUrl", () => {
  it("renders skill metadata and markdown content semantically", () => {
    const html = readDetailHtml({
      title: "Weather Skill",
      typeLabel: "Skill",
      spec: "@nextclaw/weather",
      metadataRaw: "name: weather\ndescription: Local weather skill",
      contentRaw: "# Weather Skill\n\nUse **weather** with `city`.\n\n- Local forecast\n- Severe alerts",
    });

    expect(html).toContain('<dl class="metadata-list">');
    expect(html).toContain("<dt>name</dt><dd>weather</dd>");
    expect(html).toContain("<h1>Weather Skill</h1>");
    expect(html).toContain("<strong>weather</strong>");
    expect(html).toContain("<code>city</code>");
    expect(html).toContain("<li>Local forecast</li>");
    expect(html).not.toContain('<pre class="code"># Weather Skill');
  });

  it("escapes marketplace content before rendering markdown", () => {
    const html = readDetailHtml({
      title: "Unsafe Skill",
      typeLabel: "Skill",
      spec: "@nextclaw/unsafe",
      metadataRaw: '{"name":"unsafe","nested":{"script":"<script>alert(1)</script>"}}',
      contentRaw: "[safe](https://example.com) <script>alert(1)</script>",
    });

    expect(html).toContain("<dt>nested</dt>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">safe</a>');
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
