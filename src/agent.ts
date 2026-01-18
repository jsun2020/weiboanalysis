/**
 * 微博热搜产品创意分析 - 基于 Anthropic SDK + 第三方 API
 *
 * 用于 GitHub Actions 定时执行的自动化版本
 * 使用 yunwu.ai 作为 API 代理
 */

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从命令行参数获取分析数量
const args = process.argv.slice(2);
const topNMatch = args[0]?.match(/top(\d+)/i);
const topN = topNMatch ? parseInt(topNMatch[1]) : 10;

// 环境变量
const API_KEY = process.env.YUNWU_API_KEY || process.env.ANTHROPIC_API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || "https://yunwu.ai";
const TIANAPI_KEY = process.env.TIANAPI_KEY;
const MODEL_ID = process.env.MODEL_ID || "claude-sonnet-4-5-20250929";

if (!API_KEY) {
  console.error("Error: YUNWU_API_KEY or ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

if (!TIANAPI_KEY) {
  console.error("Error: TIANAPI_KEY environment variable is required");
  process.exit(1);
}

// 初始化 Anthropic 客户端（使用第三方 API）
const anthropic = new Anthropic({
  apiKey: API_KEY,
  baseURL: API_BASE_URL,
});

// 生成时间戳
const now = new Date();
const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
const reportDate = now.toLocaleString("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// 报告输出路径
const reportDir = path.join(process.cwd(), "reports");
const reportPath = path.join(reportDir, `weibo-hot-analysis-${timestamp}.html`);

// 确保报告目录存在
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// 类型定义
interface WeiboHotItem {
  hotword: string;
  hotwordnum: string;
}

interface ProductIdea {
  hotTopic: string;
  productName: string;
  coreFunction: string;
  targetUsers: string;
  eventTimeline: string[];
  scores: {
    innovation: number;
    topicality: number;
    fun: number;
    practicality: number;
    feasibility: number;
    total: number;
  };
  grade: "excellent" | "good" | "normal";
}

// 获取微博热搜数据
async function fetchWeiboHot(): Promise<WeiboHotItem[]> {
  console.log("正在获取微博热搜数据...");
  try {
    const response = await axios.get(
      `https://apis.tianapi.com/weibohot/index?key=${TIANAPI_KEY}`
    );
    if (response.data.code === 200 && response.data.result?.list) {
      console.log(`成功获取 ${response.data.result.list.length} 条热搜`);
      return response.data.result.list;
    }
    throw new Error(`API返回错误: ${response.data.msg}`);
  } catch (error) {
    console.error("获取热搜数据失败:", error);
    throw error;
  }
}

// 使用 Claude 分析热搜并生成产品创意
async function analyzeWithClaude(hotItems: WeiboHotItem[]): Promise<ProductIdea[]> {
  console.log(`\n正在使用 Claude 分析 ${hotItems.length} 个热搜话题...`);
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Model: ${MODEL_ID}\n`);

  const hotListText = hotItems
    .map((item, i) => `${i + 1}. ${item.hotword} (热度: ${item.hotwordnum})`)
    .join("\n");

  const prompt = `你是一个产品创意分析专家。请分析以下微博热搜话题，为每个话题生成一个产品创意。

## 热搜列表
${hotListText}

## 分析要求

对每个热搜话题，请：

1. **理解话题背景**：根据热搜标题推断事件背景、可能的原因和公众关注点

2. **生成产品创意**，包含：
   - 产品名称（用「」包裹，要有创意）
   - 核心功能（50-100字描述）
   - 目标用户（年龄、职业、特征）
   - 事件脉络（3-4个要点）

3. **评分**（满分100分）：
   - 创新性 (0-30分): 市场上是否有类似产品
   - 话题性 (0-25分): 是否容易引发讨论传播
   - 趣味性 (0-25分): 用户体验是否有趣
   - 实用性 (0-10分): 是否解决真实需求
   - 可行性 (0-10分): 技术和商业可行性

## 输出格式

请以JSON数组格式输出，每个元素包含：
\`\`\`json
{
  "hotTopic": "热搜话题",
  "productName": "「产品名称」",
  "coreFunction": "核心功能描述",
  "targetUsers": "目标用户描述",
  "eventTimeline": ["事件要点1", "事件要点2", "事件要点3"],
  "scores": {
    "innovation": 25,
    "topicality": 22,
    "fun": 20,
    "practicality": 8,
    "feasibility": 9,
    "total": 84
  }
}
\`\`\`

请直接输出JSON数组，不要有其他文字。确保total分数等于其他5项之和。`;

  // 重试配置
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`API 调用尝试 ${attempt}/${maxRetries}...`);

      const response = await anthropic.messages.create({
        model: MODEL_ID,
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // 详细记录响应信息
      console.log("API 响应状态:");
      console.log("  - stop_reason:", response.stop_reason);
      console.log("  - content 数组长度:", response.content?.length || 0);
      console.log("  - usage:", JSON.stringify(response.usage));

      // 验证响应内容存在
      if (!response.content || response.content.length === 0) {
        throw new Error(`API 返回空内容 (attempt ${attempt})`);
      }

      // 提取响应文本
      const firstContent = response.content[0];
      if (firstContent.type !== "text") {
        throw new Error(`响应类型不是 text: ${firstContent.type}`);
      }

      const responseText = firstContent.text || "";
      console.log("收到响应，长度:", responseText.length, "字符");

      // 检查是否为空响应
      if (responseText.length === 0) {
        throw new Error(`API 返回空文本响应 (attempt ${attempt})`);
      }

    // 多种方式尝试解析JSON
    let ideas: ProductIdea[] | null = null;

    // 方法1: 尝试从 ```json ... ``` 代码块中提取
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        const jsonContent = codeBlockMatch[1].trim();
        ideas = JSON.parse(jsonContent);
        console.log("从代码块中成功提取JSON");
      } catch (e) {
        console.log("代码块JSON解析失败，尝试其他方法");
      }
    }

    // 方法2: 尝试提取 [...] 数组
    if (!ideas) {
      const arrayMatch = responseText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          ideas = JSON.parse(arrayMatch[0]);
          console.log("从数组匹配中成功提取JSON");
        } catch (e) {
          console.log("数组JSON解析失败，尝试其他方法");
        }
      }
    }

    // 方法3: 尝试直接解析整个响应
    if (!ideas) {
      try {
        ideas = JSON.parse(responseText.trim());
        console.log("直接解析响应成功");
      } catch (e) {
        console.log("直接解析失败");
      }
    }

    // 如果所有方法都失败
    if (!ideas || !Array.isArray(ideas)) {
      console.error("无法从响应中提取JSON");
      console.log("响应内容前1000字符:", responseText.slice(0, 1000));
      console.log("响应内容后500字符:", responseText.slice(-500));
      throw new Error("Invalid response format - could not extract JSON array");
    }

    console.log(`成功解析 ${ideas.length} 个产品创意`);

      // 添加评级
      return ideas.map((idea) => ({
        ...idea,
        grade:
          idea.scores.total >= 80
            ? "excellent"
            : idea.scores.total >= 60
            ? "good"
            : "normal",
      }));

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`尝试 ${attempt} 失败:`, lastError.message);

      if (attempt < maxRetries) {
        const waitTime = attempt * 5000; // 递增等待时间: 5s, 10s, 15s
        console.log(`等待 ${waitTime / 1000} 秒后重试...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  // 所有重试都失败
  console.error("Claude 分析失败: 所有重试都失败");
  throw lastError || new Error("Unknown error after all retries");
}

// 生成HTML报告
function generateHTML(ideas: ProductIdea[]): string {
  const excellentIdeas = ideas.filter((i) => i.grade === "excellent");
  const goodIdeas = ideas.filter((i) => i.grade === "good");
  const normalIdeas = ideas.filter((i) => i.grade === "normal");

  const generateCard = (idea: ProductIdea): string => {
    const gradeClass = idea.grade;
    const gradeLabel =
      idea.grade === "excellent"
        ? "优秀"
        : idea.grade === "good"
        ? "良好"
        : "一般";

    return `
        <article class="idea-card ${gradeClass}">
            <div class="card-header">
                <span class="hot-topic">🔥 ${idea.hotTopic}</span>
                <span class="score-badge">${idea.scores.total}分</span>
            </div>
            <div class="card-body">
                <h3 class="idea-name">${idea.productName}</h3>

                <div class="event-timeline">
                    <h4>📰 事件脉络</h4>
                    <ul>
                        ${idea.eventTimeline.map((e) => `<li>${e}</li>`).join("")}
                    </ul>
                </div>

                <div class="idea-details">
                    <h4>💡 核心功能</h4>
                    <p>${idea.coreFunction}</p>

                    <h4>👥 目标用户</h4>
                    <p>${idea.targetUsers}</p>
                </div>

                <div class="score-breakdown">
                    <h4>📊 评分详情</h4>
                    <div class="score-bar">
                        <span>创新性</span>
                        <div class="bar"><div class="fill" style="width: ${(idea.scores.innovation / 30) * 100}%"></div></div>
                        <span>${idea.scores.innovation}/30</span>
                    </div>
                    <div class="score-bar">
                        <span>话题性</span>
                        <div class="bar"><div class="fill" style="width: ${(idea.scores.topicality / 25) * 100}%"></div></div>
                        <span>${idea.scores.topicality}/25</span>
                    </div>
                    <div class="score-bar">
                        <span>趣味性</span>
                        <div class="bar"><div class="fill" style="width: ${(idea.scores.fun / 25) * 100}%"></div></div>
                        <span>${idea.scores.fun}/25</span>
                    </div>
                    <div class="score-bar">
                        <span>实用性</span>
                        <div class="bar"><div class="fill" style="width: ${(idea.scores.practicality / 10) * 100}%"></div></div>
                        <span>${idea.scores.practicality}/10</span>
                    </div>
                    <div class="score-bar">
                        <span>可行性</span>
                        <div class="bar"><div class="fill" style="width: ${(idea.scores.feasibility / 10) * 100}%"></div></div>
                        <span>${idea.scores.feasibility}/10</span>
                    </div>
                    <div class="total-score">
                        <span>综合评分</span>
                        <span>${idea.scores.total}/100 <span class="grade-label">${gradeLabel}</span></span>
                    </div>
                </div>
            </div>
        </article>`;
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>微博热搜产品创意分析报告</title>
    <style>
        :root {
            --excellent-color: #10b981;
            --excellent-bg: #ecfdf5;
            --good-color: #3b82f6;
            --good-bg: #eff6ff;
            --normal-color: #6b7280;
            --normal-bg: #f9fafb;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --bg-main: #f3f4f6;
            --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg-main);
            color: var(--text-primary);
            line-height: 1.6;
        }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem 2rem;
            text-align: center;
        }
        header h1 { font-size: 2.5rem; margin-bottom: 1rem; }
        .report-date { font-size: 1rem; opacity: 0.9; }
        .summary {
            margin-top: 1rem;
            font-size: 1.1rem;
            background: rgba(255,255,255,0.2);
            display: inline-block;
            padding: 0.5rem 1.5rem;
            border-radius: 2rem;
        }
        .stats-bar {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-top: 1.5rem;
            flex-wrap: wrap;
        }
        .stat-item {
            background: rgba(255,255,255,0.15);
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
        }
        .stat-value { font-size: 1.5rem; font-weight: bold; }
        .stat-label { font-size: 0.85rem; opacity: 0.9; }
        main { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        section { margin-bottom: 3rem; }
        section h2 {
            font-size: 1.5rem;
            margin-bottom: 1.5rem;
            padding-bottom: 0.5rem;
            border-bottom: 3px solid var(--excellent-color);
        }
        .excellent-ideas h2 { border-color: var(--excellent-color); }
        .good-ideas h2 { border-color: var(--good-color); }
        .normal-ideas h2 { border-color: var(--normal-color); }
        .ideas-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1.5rem;
        }
        .idea-card {
            background: white;
            border-radius: 1rem;
            overflow: hidden;
            box-shadow: var(--card-shadow);
            transition: transform 0.3s ease;
        }
        .idea-card:hover { transform: translateY(-5px); }
        .idea-card.excellent { border-top: 4px solid var(--excellent-color); }
        .idea-card.good { border-top: 4px solid var(--good-color); }
        .idea-card.normal { border-top: 4px solid var(--normal-color); }
        .card-header {
            padding: 1rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e5e7eb;
        }
        .hot-topic { font-size: 0.85rem; color: #ef4444; font-weight: 500; }
        .score-badge {
            font-weight: bold;
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.9rem;
        }
        .excellent .score-badge { background: var(--excellent-bg); color: var(--excellent-color); }
        .good .score-badge { background: var(--good-bg); color: var(--good-color); }
        .normal .score-badge { background: var(--normal-bg); color: var(--normal-color); }
        .card-body { padding: 1.5rem; }
        .idea-name { font-size: 1.25rem; margin-bottom: 1rem; }
        .event-timeline {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 1rem;
            margin-bottom: 1rem;
            border-radius: 0 0.5rem 0.5rem 0;
        }
        .event-timeline h4 { font-size: 0.9rem; color: #92400e; margin-bottom: 0.5rem; }
        .event-timeline ul { margin-left: 1rem; font-size: 0.9rem; color: #78350f; }
        .event-timeline li { margin-bottom: 0.25rem; }
        .idea-details h4 { font-size: 0.95rem; color: var(--text-secondary); margin: 1rem 0 0.5rem 0; }
        .idea-details p { font-size: 0.95rem; }
        .score-breakdown {
            margin-top: 1.5rem;
            padding-top: 1rem;
            border-top: 1px dashed #e5e7eb;
        }
        .score-breakdown h4 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.75rem; }
        .score-bar {
            display: flex;
            align-items: center;
            margin-bottom: 0.5rem;
            font-size: 0.85rem;
        }
        .score-bar > span:first-child { width: 60px; color: var(--text-secondary); }
        .score-bar > span:last-child { width: 50px; text-align: right; font-weight: 500; }
        .bar {
            flex: 1;
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            margin: 0 0.5rem;
            overflow: hidden;
        }
        .bar .fill { height: 100%; border-radius: 4px; }
        .excellent .bar .fill { background: linear-gradient(90deg, var(--excellent-color), #34d399); }
        .good .bar .fill { background: linear-gradient(90deg, var(--good-color), #60a5fa); }
        .normal .bar .fill { background: linear-gradient(90deg, var(--normal-color), #9ca3af); }
        .total-score {
            margin-top: 0.75rem;
            padding-top: 0.75rem;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            font-weight: bold;
        }
        .grade-label {
            display: inline-block;
            padding: 0.2rem 0.6rem;
            border-radius: 0.25rem;
            font-size: 0.8rem;
            margin-left: 0.5rem;
        }
        .excellent .grade-label { background: var(--excellent-bg); color: var(--excellent-color); }
        .good .grade-label { background: var(--good-bg); color: var(--good-color); }
        .normal .grade-label { background: var(--normal-bg); color: var(--normal-color); }
        footer { text-align: center; padding: 2rem; color: var(--text-secondary); font-size: 0.9rem; }
        @media (max-width: 768px) {
            header h1 { font-size: 1.75rem; }
            .ideas-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <header>
        <h1>🔥 微博热搜产品创意分析报告</h1>
        <p class="report-date">生成时间: ${reportDate}</p>
        <p class="summary">共分析 ${ideas.length} 个热搜话题，发现 ${ideas.length} 个产品创意</p>
        <div class="stats-bar">
            <div class="stat-item">
                <div class="stat-value">${excellentIdeas.length}</div>
                <div class="stat-label">优秀创意</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${goodIdeas.length}</div>
                <div class="stat-label">良好创意</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${normalIdeas.length}</div>
                <div class="stat-label">其他创意</div>
            </div>
        </div>
    </header>

    <main>
        ${excellentIdeas.length > 0 ? `
        <section class="excellent-ideas">
            <h2>🌟 优秀创意 (≥80分)</h2>
            <div class="ideas-grid">
                ${excellentIdeas.map(generateCard).join("")}
            </div>
        </section>
        ` : ""}

        ${goodIdeas.length > 0 ? `
        <section class="good-ideas">
            <h2>👍 良好创意 (60-79分)</h2>
            <div class="ideas-grid">
                ${goodIdeas.map(generateCard).join("")}
            </div>
        </section>
        ` : ""}

        ${normalIdeas.length > 0 ? `
        <section class="normal-ideas">
            <h2>📝 其他创意 (<60分)</h2>
            <div class="ideas-grid">
                ${normalIdeas.map(generateCard).join("")}
            </div>
        </section>
        ` : ""}
    </main>

    <footer>
        <p>由 Claude (${MODEL_ID}) + GitHub Actions 自动生成</p>
        <p>数据来源: 微博热搜榜单 (天行数据API)</p>
    </footer>
</body>
</html>`;
}

// 主函数
async function main() {
  console.log("=".repeat(60));
  console.log("微博热搜产品创意分析 - GitHub Actions 版本");
  console.log("=".repeat(60));
  console.log(`分析数量: top${topN}`);
  console.log(`API 地址: ${API_BASE_URL}`);
  console.log(`模型: ${MODEL_ID}`);
  console.log(`报告路径: ${reportPath}`);
  console.log(`报告时间: ${reportDate}`);
  console.log("=".repeat(60));
  console.log("");

  try {
    // 1. 获取微博热搜
    const hotItems = await fetchWeiboHot();

    // 2. 筛选有产品创意潜力的话题（跳过纯娱乐八卦）
    const filteredItems = hotItems.slice(0, Math.min(topN * 2, hotItems.length));
    const selectedItems = filteredItems.slice(0, topN);

    console.log(`\n筛选了 ${selectedItems.length} 个话题进行分析:`);
    selectedItems.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.hotword}`);
    });

    // 3. 使用 Claude 分析
    const ideas = await analyzeWithClaude(selectedItems);

    console.log(`\n分析完成，生成了 ${ideas.length} 个产品创意`);

    // 4. 统计
    const excellent = ideas.filter((i) => i.grade === "excellent").length;
    const good = ideas.filter((i) => i.grade === "good").length;
    const normal = ideas.filter((i) => i.grade === "normal").length;

    console.log(`  - 优秀 (≥80分): ${excellent}`);
    console.log(`  - 良好 (60-79分): ${good}`);
    console.log(`  - 一般 (<60分): ${normal}`);

    // 5. 生成HTML报告
    console.log("\n正在生成HTML报告...");
    const html = generateHTML(ideas);
    fs.writeFileSync(reportPath, html, "utf-8");

    console.log("\n" + "=".repeat(60));
    console.log("分析完成！");
    console.log(`报告已保存到: ${reportPath}`);
    console.log("=".repeat(60));

    // 输出报告文件路径供 GitHub Actions 使用
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, `report_path=${reportPath}\n`);
      fs.appendFileSync(
        outputFile,
        `report_name=weibo-hot-analysis-${timestamp}.html\n`
      );
    }

    // 输出推荐的优秀创意
    if (excellent > 0) {
      console.log("\n🌟 推荐关注的优秀创意:");
      ideas
        .filter((i) => i.grade === "excellent")
        .forEach((idea) => {
          console.log(`  - ${idea.productName} (${idea.scores.total}分)`);
          console.log(`    ${idea.coreFunction.slice(0, 50)}...`);
        });
    }
  } catch (error) {
    console.error("执行出错:", error);
    process.exit(1);
  }
}

// 执行
main();
