# 内容与证据合同

## 核心原则

页面的美感不能替代内容选择。先建立 `命题 → claim → 素材 → 卡片` 的单向映射，再开始排版。真实截图证明产品事实；艺术背景只提供情绪；概念图只表达方向。

## Brief 结构

```json
{
  "version": 1,
  "page": {
    "kicker": "Campaign concept",
    "title": "用户最终应该记住的一句话",
    "introduction": "为什么这件事值得被看见",
    "channel": {
      "label": "X 帖子草稿",
      "author": "Pei",
      "handle": "@XiaotiaoWang",
      "copy": "可选渠道文案",
      "status": "尚未发布"
    }
  },
  "claims": [
    { "id": "claim-id", "text": "可核查结论", "kind": "product" }
  ],
  "assets": [
    {
      "id": "workspace",
      "path": "./workspace.png",
      "role": "product-screenshot",
      "supports": ["claim-id"],
      "alt": "真实界面中可见的内容",
      "capture": {
        "scope": "full-window",
        "completeness": "complete",
        "subject": "能够直接证明 claim 的完整工作区",
        "selectionReason": "解释为什么这张图比其它候选更能直接证明 claim",
        "privacyReviewed": true
      }
    }
  ],
  "cards": [
    {
      "label": "01",
      "layout": "hero-window",
      "title": "传播卡片标题",
      "body": "一句补充",
      "backgroundAssetId": "background",
      "evidence": {
        "assetIds": ["workspace"],
        "composition": "single",
        "fit": "contain",
        "frameAspect": "source",
        "rationale": "解释单图或多图之间的叙事关系"
      },
      "claimIds": ["claim-id"]
    }
  ],
  "designNote": "解释信息分工，不写内部过程流水账。"
}
```

`page.channel` 可省略。`cards[].layout` 支持：

- `hero-window`：强判断 + 一张完整真实界面；适合首张传播图。
- `evidence-board`：完整真实界面 + 三个说明标签；适合解释跨区域体验，标签不裁图。
- `full-bleed`：整张氛围素材 + 文案覆盖；只允许概念 claim，不承载产品事实。
- `editorial`：编辑式文字 + 一张完整真实界面；适合观点和结果摘要。

## 完整截图合同

- 事实型 asset 必须填写 `capture`：`scope` 为 `full-window`、`focused-panel` 或 `intentional-detail`，`completeness` 为 `complete` 或 `detail`，并声明 `subject`、`selectionReason` 与 `privacyReviewed: true`。
- `complete` 表示 claim 所需的界面边界全部可见；它不等于机械地截全屏。若 claim 只讨论一个 Panel App，完整功能面板可以是 `focused-panel`，但不能切掉理解该功能所需的入口、状态或结果。
- `detail` 必须使用 `intentional-detail`，并声明 `sourceAssetId` 与 0–1 归一化的 `cropRegion`；来源必须是一张完整证据图。局部图不允许独立证明事实。
- 事实型 card 必须设置 `evidence`，`fit` 固定为 `contain`，`frameAspect` 固定为 `source`，并用 `rationale` 说明为什么采用该拼接关系；不得把 `cover` 裁切或 CSS background 当作唯一产品证据。
- `hero-window`、`evidence-board`、`editorial` 都必须有截图；`full-bleed` 禁止引用产品截图和事实 claim。
- `evidence.composition` 支持：`single`（一张完整图）、`sequence`（2–3 张完整图，按任务顺序排列）、`overview-with-details`（第一张完整图，后续 1–2 张是它的声明式细节裁切）。
- 截图太宽时，先在方形卡片中把它作为独立圆角卡片完整展示；若实际传播尺寸仍不可辨，重新截取边界完整的 `focused-panel`，或让整组卡片统一切换横向比例。禁止把宽截图硬塞进狭窄竖框，再靠裁切解决。

## 端到端截图决策

1. **选哪里**：从 claim 反推必须出现的入口、操作、状态和结果；缺一项就重新截图或收窄 claim。
2. **怎么截**：优先得到一张边界完整、无悬浮遮挡、无加载态且隐私安全的母图；不要在采集阶段为了版式提前截碎。
3. **是否裁**：只有当完整图已承担事实证据、且某个细节在目标输出尺寸下确实不可读时才增加局部图；局部图必须带来源和 cropRegion。
4. **什么比例**：证据 frame 使用源图比例，卡片尺寸适配截图，不让截图适配任意容器。艺术背景可以 `cover`，真实 UI 不可以。
5. **怎么拼**：时间或操作链路用 `sequence`；空间关系和细节解释用 `overview-with-details`；没有关系的图不要拼在一张卡片里。
6. **最后检查**：以实际传播尺寸查看；完整边界、主体识别、文字可读性任一失败，就回到选图或编排阶段，不能只调滤镜和阴影。

## 素材角色

| role | 能做什么 | 不能做什么 |
|---|---|---|
| `product-screenshot` | 证明已存在的 UI、状态和结果 | 证明截图里看不到的能力 |
| `data-visual` | 证明有来源和边界的数字 | 省略口径后做夸张结论 |
| `concept` | 表达方向、隐喻和品牌气质 | 冒充已上线产品 |
| `atmosphere` | 提供色彩、纹理和构图背景 | 单独承担功能证据 |

## 渲染阻断条件

- card 引用不存在的 claim 或 asset。
- 事实型 claim 没有被任何 `product-screenshot` 或 `data-visual` 支持。
- card 的 claim 没有被该卡完整证据支持。
- 事实型 card 没有完整截图、使用 `full-bleed`，或 screenshot asset 不是对应的 `product-screenshot` / `data-visual`。
- 事实素材没有 capture 元数据或未通过隐私检查；局部图没有完整来源、cropRegion 越界，或被用于 `single` / `sequence`。
- evidence 不是源比例 `contain`，多图数量或拼接关系不符合 composition 合同。
- 本地素材不存在、格式未知或使用远程 URL，导致 HTML 不能自包含。
- 产品截图没有 alt，或概念图未明确 role。

## 人工验收问题

1. 截图中最先被看到的内容，是否就是标题声称的对象？
2. 去掉宣传文案后，截图本身能否让人猜到主题？
3. 如果截图只是“看起来很丰富”，是否其实在回避没有代表性内容？
4. AI 图是否抢走了产品证据的视觉焦点？
5. 页面是否泄露私人会话、路径、账号、密钥、失败状态或过时版本信息？
6. 在实际传播尺寸下，完整图的核心对象是否仍能被识别；如果不能，是否应该重新截图为完整功能面板，而不是裁掉上下文？
