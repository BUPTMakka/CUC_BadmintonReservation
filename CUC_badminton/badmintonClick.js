const fs = require('fs');
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const settings = require('./settings.json');

// URL
const targetUrl = "https://workflow.cuc.edu.cn/reservation/fe/site/reservationInfo?id=1293";
// 读取cookie路径
const COOKIES_PATH = settings.COOKIES_PATH;

// 保存cookies到文件
async function saveCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies));
}

// 从文件加载cookies
async function loadCookies(page) {
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
    await page.setCookie(...cookies);
  }
}

async function main() {
  // 启动浏览器
  const browser = await puppeteer.launch({ headless: false, devtools: true }); // headless: false 表示显示浏览器界面
  const page = await browser.newPage();

  // 先尝试加载已有cookies
  await loadCookies(page);

  // 打开目标页面
  await page.goto(targetUrl, { waitUntil: 'networkidle2' });
  console.log("跳转成功");

  // 检查是否跳转到登录页面
  const isLoginPage = await page.evaluate(() => {
    return document.querySelector('input[name="username"]') !== null; // 检查是否有用户名输入框
  });

  if (isLoginPage) {
    console.log('检测到登录页面，正在自动登录...');

    // 填写用户名和密码
    await page.type('input[id="username"]', settings.username);
    await page.type('input[id="password"]', settings.password);

    // 点击登录按钮
    await page.click('a[id="login_submit"]');

    // 登录成功后保存cookies
    await saveCookies(page);
    console.log('登录成功并保存cookies');

    // 等待登录完成并跳转回目标页面
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('登录成功！');
  } else {
    console.log('无需登录，直接进入目标页面。');
  }

  /*------------执行预约模拟操作------------*/
  const close = await page.$('.n-card-header__close');
  await close.click();
  // 点击“后一天”按钮
  await page.evaluate(() => {
    document.querySelectorAll('span.change_date')[1].click();
  });

  // 切换到资源视图
  await page.evaluate(() => {
    document.querySelectorAll('.venues_replace span')[1].click();
  });

  // 等待按钮点击完成后动态加载的DOM渲染完成
  await page.waitForSelector('.left_venues');

  // 获取确认按钮
  const button = await page.$('.confirm_bt');

  let key = settings.time;
  
  // 创建0-9的数组并随机打乱，用于随机遍历球场
  const courtOrder = Array.from({length: 10}, (_, i) => i);
  // Fisher-Yates洗牌算法
  for (let i = courtOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [courtOrder[i], courtOrder[j]] = [courtOrder[j], courtOrder[i]];
  }
  for (let i = 0; i < courtOrder.length; i++) {
    // 选择结束
    if (key.length == 0) break;
    await page.evaluate((i) => {
      // 切换场地
      document.querySelectorAll('.left_venues dd')[i].click();
      console.log("羽毛球", i + 1, "已选择！");
    }, courtOrder[i]);
    // 等待有更新的可选元素
    try {
      await page.waitForSelector('.can_active', { timeout: 200 });
    } catch (error) {
      if (error.name === 'TimeoutError') {
        console.warn('超时未找到 .can_active，继续执行');
      } else {
        throw error; // 其他错误正常抛出
      }
    }
    // 获取更新后元素
    key = await page.evaluate((key) => {
      const clickTimeDivs = document.querySelectorAll('.item_content_box.green.can_active');
      if(!clickTimeDivs) return key;
      if(key.length === 1) {
        clickTimeDivs.forEach((node) => {
          // 获取可选时段div对应时间
          const timeTemp = node.querySelector('.reservation_name').textContent
          if(timeTemp == key[0]) {
            node.click();
            key.shift();
            console.log("选择时间段成功！");
          }
        })
      } else if (key.length == 2) {
        clickTimeDivs.forEach((node) => {
          const timeTemp = node.querySelector('.reservation_name').textContent
          switch (timeTemp){
            case key[0]:
              node.click();
              key.shift();
              console.log("选择时间段1成功！");
              break;
            case key[1]:
              node.click();
              key.slice(0, -1);
              console.log("选择时间段2成功！");
              break;
          }
        })
      }
      return key;
    }, key);
  }

  await button.click();
  console.log("预约已提交！");

  // 关闭浏览器
  // await browser.close();
}

cron.schedule('0 8 * * *', () => {
  console.log('定时任务启动，开始执行预约...');
  main().catch(err => {
    console.error('执行过程中出错:', err);
  });
});

// main();