import { Context, Schema, h } from 'koishi'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as crypto from 'crypto'
import satori from 'satori'
import { html } from 'satori-html'
import { Resvg } from '@resvg/resvg-js'

// 声明 Context 中存在 puppeteer 服务
declare module 'koishi' {
  interface Context {
    puppeteer: any
  }
}

export const name = 'mk3s-hcrm'
export const inject = ['puppeteer', 'http']

export interface Config {
  renderMode: 'puppeteer' | 'satori'
  backgroundImage?: string
  fontAnurati?: string
  fontChiMing?: string
  fontZcool?: string
  footerText?: string
  footerLayout?: 'combined' | 'split'
  feedbackMessage?: string
  backgroundSource?: string
  weekendQuotes?: string[]
  hitokotoType?: string[]
}

export const Config: Schema<Config> = Schema.object({
  renderMode: Schema.union([
    Schema.const('puppeteer').description('Puppeteer (高质量，资源占用高)'),
    Schema.const('satori').description('Satori (快速，资源占用低)'),
  ]).default('puppeteer').description('渲染引擎'),
  backgroundImage: Schema.string().description('背景图片路径，留空使用默认'),
  backgroundSource: Schema.string().default('').description('背景图片来源/版权信息 (显示在右下角)'),
  fontAnurati: Schema.string().description('Anurati 字体路径，留空使用默认'),
  fontChiMing: Schema.string().description('赤明字体路径，留空使用默认'),
  fontZcool: Schema.string().description('站酷快乐体路径，留空使用默认'),
  footerText: Schema.string().default('© 2025 狼狼').description('底部版权文字'),
  footerLayout: Schema.union([
    Schema.const('combined').description('合并模式 (文字居中显示 Using Engine)'),
    Schema.const('split').description('分离模式 (左下角显示 Engine，文字居中)'),
  ]).default('combined').description('底部布局模式'),
  feedbackMessage: Schema.string().default('successful').description('仅反馈模式下的提示信息'),
  weekendQuotes: Schema.array(String).default([
    '睡到自然醒喵', '公园散散步喵', '煮杯咖啡发呆', '陪陪家人放松', '享受一顿大餐',
    '听首轻松的歌', '晒晒温暖太阳', '读本有趣的书', '做个美梦也好', '约朋友聚一聚',
    '要玩场游戏吗', '来饮茶看书喵', '整理一下心情', '享受独处时光', '陪猫玩玩闹闹', 
    '玩会游戏放松', '陪我聊聊天喵'
  ]).description('周末打趣文案库'),
  hitokotoType: Schema.array(Schema.union([
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
  ])).role('checkbox').default(['a']).description('一言分类'),
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

// 辅助函数：获取资源路径
function getAssetPath(filename: string, customPath?: string): string | null {
  if (customPath && fs.existsSync(customPath)) {
     return customPath
  }

  let assetPath = path.resolve(__dirname, '../assets', filename)
  if (!fs.existsSync(assetPath)) {
     assetPath = path.resolve(__dirname, '../../assets', filename)
  }
  if (!fs.existsSync(assetPath)) {
      assetPath = path.resolve(__dirname, 'assets', filename)
  }

  if (fs.existsSync(assetPath)) {
    return assetPath
  }
  return null
}

// 辅助函数：读取资源并转 Base64
function getAssetBase64(filename: string, customPath?: string): string {
  const p = getAssetPath(filename, customPath)
  if (p) {
    const bitmap = fs.readFileSync(p)
    return Buffer.from(bitmap).toString('base64')
  }
  return ''
}

// 辅助函数：读取资源 Buffer
function getAssetBuffer(filename: string, customPath?: string): Buffer | null {
  const p = getAssetPath(filename, customPath)
  if (p) {
    return fs.readFileSync(p)
  }
  return null
}

export function apply(ctx: Context, config: Config) {
  ctx.command('hcrm', '查看系统状态卡片')
    .option('puppeteer', '-p 使用 Puppeteer 渲染')
    .option('satori', '-s 使用 Satori 渲染')
    .option('keep', '-k 仅反馈信息，不渲染')
    .action(async ({ session, options }) => {
      if (options.keep) {
        return config.feedbackMessage || 'successful'
      }

      // 1. 获取数据
      const stats = await getSystemStats()
      
      let hitokotoText = '生活明朗，万物可爱。'
      try {
        const params = new URLSearchParams()
        params.append('encode', 'json')
        const types = Array.isArray(config.hitokotoType) ? config.hitokotoType : [config.hitokotoType]
        types.forEach(c => params.append('c', c))

        const data = await ctx.http.get('https://v1.hitokoto.cn?' + params.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 5000
        })
        hitokotoText = data.hitokoto || hitokotoText
      } catch (e) {
        ctx.logger.warn('Hitokoto fetch failed: ' + e)
      }

      // 2. 准备时间与文案
      const dateObj = new Date()
      const dateStr = dateObj.toLocaleDateString('zh-CN')
      const timeStr = dateObj.toLocaleTimeString('zh-CN', { hour12: false })
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

      // 3. 渲染
      let useSatori = config.renderMode === 'satori'
      if (options.puppeteer) useSatori = false
      if (options.satori) useSatori = true

      if (useSatori) {
        return await renderSatori(ctx, config, { stats, hitokotoText, dateStr, timeStr, timestamp, lunarDate, dateDesc, renderHash })
      } else {
        return await renderPuppeteer(ctx, config, { stats, hitokotoText, dateStr, timeStr, timestamp, lunarDate, dateDesc, renderHash })
      }
    })
}

async function renderSatori(ctx: Context, config: Config, data: any) {
    const { stats, hitokotoText, dateStr, timeStr, timestamp, lunarDate, dateDesc, renderHash } = data
    
    const bgBuffer = getAssetBuffer('1.jpg', config.backgroundImage)
    const bgBase64 = bgBuffer ? bgBuffer.toString('base64') : ''
    
    const fontAnurati = getAssetBuffer('Anurati-Regular.otf', config.fontAnurati)
    const fontChiMing = getAssetBuffer('赤明工业革命SC-Regular.otf', config.fontChiMing)
    const fontZcool = getAssetBuffer('站酷快乐体.ttf', config.fontZcool)

    if (!fontAnurati || !fontChiMing || !fontZcool) {
        return '字体文件缺失，无法使用 Satori 渲染'
    }

    const footerText = config.footerText || '© 2025 狼狼'
    const footerLayout = config.footerLayout || 'combined'
    
    let footerContent = footerText
    let leftEngine = ''
    
    if (footerLayout === 'combined') {
        footerContent = `${footerText} Using Satori`
        leftEngine = ''
    } else {
        leftEngine = 'Satori'
    }

    // Satori 模板 (内联样式，Flexbox)
    // 放大分辨率：600px 宽 (原 360px)
    const template = html`
    <div style="display: flex; flex-direction: column; width: 600px; position: relative;">
        <!-- Background Image -->
        <img src="data:image/jpeg;base64,${bgBase64}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" />
        
        <!-- Overlay -->
        <div style="display: flex; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.3);"></div>
        
        <!-- Background Source -->
        <div style="position: absolute; bottom: 5px; right: 10px; font-family: 'ChiMing'; font-size: 12px; color: rgba(255,255,255,0.4); max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 10;">${config.backgroundSource || ''}</div>

        <!-- Main Card Content -->
        <div style="display: flex; flex-direction: column; width: 100%; padding: 50px 20px; box-sizing: border-box;">
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%; padding: 30px 20px; background-color: rgba(0,0,0,0.2); border: 5px solid rgba(255,255,255,0.5); position: relative; gap: 30px;">
                
                <!-- Bottom Bar -->
                <div style="display: flex; justify-content: space-between; align-items: center; position: absolute; bottom: 10px; left: 15px; right: 15px;">
                    <div style="display: flex; font-family: 'ChiMing'; font-size: 10px; color: rgba(255,255,255,0.2); letter-spacing: 1px;">${leftEngine}</div>
                    <div style="display: flex; font-family: 'ChiMing'; font-size: 14px; color: rgba(255,255,255,0.2); letter-spacing: 1px;">${renderHash}</div>
                </div>

                <!-- Title -->
                <div style="display: flex; font-family: 'Anurati'; font-size: 72px; color: #fff; margin-bottom: 5px; text-align: center; text-shadow: 0 0 15px rgba(255,255,255,0.6); letter-spacing: 4px;">HCRM</div>

                <!-- Lunar -->
                <div style="display: flex; flex-direction: column; align-items: center; margin-top: -15px; margin-bottom: 10px;">
                    <div style="display: flex; font-family: 'Zcool'; font-size: 20px; color: #ccc; opacity: 0.9; letter-spacing: 2px;">${lunarDate}</div>
                    <div style="display: flex; font-family: 'Zcool'; font-size: 20px; color: #ccc; opacity: 0.9; letter-spacing: 2px;">${dateDesc}</div>
                </div>

                <!-- Time -->
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">
                    <div style="display: flex; font-family: 'Zcool'; font-size: 36px; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.4); margin-bottom: 5px;">${dateStr} ${timeStr}</div>
                    <div style="display: flex; font-family: 'ChiMing'; font-size: 24px; color: rgba(255,255,255,0.8); margin-top: 10px; letter-spacing: 2px;">Timestamp: ${timestamp}</div>
                </div>

                <!-- CPU -->
                <div style="display: flex; flex-direction: column; width: 100%; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                        <div style="display: flex; font-family: 'ChiMing'; font-size: 32px; color: #fff; width: 80px; text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);">CPU</div>
                        <div style="flex: 1; height: 24px; background-color: rgba(255,255,255,0.2); margin-right: 25px; display: flex;">
                            <div style="display: flex; width: ${stats.cpuPercent}%; height: 100%; background-color: #fff;"></div>
                        </div>
                        <div style="display: flex; justify-content: flex-end; font-family: 'ChiMing'; font-size: 32px; color: #fff; width: 90px; text-align: right;">${stats.cpuPercent}%</div>
                    </div>
                    <div style="display: flex; font-family: 'ChiMing'; font-size: 20px; color: rgba(255,255,255,0.7); padding-left: 80px;">${stats.cpuModel}</div>
                </div>

                <!-- RAM -->
                <div style="display: flex; flex-direction: column; width: 100%; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                        <div style="display: flex; font-family: 'ChiMing'; font-size: 32px; color: #fff; width: 80px; text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);">RAM</div>
                        <div style="flex: 1; height: 24px; background-color: rgba(255,255,255,0.2); margin-right: 25px; display: flex;">
                            <div style="display: flex; width: ${stats.ramPercent}%; height: 100%; background-color: #fff;"></div>
                        </div>
                        <div style="display: flex; justify-content: flex-end; font-family: 'ChiMing'; font-size: 32px; color: #fff; width: 90px; text-align: right;">${stats.ramPercent}%</div>
                    </div>
                    <div style="display: flex; font-family: 'ChiMing'; font-size: 20px; color: rgba(255,255,255,0.7); padding-left: 80px;">OS: ${stats.osInfo}</div>
                </div>

                <!-- Hitokoto -->
                <div style="display: flex; justify-content: center; width: 100%; margin-top: 30px; margin-bottom: 10px; padding: 0 10px;">
                    <div style="display: flex; font-family: 'Zcool'; font-size: 24px; color: #fff; text-align: center; font-style: italic; text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);">“ ${hitokotoText} ”</div>
                </div>

                <!-- Footer -->
                <div style="display: flex; justify-content: center; font-family: 'ChiMing'; font-size: 20px; color: #ccc; margin-top: 10px; text-align: center; opacity: 0.9; letter-spacing: 2px;">${footerContent}</div>

            </div>
        </div>
    </div>
    `

    try {
        const svg = await satori(template as any, {
            width: 600,
            fonts: [
                { name: 'Anurati', data: fontAnurati, weight: 400, style: 'normal' },
                { name: 'ChiMing', data: fontChiMing, weight: 400, style: 'normal' },
                { name: 'Zcool', data: fontZcool, weight: 400, style: 'normal' },
            ],
        })

        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: 1200 }, // 2倍图 (1200px)
        })
        const pngData = resvg.render()
        const pngBuffer = pngData.asPng()

        return h.image(pngBuffer, 'image/png')
    } catch (error) {
        ctx.logger.error(error)
        return 'Satori 生成失败：' + error.message
    }
}

