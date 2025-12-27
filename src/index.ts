import { Context, Schema, h } from 'koishi'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as crypto from 'crypto'

export const name = 'mk3s-hcrm'
export const inject = ['puppeteer', 'http']

export interface Config {
  backgroundImage?: string
  fontAnurati?: string
  fontChiMing?: string
  fontZcool?: string
  weekendQuotes?: string[]
  hitokotoType?: string
}

export const Config: Schema<Config> = Schema.object({
  backgroundImage: Schema.string().description('背景图片路径，留空使用默认'),
  fontAnurati: Schema.string().description('Anurati 字体路径，留空使用默认'),
  fontChiMing: Schema.string().description('赤明字体路径，留空使用默认'),
  fontZcool: Schema.string().description('站酷快乐体路径，留空使用默认'),
  weekendQuotes: Schema.array(String).default([
    '睡到自然醒喵', '公园散散步喵', '煮杯咖啡发呆', '陪陪家人放松', '享受一顿大餐',
    '听首轻松的歌', '晒晒温暖太阳', '读本有趣的书', '做个美梦也好', '约朋友聚一聚',
    '要玩场游戏吗', '来饮茶看书喵', '整理一下心情', '享受独处时光', '陪猫玩玩闹闹', 
    '玩会游戏放松', '陪我聊聊天喵'
  ]).description('周末打趣文案库'),
  hitokotoType: Schema.union([
    Schema.const('a').description('动画'),
    Schema.const('b').description('漫画'),
    Schema.const('c').description('游戏'),
    Schema.const('d').description('文学'),
    Schema.const('e').description('原创'),
    Schema.const('f').description('来自网络'),
    Schema.const('g').description('其他'),
    Schema.const('h').description('影视'),
    Schema.const('i').description('诗词'),
    Schema.const('j').description('网易云'),
    Schema.const('k').description('哲学'),
    Schema.const('l').description('抖机灵'),
  ]).default('a').description('一言分类'),
})

// 辅助函数：获取 CPU 信息
function getCpuInfo() {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type]
    }
    idle += cpu.times.idle
  }
  return { idle, total, model: cpus[0].model }
}

// 辅助函数：获取系统状态
async function getSystemStats() {
  const start = getCpuInfo()
  await new Promise(resolve => setTimeout(resolve, 500))
  const end = getCpuInfo()
  
  const idleDiff = end.idle - start.idle
  const totalDiff = end.total - start.total
  const cpuPercent = (100 - (idleDiff / totalDiff) * 100).toFixed(1)

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const ramPercent = ((usedMem / totalMem) * 100).toFixed(1)

  const osInfo = `${os.type()} ${os.release()}`

  return { cpuPercent, ramPercent, cpuModel: start.model, osInfo }
}

// 辅助函数：读取资源并转 Base64
function getAssetBase64(filename: string, customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) {
     const bitmap = fs.readFileSync(customPath)
     return Buffer.from(bitmap).toString('base64')
  }

  // 假设 assets 文件夹在项目根目录，与 src 同级
  // 在开发环境 (ts-node) 下，__dirname 是 src
  // 在生产环境 (dist/lib) 下，__dirname 是 lib
  // 我们尝试向上寻找 assets
  
  let assetPath = path.resolve(__dirname, '../assets', filename)
  if (!fs.existsSync(assetPath)) {
     // 尝试再向上一级 (如果是在 lib/index.js)
     assetPath = path.resolve(__dirname, '../../assets', filename)
  }
  
  // 如果还是找不到，尝试直接在当前目录找 (兼容测试环境)
  if (!fs.existsSync(assetPath)) {
      assetPath = path.resolve(__dirname, 'assets', filename)
  }

  if (fs.existsSync(assetPath)) {
    const bitmap = fs.readFileSync(assetPath)
    return Buffer.from(bitmap).toString('base64')
  }
  return ''
}

