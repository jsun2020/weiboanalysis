# 部署指南：一步步完成 GitHub Actions 配置

本文档详细说明如何将微博热搜产品创意分析部署到 GitHub Actions 实现云端定时执行。

---

## 前置准备

### 1. 获取 yunwu.ai API Key

本项目使用 yunwu.ai 作为 Claude API 代理，适用于 Claude Max 订阅用户。

API 配置信息：
- **API 地址**: `https://yunwu.ai`
- **模型 ID**: `claude-sonnet-4-5-20250929`
- **API Key**: 联系 yunwu.ai 获取

> ⚠️ API Key 只显示一次，请妥善保存！

### 2. 获取天行数据 API Key

1. 访问 [天行数据](https://www.tianapi.com/)
2. 注册并登录账号
3. 进入 **控制台** → **我的数据**
4. 找到 **微博热搜** API
5. 复制你的 API Key

> 天行数据免费版每天有一定调用次数限制，如需更多可升级套餐

---

## 第一步：创建 GitHub 仓库

### 方式一：使用模板创建（推荐）

```bash
# 如果我们发布了模板仓库，可以直接使用
gh repo create weibo-analysis-actions --template YOUR_TEMPLATE_REPO --private
```

### 方式二：手动创建

1. 在 GitHub 上创建新仓库
   - 名称：`weibo-analysis-actions`
   - 可见性：Private（推荐）或 Public
   - 不要初始化 README

2. 克隆到本地
```bash
git clone https://github.com/YOUR_USERNAME/weibo-analysis-actions.git
cd weibo-analysis-actions
```

3. 复制项目文件
```bash
# 如果你在 Windows 上
xcopy /E /I "C:\Users\sr9rfx\.claude\weiboskills\weibo-analysis-actions\*" .

# 如果你在 Mac/Linux 上
cp -r /path/to/weibo-analysis-actions/* .
```

4. 初始提交
```bash
git add .
git commit -m "Initial commit: Weibo Hot Analysis with Claude Agent SDK"
git push -u origin main
```

---

## 第二步：配置 GitHub Secrets

这是最关键的一步！Secrets 用于安全存储 API 密钥。

### 2.1 进入 Secrets 配置页面

1. 打开你的 GitHub 仓库页面
2. 点击顶部的 **Settings** 标签
3. 在左侧菜单找到 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**

### 2.2 添加必需的 Secrets

#### Secret 1: YUNWU_API_KEY

| 字段 | 值 |
|------|-----|
| Name | `YUNWU_API_KEY` |
| Secret | 你的 yunwu.ai API Key |

点击 **Add secret**

#### Secret 2: TIANAPI_KEY

| 字段 | 值 |
|------|-----|
| Name | `TIANAPI_KEY` |
| Secret | `你的天行数据API Key` |

点击 **Add secret**

### 2.3 验证 Secrets 已添加

配置完成后，你应该在 Secrets 页面看到：

```
Repository secrets
├── YUNWU_API_KEY        Updated just now
└── TIANAPI_KEY          Updated just now
```

---

## 第三步：启用 GitHub Actions

### 3.1 检查 Actions 是否启用

1. 点击仓库顶部的 **Actions** 标签
2. 如果看到提示要求启用 workflows，点击 **I understand my workflows, go ahead and enable them**

### 3.2 查看工作流

启用后，你应该能看到 **Weibo Hot Analysis** 工作流。

---

## 第四步：手动测试运行

在配置定时任务前，先手动测试确保一切正常。

### 4.1 触发手动运行

1. 进入 **Actions** 标签
2. 左侧选择 **Weibo Hot Analysis**
3. 点击右侧的 **Run workflow** 按钮
4. 选择参数：
   - Branch: `main`
   - 分析热搜数量: `top5`（首次测试建议选小一点）
5. 点击绿色的 **Run workflow** 按钮

### 4.2 监控执行过程

1. 点击正在运行的 workflow run
2. 点击 **analyze** job 查看实时日志
3. 观察 Claude Agent 的执行过程

### 4.3 检查输出

执行成功后：

1. **Artifacts**: 在 workflow run 页面底部下载报告
2. **Repository**: 报告会自动提交到 `reports/` 目录
3. **GitHub Pages**: 如果启用，访问你的 Pages URL 查看

---

## 第五步：配置 GitHub Pages（可选）

如果想通过网页访问报告：

### 5.1 启用 Pages

1. 进入 **Settings** → **Pages**
2. Source 选择 **GitHub Actions**
3. 点击 **Save**

### 5.2 验证部署

下次 workflow 运行后，访问：
```
https://YOUR_USERNAME.github.io/weibo-analysis-actions/
```

---

## 第六步：确认定时任务

工作流已配置为定时执行：

| 时间 (UTC) | 时间 (北京) | 说明 |
|-----------|------------|------|
| 01:00 | 09:00 | 早间分析 |
| 10:00 | 18:00 | 晚间分析 |

### 修改定时时间

编辑 `.github/workflows/weibo-analysis.yml`：

```yaml
schedule:
  # 修改 cron 表达式
  - cron: '0 1 * * *'   # 每天北京时间 9:00
  - cron: '0 10 * * *'  # 每天北京时间 18:00
```

常用 cron 表达式：
- `'0 */6 * * *'` - 每6小时
- `'0 1 * * 1-5'` - 工作日早9点
- `'30 0 * * *'` - 每天早8:30（北京时间）

---

## 故障排查

### 问题1：API Key 无效

**症状**: 日志显示 `401 Unauthorized` 或 `Invalid API Key`

**解决**:
1. 检查 Secrets 名称是否正确（区分大小写）
2. 确认 API Key 没有前后空格
3. 重新生成并更新 API Key

### 问题2：yunwu.ai API 连接失败

**症状**: `Connection refused` 或 `Network error`

**解决**:
1. 确认 API_BASE_URL 设置正确 (`https://yunwu.ai`)
2. 确认 YUNWU_API_KEY 有效
3. 检查 yunwu.ai 服务状态

### 问题3：报告未生成

**症状**: Artifacts 为空，reports 目录无文件

**解决**:
1. 查看 Claude Agent 的执行日志
2. 检查是否有权限写入文件
3. 确认 WebSearch 工具是否可用

### 问题4：GitHub Pages 404

**症状**: Pages URL 显示 404

**解决**:
1. 确认 Pages 已启用且选择了 GitHub Actions 作为 source
2. 检查 reports 目录是否有 index.html
3. 等待几分钟后刷新

---

## 费用估算

| 服务 | 费用 | 说明 |
|------|------|------|
| GitHub Actions | 免费 | 公共仓库无限制，私有仓库每月2000分钟 |
| yunwu.ai API | 取决于套餐 | Claude Max 用户通过代理使用 |
| 天行数据 | 免费 | 免费版有每日调用限制 |

---

## 完成检查清单

- [ ] yunwu.ai API Key 已获取并配置
- [ ] 天行数据 API Key 已获取并配置
- [ ] 仓库已创建并推送代码
- [ ] GitHub Secrets 已配置（2个）
- [ ] GitHub Actions 已启用
- [ ] 手动测试运行成功
- [ ] 报告可以下载/访问
- [ ] （可选）GitHub Pages 已启用

---

## 下一步

1. **监控**: 定期检查 Actions 运行状态
2. **优化**: 根据报告质量调整 prompt
3. **扩展**: 添加更多分析维度或数据源
4. **通知**: 可添加 Slack/邮件通知步骤

如有问题，请提交 Issue 或联系维护者。
