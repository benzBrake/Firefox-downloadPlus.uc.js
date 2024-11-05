# downloadPlus.uc.js

Firefox 下载增强工具，依赖 userChrome.js Loader

目前最新版为`downloadPlus_ff98.uc.js`

### 功能(Description)

- 默认选择下载文件
- 改名后保存
- 保存并打开
- 另存为
- 下载提示音
- 来源显示完整目录并支持双击复制完整地址
- 第三方工具下载（依赖 FlashGot）

### 说明(Usage)

`flashgot.exe`默认存放路径为

> ProfileDir\chrome\UserTools\FlashGot.exe

高级首选项（about:config）

> userChromeJS.DownloadPlus.enableRemoveFromDiskMenuitem 启用从硬盘删除右键菜单
>
> userChromeJS.downloadPlus.enableFlashgotIntergention 启用 Flashgot 集成
>
> userChromeJS.downloadPlus.flashgotPath Flashgot 可执行文件路径
>
> userChromeJS.downloadPlus.flashgotManagers 下载器列表缓存（一般不需要修改)
>
> userChromeJS.downloadPlus.flashgotDefaultManager 默认第三方下载器（一般不需要修改）
>
> userChromeJS.downloadPlus.enableRename 下载对话框启用改名功能
>
> userChromeJS.downloadPlus.enableDoubleClickToCopyLink 下载对话框双击复制链接
>
> userChromeJS.downloadPlus.enableSaveAndOpen 下载对话框启用保存并打开
>
> userChromeJS.downloadPlus.enableSaveAs 下载对话框启用另存为
>
> userChromeJS.downloadPlus.enableSaveTo 下载对话框启用保存到
>
> userChromeJS.downloadPlus.enableDownloadNotice 启用下载通知音
>
> userChromeJS.downloadPlus.notice.DL_START 下载开始通知音路径
>
> userChromeJS.downloadPlus.notice.DL_DONE 下载成功通知音路径
>
> userChromeJS.downloadPlus.notice.DL_CANCEL 下载取消通知音
>
> userChromeJS.downloadPlus.notice.DL_FAILED 下载失败通知音路径

FlashGot.exe 支持调用哪些下载工具详见：[pouriap/Firefox-DownloadGrab: A Firefox addon that lets you download links with external download manager](https://github.com/pouriap/Firefox-DownloadGrab)

### 下载规则(Download Rules)

```javascript
const DOWNLOAD_RULES = [
    {
        "url": "匹配地址，支持 * 和 ? 或者以 ^ 开头的正则表达式",
        "operate": "操作类型 目前仅支持 save / save-as / flashgot",
        "size": "文件大小条件",
        "saveTo": "保存到的路径仅 save 操作有用",
        “manager": "下载工具名称，进 flashgot 操作有用"
    }
];
```

#### 文件大小条件

格式：大小关键字 比较符号 大小

大小关键字支持 mb, kb, gb 比较符号支持`<`, `>`,`=`,` >=`,`<=`, `!=`，大小是数字

下面是几个示例

> mb > 100
>
> gb = 1
>
> kb < 100

### 如何下载 FlashGot.exe

https://github.com/benzBrake/Firefox-downloadPlus.uc.js/releases/download/v2023.05.11/FlashGot.exe

### 其他脚本

- `FlashGot.uc.js`,仅仅集成了 FlashGot 下载功能的脚本
- `downloadSoundPlay_Fx26.uc.js`，下载完成通知脚本

### 本地化(Localization)

修改脚本，大概 37 行开始

```
const LANG = {
```

### 截图(Sceenshot)

![downloadPlus](downloadPlus_ff98.png)

### 计划

[x] 制作独立版 FlashGot 脚本

[ ] 从`downloadPlus_ff98.uc.js`中删除 FlashGot 相关功能

[ ] 从`downloadPlus_ff98.uc.js`中删除下载完成通知

[ ] 永久删除文件功能独立成一个脚本

### 题外话(Off topic)

为什么文件名是`downloadPlus_ff98.uc.js`为什么叫这个名字？那是因为我从 Firefox 98 开始接手这个脚本的。

文件名没有要求，你想改成什么都可以。

### 感谢(Thanks)

[pouriap/Firefox-DownloadGrab: A Firefox addon that lets you download links with external download manager](https://github.com/pouriap/Firefox-DownloadGrab)