export function apply(ctx: Context, config: Config) {
  ctx.command('hcrm', '查看系统状态卡片')
    .action(async ({ session }) => {
      // 1. 获取数据
      const stats = await getSystemStats()
      
      let hitokotoText = '生活明朗，万物可爱。'
      try {
        const data = await ctx.http.get(`https://v1.hitokoto.cn?encode=json&c=${config.hitokotoType}`)
        hitokotoText = data.hitokoto || hitokotoText
      } catch (e) {
        ctx.logger.warn('Hitokoto fetch failed: ' + e)
      }

      // 2. 准备时间与文案
      const dateObj = new Date()
      const timeStr = dateObj.toLocaleString('zh-CN', { hour12: false })
      const timestamp = dateObj.getTime()

      let lunarDate = ''
      try {
        lunarDate = new Intl.DateTimeFormat('zh-CN', {
            calendar: 'chinese',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(dateObj)
      } catch (e) {
        lunarDate = '农历获取失败'
      }

      const day = dateObj.getDay()
      const weekendQuotes = config.weekendQuotes
      const randomQuote = weekendQuotes[Math.floor(Math.random() * weekendQuotes.length)]

      let wittyDesc = '平平无奇的工作日'
      if (day === 1) wittyDesc = '周一 又是新的开始'
      else if (day === 5) wittyDesc = '周五 马上就放假啦'
      else if (day === 6) wittyDesc = `周六 ${randomQuote}`
      else if (day === 0) wittyDesc = `周日 ${randomQuote}`

      const hour = dateObj.getHours()
      let greeting = '晚上好'
      if (hour >= 0 && hour < 6) greeting = '凌晨好'
      else if (hour >= 6 && hour < 11) greeting = '早上好'
      else if (hour >= 11 && hour < 13) greeting = '中午好'
      else if (hour >= 13 && hour < 18) greeting = '下午好'

      const dateDesc = `${wittyDesc} · ${greeting}`
      const renderHash = crypto.createHash('md5').update(timestamp.toString() + dateDesc).digest('hex').substring(0, 16).toUpperCase()

      // 3. 准备资源 Base64
      const bgBase64 = getAssetBase64('1.jpg', config.backgroundImage)
      const fontAnurati = getAssetBase64('Anurati-Regular.otf', config.fontAnurati)
      const fontChiMing = getAssetBase64('赤明工业革命SC-Regular.otf', config.fontChiMing)
      const fontZcool = getAssetBase64('站酷快乐体.ttf', config.fontZcool)

      // 4. 构造 HTML
      const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <style>
        @font-face {
            font-family: 'Anurati';
            src: url(data:font/otf;base64,${fontAnurati});
        }
        @font-face {
            font-family: 'ChiMing';
            src: url(data:font/otf;base64,${fontChiMing});
        }
        @font-face {
            font-family: 'Zcool';
            src: url(data:font/ttf;base64,${fontZcool});
        }

        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: transparent;
        }

        .main-card {
            position: relative;
            width: 360px; 
            padding: 50px 30px; 
            background: url(data:image/jpeg;base64,${bgBase64}) center center / cover no-repeat;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .main-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            z-index: 0;
        }

        .glass-panel {
            position: relative;
            z-index: 1;
            width: 100%;
            box-sizing: border-box;
            background: rgba(0, 0, 0, 0.2); 
            backdrop-filter: blur(6px);
            padding: 25px 20px;
            border-radius: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            border: 3px solid rgba(255, 255, 255, 0.5);
        }

        .title {
            font-family: 'Anurati', sans-serif;
            font-size: 42px;
            letter-spacing: 2px;
            color: #fff;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.6); 
            margin: 0;
            text-align: center;
        }

        .lunar-box {
            text-align: center;
            margin-top: -10px;
            margin-bottom: 5px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .lunar-text {
            font-family: 'Zcool', sans-serif;
            font-size: 12px;
            color: #ccc;
            opacity: 0.9;
            letter-spacing: 1px;
        }

        .time-block {
            text-align: center;
            margin-bottom: 10px;
        }
        .time-str {
            font-family: 'Zcool', sans-serif;
            font-size: 28px;
            color: #fff;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.4);
        }
        .timestamp {
            font-family: 'ChiMing', sans-serif;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
            margin-top: 5px;
            letter-spacing: 1px;
        }

        .stat-group {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin-bottom: 10px;
        }

        .stat-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }

        .stat-label {
            font-family: 'ChiMing', sans-serif;
            font-size: 18px;
            color: #fff;
            width: 50px;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
        }

        .stat-value-text {
            font-family: 'ChiMing', sans-serif;
            font-size: 18px;
            color: #fff;
            margin-left: 10px;
            min-width: 50px;
            text-align: right;
        }

        .progress-container {
            flex: 1;
            height: 14px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 0;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            background: #fff;
            border-radius: 0;
            transition: width 0.5s ease;
        }

        .info-text {
            font-family: 'ChiMing', sans-serif;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            text-align: left;
            width: 100%;
            padding-left: 50px;
            box-sizing: border-box;
            margin-top: -2px;
        }

        .hitokoto-box {
            width: 100%;
            text-align: center;
            margin-top: 15px;
            margin-bottom: 5px;
            padding: 0 5px;
        }
        .hitokoto-text {
            font-family: 'Zcool', sans-serif;
            font-size: 14px;
            color: #fff;
            line-height: 1.5;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.4);
            font-style: italic;
        }

        .footer {
            font-family: 'ChiMing', sans-serif;
            font-size: 12px;
            color: #ccc;
            margin-top: 5px;
            text-align: center;
            opacity: 0.9;
            letter-spacing: 1px;
        }

        .hash-text {
            position: absolute;
            bottom: 5px;
            right: 10px;
            font-family: 'ChiMing', sans-serif;
            font-size: 8px;
            color: rgba(255, 255, 255, 0.2);
            letter-spacing: 1px;
            text-align: right;
        }
    </style>
</head>
<body>
    <div class="main-card">
        <div class="glass-panel">
            <div class="hash-text">${renderHash}</div>
            <h1 class="title">HCRM</h1>
            
            <div class="lunar-box">
                <div class="lunar-text">${lunarDate}</div>
                <div class="lunar-text">${dateDesc}</div>
            </div>

            <div class="time-block">
                <div class="time-str">${timeStr}</div>
                <div class="timestamp">Timestamp: ${timestamp}</div>
            </div>

            <div class="stat-group">
                <div class="stat-row">
                    <span class="stat-label">CPU</span>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${stats.cpuPercent}%"></div>
                    </div>
                    <span class="stat-value-text">${stats.cpuPercent}%</span>
                </div>
                <div class="info-text">${stats.cpuModel}</div>
            </div>

            <div class="stat-group">
                <div class="stat-row">
                    <span class="stat-label">RAM</span>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${stats.ramPercent}%"></div>
                    </div>
                    <span class="stat-value-text">${stats.ramPercent}%</span>
                </div>
                <div class="info-text">OS: ${stats.osInfo}</div>
            </div>

            <div class="hitokoto-box">
                <div class="hitokoto-text">“ ${hitokotoText} ”</div>
            </div>

            <div class="footer">Powered By 狼狼</div>
        </div>
    </div>
</body>
</html>
      `

      // 5. Puppeteer 渲染
      try {
        const page = await ctx.puppeteer.page()
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

        const element = await page.$('.main-card')
        if (!element) {
          await page.close()
          return '渲染错误：未找到卡片元素'
        }

        const buffer = await element.screenshot({ type: 'png' })
        await page.close()
        return h.image(buffer, 'image/png')

      } catch (error) {
        ctx.logger.error(error)
        return '生成失败：' + error.message
      }
    })
}

