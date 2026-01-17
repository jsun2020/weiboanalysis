# Weibo Hot Analysis - GitHub Actions

基于 Anthropic SDK 的微博热搜产品创意分析自动化工具，支持 GitHub Actions 定时执行。

## 技术架构

- **AI 分析**: Claude claude-sonnet-4-5-20250929 (通过 yunwu.ai API 代理)
- **数据源**: 天行数据微博热搜 API
- **自动化**: GitHub Actions 定时执行
- **输出**: HTML 格式分析报告

### 方案优势

1. **云端定时执行**: 无需本地电脑在线
2. **自动化部署**: 报告自动上传到 GitHub Pages 或 Artifacts
3. **版本管理**: 所有报告历史可追溯
4. **免费额度**: GitHub Actions 每月 2000 分钟免费

## 需要配置的 GitHub Secrets

| Secret 名称 | 说明 | 获取方式 |
|------------|------|---------|
| `YUNWU_API_KEY` | yunwu.ai API 密钥 | 第三方 API 代理提供 |
| `TIANAPI_KEY` | 天行数据 API 密钥 | [天行数据](https://www.tianapi.com/) |

## 项目结构

```
weibo-analysis-actions/
├── .github/
│   └── workflows/
│       └── weibo-analysis.yml    # GitHub Actions 工作流
├── src/
│   └── agent.ts                  # Anthropic SDK 主程序
├── reports/                      # 生成的报告目录
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. Fork 或克隆仓库

```bash
git clone https://github.com/YOUR_USERNAME/weibo-analysis-actions.git
cd weibo-analysis-actions
```

### 2. 配置 GitHub Secrets

1. 进入你的 GitHub 仓库
2. 点击 `Settings` → `Secrets and variables` → `Actions`
3. 点击 `New repository secret`
4. 添加以下 Secrets:
   - `YUNWU_API_KEY`: 你的 yunwu.ai API Key
   - `TIANAPI_KEY`: 你的天行数据 API Key

### 3. 启用 GitHub Actions

1. 进入 `Actions` 标签页
2. 如果提示启用 workflows，点击确认
3. 工作流会按照 cron 表达式定时执行

### 4. 手动触发测试

1. 进入 `Actions` → `Weibo Hot Analysis`
2. 点击 `Run workflow`
3. 选择分支，点击绿色按钮执行

## 定时执行配置

默认配置为每天早上 9:00 (UTC+8) 执行：

```yaml
schedule:
  - cron: '0 1 * * *'  # UTC 时间 01:00 = 北京时间 09:00
```

可修改为其他时间：
- 每6小时: `'0 */6 * * *'`
- 每天两次: `'0 1,13 * * *'`
- 工作日执行: `'0 1 * * 1-5'`

## 报告访问

### 方式一：GitHub Artifacts
每次执行后，报告会上传为 Artifact，可在 Actions 运行记录中下载。

### 方式二：GitHub Pages（推荐）
启用后，报告会自动发布到 `https://YOUR_USERNAME.github.io/weibo-analysis-actions/`

## 本地开发

```bash
# 安装依赖
npm install

# 设置环境变量
export YUNWU_API_KEY=your-api-key
export API_BASE_URL=https://yunwu.ai
export MODEL_ID=claude-sonnet-4-5-20250929
export TIANAPI_KEY=your-tianapi-key

# 运行
npm run analyze
```

## 许可证

MIT License
