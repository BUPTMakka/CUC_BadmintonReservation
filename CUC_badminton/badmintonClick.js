const fs = require('fs');
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const settings = require('./settings.json');

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

// URL
const targetUrl = "https://workflow.cuc.edu.cn/reservation/fe/site/reservationInfo?id=1293";

// 预约时间对应 element 顺序
const timeList = {
  "15:00-16:00": 0,
  "16:00-17:00": 1,
  "17:00-18:00": 2,
  "18:00-19:00": 3,
  "19:00-20:00": 4,
  "20:00-21:00": 5
};

const key = settings.time;
// 读取cookie路径
const COOKIES_PATH = settings.COOKIES_PATH;
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

  const isSuccess = await page.evaluate((key, timeList) => {
    // 获取场地列表
    const siteList = document.querySelectorAll('.left_venues dd');
    // 获取时间段表项(没有动态加载可以不等切换场地后再更新)
    const timeDivs = document.querySelectorAll('.item_content_box');
    // 倒序遍历场地
    for (let i = 9; i >= 0; i--) {
      siteList[i].click();
      console.log("羽毛球", i + 1, "已选择！");
      // 选择结束
      if (!key.length) break;
      if (key.length === 1) {
        const temp = timeDivs[timeList[key[0]]];
        if (temp.classList.contains('green')) {
          temp.click();
          key.shift();
          console.log("选择时间段成功！");
        } else {
          console.log("当前场地此时间段不可选");
        }
      } else {
        // 并行选择
        const temp1 = timeDivs[timeList[key[0]]];
        const temp2 = timeDivs[timeList[key[1]]];
        if (temp1.classList.contains('green')) {
          temp1.click();
          key.shift();
          console.log("选择时间段1成功！");
        } else {
          console.log("当前场地此时间段1不可选");
        }
        if(temp2.classList.contains('green')) {
          temp1.click();
          key.slice(0, -1);
          console.log("选择时间段2成功！");
        } else {
          console.log("当前场地此时间段2不可选");
        }
      }
    }
    return (key.length == 0 ? 1 : 0);
  }, key, timeList);
  // 判断是否成功选择
  if (isSuccess) {
    await button.click();
    console.log("预约已提交！");
  } else {
    console.log("无可预约时段！预约失败！");
  }

  // 关闭浏览器
  // await browser.close();
}

cron.schedule('0 8 * * *', () => {
  console.log('定时任务启动，开始执行预约...');
  main().catch(err => {
    console.error('执行过程中出错:', err);
  });
});