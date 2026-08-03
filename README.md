# AI Synthesis

一个基于 React、TypeScript 和 Vite 的单人炼金卡牌游戏。

在线游戏：<https://bruisebuill.github.io/AI-Synthesis/>

## 本地运行

需要 Node.js 22 和 pnpm。

```powershell
pnpm install
pnpm dev
```

## 验证

```powershell
pnpm verify:all
```

## 发布

推送到 `main` 后，`.github/workflows/deploy-pages.yml` 会构建项目并发布到 GitHub Pages。生产构建会自动包含根目录的 `CardData.xlsm`，不要手工维护第二份工作簿。
