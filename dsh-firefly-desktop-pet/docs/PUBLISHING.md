# 发布到 GitHub

仓库已经按「可以直接推上 GitHub 并自动出 Release」的形式准备好了。

---

## 0. 前置准备

| 需要 | 说明 |
|---|---|
| Git | 这台机器上**没有** Git。装一个：`winget install --id Git.Git -e`，或 [GitHub Desktop](https://desktop.github.com/)。 |
| GitHub 账号 | 一个空仓库。 |
| Node.js 18+ | 只有本地跑检查时才需要。 |

---

## 1. 替换占位符

仓库里用 `OWNER` 作为账号占位符，发布前替换（4 个文件）：

在编辑器里全局替换 `OWNER` → 你的账号。命令行做法（把 `你的账号` 换掉再跑）：

```powershell
cd E:\1\dsh-firefly
Get-ChildItem -Recurse -File -Include *.md,*.json |
  ForEach-Object {
    $path = $_.FullName
    $text = Get-Content -LiteralPath $path -Raw
    if ($text -match 'OWNER') {
      Set-Content -LiteralPath $path -Value ($text -replace 'OWNER', '你的账号') -NoNewline
    }
  }
```

涉及：`package.json`（homepage / repository / bugs）、`CHANGELOG.md`（两个链接）、`README.md`、`README.zh.md`（Git 安装地址）。

---

## 2. 本地检查并提交

```powershell
cd E:\1\dsh-firefly
node scripts/validate.mjs
node scripts/smoke.mjs
git init -b main
git add .
git commit -m "feat: dsh-firefly 1.0.0 — interactive desk pet for the Harness Web UI"
```

> 提交前确认 `docs/preview.png` 是用 `assets/firefly.webp` 渲染的，`icon.png` 是同一张图的头部裁切，两者都不是游戏截图。

---

## 3. 建仓库并推送

GitHub 上新建**空**公开仓库（不要勾 README / .gitignore / License），名字建议 `dsh-firefly`：

```powershell
git remote add origin https://github.com/<你的账号>/dsh-firefly.git
git push -u origin main
```

推送后确认：Actions 已启用、`CI` 两个 Node 版本都绿。

---

## 4. 发版本

```powershell
# 改 package.json 的 version（例如 1.0.1），同步写 CHANGELOG.md
git add .
git commit -m "chore: release v1.0.1"
git tag v1.0.1
git push origin main --tags
```

tag 必须 `vX.Y.Z` 且与 `package.json` 的 `version` 一致，否则 `release.yml` 直接失败。

工作流会：跑检查 → 打 `dist/dsh-firefly-<version>.zip` → `npm pack` 出 tgz → 生成 `SHA256SUMS.txt` → 建 Release 并附产物。

---

## 5. 别人怎么装

- **Git 仓库**：插件 → Add plugin 旁的箭头 → Install a third-party plugin → 填仓库地址
- **本地目录**：克隆/解压后选目录（pnpm 会 link，改代码重载即生效）
- **Release 里的 zip**：解压后按「本地目录」安装

装完确认 bundle 开启，桌宠出现在右下角。

---

## 6. 人工验收清单

自动化测试只能证明「注册对了、状态机对了、样式生成了」，**手感必须真机看**：

- [ ] 桌宠出现在右下角，浮动自然，不抢焦点
- [ ] **安静时双腿在摆动**，幅度看得出来但不夸张、接缝（外套下摆处）看不出来
- [ ] 拖拽时腿停下，松手后恢复摆动
- [ ] **点界面上任何其他地方都正常**（overlay 没吞事件）——这是最容易翻车的一项
- [ ] 单击：弹跳 + 气泡；气泡在中英文界面都显示正常
- [ ] 双击：转圈反应；连点几次不卡顿
- [ ] 拖到四个角落：不越界、位置重启后仍在
- [ ] 把窗口缩到很小：位置按比例跟随，不会跑到视野外
- [ ] 右键菜单：大小、不透明度、隐藏/恢复都生效
- [ ] 上传一张带白底的图：去白底后边缘干净，角色内部白（袖口/鞋）不被误删
- [ ] 浅色与深色主题下都看得清（气泡、菜单、形象描边）
- [ ] 45 秒不操作：变暗 + zzz；点一下立刻恢复
- [ ] 系统开启「减少动态效果」后，浮动与晃腿停止
- [ ] 停用 bundle：桌宠消失，`<style data-plugin-css="dsh-firefly/pet.css">` 被移除
- [ ] 打包后的 zip 解压安装一遍，确认 `icon.png` 与 `assets/` 两张图都在，`files` 没漏

任何一项不过，改 `client.js` 后重新打 tag（`v1.3.1`）。

> 改过 `assets/firefly.webp` 的话，先跑 `npm run sync-sprite` 再提交，否则校验会拦下来。

---

## 7. 常见问题

**装完看不见桌宠？**
重启一次 Harness。客户端模块在安装后可能需要重新加载。

**桌宠挡住点击？**
不该发生：overlay 根节点是 `pointer-events:none!important`。若出现，检查是不是自定义样式把它覆盖了，并在 issue 里附上 Harness 版本。

**上传的图片下次打开没了？**
图片存在 `localStorage`（约 5 MB 配额）。图片过大时插件会丢弃未抠图的副本；再不行就换张小一点的图。

**想把内置形象换掉？**
把透明底的 PNG/WebP 放到 `assets/firefly.webp`，跑 `npm run sync-sprite` 重新内联，再跑 `npm run check` 确认内联副本与素材一致。图标 `icon.png` 和预览图 `docs/preview.png` 也需要一起重做。

**可以打包官方立绘吗？**
这个仓库按你的要求打包了这张流萤图，但它**不在 MIT 许可范围内**：角色与原始美术版权归 HoYoverse，仓库只是引用。公开发布前请自行确认使用权；如果只是自用/私仓，没问题。不想冒风险就把 `assets/firefly.webp` 换成你有权使用的图（或从历史里删掉），并在 README/NOTICE 里说明。

---

## 8. 可选：加徽章

```markdown
[![CI](https://github.com/<你的账号>/dsh-firefly/actions/workflows/ci.yml/badge.svg)](https://github.com/<你的账号>/dsh-firefly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
```

仓库还不存在时加徽章会显示失败状态，建议推送后再加。
