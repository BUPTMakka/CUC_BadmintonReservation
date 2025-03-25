# 羽毛球场预约脚本
用js写的前端脚本，主要逻辑是通过触发click事件完成预约流程。仅用于[中传羽毛球预约网站](https://workflow.cuc.edu.cn/reservation/fe/site/reservationInfo?id=1293)。
## 使用流程
__步骤一__：确保已下载nodejs（版本不低于v22.14.0）。
```
官网地址：https://nodejs.org/en/download/
nodejs安装教程：https://www.runoob.com/nodejs/nodejs-install-setup.html
```
__步骤二__：npm安装package.json中的所有模块（nodejs默认配置npm，不需要单独安装）。
```
npm  install
```
__步骤三__：依赖安装完成后，按需修改settings.json中变量值。
```json
{
  "time": ["15:00-16:00"], // 想预约的时间段，数目最多2个
  "username": "12345",// 自己的中传统一身份认证页账号
  "password": "54321",// 自己的中传统一身份认证页密码
  "COOKIES_PATH": "./cookies.json"// 别改
}
```
__步骤四:__ 执行badmintonClick.js文件。代码中已经设定每天早上8点开始执行操作，所以可以在预约前一晚打开代码运行，**记得一次预约结束后退出程序执行**，不主动结束程序会一直执行。
```
node .\badmintonClick_puppeteer.js
```

__补充:__ 初次执行该文件，会保存登录cookie，就可以在有效期内跳过登录页跳转步骤，加快预约进程。所以建议每次预约预先执行一次程序，然后结束，确保cookie在早上8点开始预约时可用。