async function renderPuppeteer(ctx: Context, config: Config, data: any) {
    const { stats, hitokotoText, dateStr, timeStr, timestamp, lunarDate, dateDesc, renderHash } = data

    const bgBase64 = getAssetBase64('1.jpg', config.backgroundImage)
    const fontAnurati = getAssetBase64('Anurati-Regular.otf', config.fontAnurati)
    const fontChiMing = getAssetBase64('赤明工业革命SC-Regular.otf', config.fontChiMing)
    const fontZcool = getAssetBase64('站酷快乐体.ttf', config.fontZcool)

    const footerText = config.footerText || '© 2025 狼狼'
    const footerLayout = config.footerLayout || 'combined'
    
    let footerContent = footerText
    let leftEngine = ''
    
    if (footerLayout === 'combined') {
        footerContent = `${footerText} Using Puppeteer`
        leftEngine = ''
    } else {
        leftEngine = 'Puppeteer'
    }

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
            width: 600px; 
            padding: 50px 20px; 
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
            padding: 30px 20px;
            border-radius: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 30px;
            border: 5px solid rgba(255, 255, 255, 0.5);
        }

        .title {
            font-family: 'Anurati', sans-serif;
            font-size: 72px;
            letter-spacing: 4px;
            color: #fff;
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.6); 
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
            font-size: 20px;
            color: #ccc;
            opacity: 0.9;
            letter-spacing: 2px;
        }

        .time-block {
            text-align: center;
            margin-bottom: 10px;
        }
        .datetime-str {
            font-family: 'Zcool', sans-serif;
            font-size: 36px;
            color: #fff;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
            margin-bottom: 5px;
        }
        .timestamp {
            font-family: 'ChiMing', sans-serif;
            font-size: 24px;
            color: rgba(255, 255, 255, 0.8);
            margin-top: 10px;
            letter-spacing: 2px;
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
            font-size: 32px;
            color: #fff;
            width: 80px;
            text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
        }

        .stat-value-text {
            font-family: 'ChiMing', sans-serif;
            font-size: 32px;
            color: #fff;
            margin-left: 25px;
            min-width: 90px;
            text-align: right;
        }

        .progress-container {
            flex: 1;
            height: 24px;
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
            font-size: 20px;
            color: rgba(255, 255, 255, 0.7);
            text-align: left;
            width: 100%;
            padding-left: 80px;
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
            font-size: 24px;
            color: #fff;
            line-height: 1.5;
            text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
            font-style: italic;
        }

        .footer {
            font-family: 'ChiMing', sans-serif;
            font-size: 20px;
            color: #ccc;
            margin-top: 10px;
            text-align: center;
            opacity: 0.9;
            letter-spacing: 2px;
        }

        .bottom-bar {
            position: absolute;
            bottom: 10px;
            left: 15px;
            right: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .engine-text {
            font-family: 'ChiMing', sans-serif;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.2);
            letter-spacing: 1px;
        }

        .hash-text {
            font-family: 'ChiMing', sans-serif;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.2);
            letter-spacing: 1px;
        }

        .bg-source {
            position: absolute;
            bottom: 5px;
            right: 10px;
            font-family: 'ChiMing', sans-serif;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
            z-index: 5;
            max-width: 40%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-shadow: 0 0 2px rgba(0,0,0,0.5);
        }
    </style>
</head>
<body>
    <div class="main-card">
        <div class="bg-source">${config.backgroundSource || ''}</div>
        <div class="glass-panel">
            <div class="bottom-bar">
                <span class="engine-text">${leftEngine}</span>
                <span class="hash-text">${renderHash}</span>
            </div>
            <h1 class="title">HCRM</h1>
            
            <div class="lunar-box">
                <div class="lunar-text">${lunarDate}</div>
                <div class="lunar-text">${dateDesc}</div>
            </div>

            <div class="time-block">
                <div class="datetime-str">${dateStr} ${timeStr}</div>
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

            <div class="footer">${footerContent}</div>
        </div>
    </div>
</body>
</html>
    `

    try {
        const page = await ctx.puppeteer.page()
        page.setDefaultNavigationTimeout(60000)
        await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 })
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' })

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
        return 'Puppeteer 生成失败：' + error.message
    }
}

