# 记账（个人 PWA）

只给自己用的记账 App，装在 iPhone 主屏幕上。所有资料只存在手机里，不上传，没网也能用。
搭建框架见 [BUILD_YOUR_OWN.md](BUILD_YOUR_OWN.md)。

## 常用指令

不需要 `npm install`，只要有 Node 20 以上。

| 指令 | 做什么 |
|---|---|
| `npm test` | 跑全部测试（包括版本号和安全检查） |
| `npm run check` | 只跑安全检查 |
| `npm run serve` | 在电脑上预览：http://localhost:8080 |
| `npm run phone` | 让同一个 Wi‑Fi 的手机也能打开（会印出网址） |
| `npm run icons` | 重新产生 App 图标 |

## 在手机上先看看（开发中）

1. 手机和电脑连同一个 Wi‑Fi。
2. 电脑执行 `npm run phone`，Windows 问要不要允许网络存取时选「私人网络」。
3. iPhone 用 Safari 打开它印出来的 `http://192.168.x.x:8080`。

这样只能看画面、试记账。离线和「添加到主屏幕」要等放上 GitHub Pages（HTTPS）才完整。
在这个网址记的测试资料，之后不会跟着搬到正式网址。

## 发布新版本

1. 把 `sw.js` 的 `VERSION` 和 `src/version.js` 的 `APP_VERSION` 改成同一个新号码。
2. 新增或删除了文件的话，更新 `sw.js` 的 `ASSETS`。
3. `npm test` 全部通过再上传。手机打开 App 会出现「有新版本 · 更新」。

## 进度

- [x] 阶段 1：记一笔、今天的记录（左滑删除、点一下修改、撤销）、类别、IndexedDB、PWA、离线
- [x] 阶段 2：每月计划、收入周期、今天还能花、固定项目、记录页
- [ ] 阶段 3：备份 / 还原、密码锁
- [ ] 阶段 4：分析页
- [ ] 阶段 5：对账、预计结余、比较
- [ ] 阶段 6：动画、ⓘ 说明、投资页
