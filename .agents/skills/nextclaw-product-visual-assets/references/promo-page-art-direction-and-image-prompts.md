# 艺术方向与生图提示词

只在需要确定整页视觉语言、生成/编辑背景或准备 AI 图时读取。产品截图选择仍由内容与证据合同决定。

## 这套页面的视觉灵魂

- **真实产品是锚点**：截图不做科幻化重绘，不把 UI 变成模型想象的界面。
- **背景像一个世界**：使用连续的大面积艺术背景，让页头、预览、卡片和说明看起来属于同一空间。
- **卡片像半透明纸面**：低对比边界、轻微磨砂、柔和阴影和纸张暖色，而不是高亮玻璃霓虹。
- **文字有编辑感**：标题短、有判断，中文优先宋体/楷体气质，正文使用清晰无衬线；不使用泛 AI 黑话。
- **构图留出呼吸**：每张图只保留一个主焦点；背景必须给标题或产品窗口预留安静区域。
- **细节证明完成度**：编号、真实界面标签、证据胶囊、页尾说明使用同一套小字号与字距。

## 从参考图提取，而不是机械复刻

1. 记录参考图的 `色温 / 明暗重心 / 纹理 / 运动方向 / 留白位置 / 前景轮廓`。
2. 只保留 3–5 个决定气质的因素；产品语义、截图和文案必须来自本次 brief。
3. 如果参考图本身是 NextClaw 主题资产，可作为背景继续使用；如果来自第三方，只提取抽象特征，不复制角色、构图或独特元素。

## 通用背景生成 Prompt

在 `imagegen` 中附上已确认可用的参考图，并替换方括号内容：

```text
Create a high-resolution editorial background for a NextClaw product showcase page.

Visual role: atmosphere only; it must not contain product UI, readable text, logos, devices, browser frames, or interface controls.
Subject and mood: [自然场景或抽象主题]，安静、克制、有呼吸感，适合一个会被长期使用的个人 AI 工作空间。
Art direction: hand-painted editorial illustration, subtle watercolor and paper grain, organic silhouettes, restrained detail, sophisticated color transitions, tactile but not photorealistic.
Composition: [左上/左侧]保留大面积低细节文字安全区；[右侧/下方]允许更丰富的前景轮廓；整个画面要能跨越网页多个区块连续铺开。
Palette: [3–5 个颜色与明暗关系]。
Output: clean background plate, 3:2 landscape, no mockup, no typography.

Avoid: generic sci-fi AI imagery, neon gradients, glossy 3D, stock-photo look, photorealistic product UI, fake text, symmetrical wallpaper, excessive blur, water-ripple distortion, random particles.
```

## 基于产品图做包装的 Prompt

```text
Use the attached real NextClaw screenshot as immutable product evidence. Preserve every visible UI element, text block, proportion, and state exactly; do not redraw or hallucinate the interface.

Create only the surrounding campaign composition: [背景气质]、[纸面/卡片材质]、[留白位置]。The screenshot must remain the clearest factual element. Add no claims or typography inside the generated image; text will be composed in HTML later.

Avoid: changing UI copy, inventing panels, replacing icons, cropping away the claimed feature, perspective distortion, heavy glow, fake device mockups.
```

若工具无法可靠保持 UI，停止编辑截图，改为只生成背景，并在 HTML 中原样叠放真实截图。

## Prompt 验收

- 单看背景时有气质，但不会被误认为产品功能。
- 缩略图下仍有明确明暗重心和文字安全区。
- 与真实截图的主色相互支持，不让文字对比度依赖重阴影。
- 没有假文字、假 UI、通用机器人、脑电路或蓝紫霓虹等廉价 AI 符号。
