// ==UserScript==
// @name            DownloadPlus_Fx135.uc.js
// @description     修改整合自（w13998686967、ywzhaiqi、黒仪大螃蟹、Alice0775、紫云飞），已重写代码。
// @author          Ryan
// @note 相关 about:config 选项 修改后请重启浏览器，不支持热重载
// @note userChromeJS.downloadPlus.enableFlashgotIntergention 启用 Flashgot 集成
// @note userChromeJS.downloadPlus.flashgotPath Flashgot可执行文件路径
// @note userChromeJS.downloadPlus.flashgotDownloadManagers 下载器列表缓存（一般不需要修改)
// @note userChromeJS.downloadPlus.flashgotDefaultManager 默认第三方下载器（一般不需要修改）
// @note userChromeJS.downloadPlus.enableRename 下载对话框启用改名功能
// @note userChromeJS.downloadPlus.enableEncodeConvert 启用编码转换，如果userChromeJS.downloadPlus.enableRename没开启，这个选项无效
// @note userChromeJS.downloadPlus.enableDoubleClickToCopyLink 下载对话框双击复制链接
// @note userChromeJS.downloadPlus.enableDoubleClickToOpen 双击打开
// @note userChromeJS.downloadPlus.enableDoubleClickToSave 双击保存
// @note userChromeJS.downloadPlus.enableSaveAndOpen 下载对话框启用保存并打开
// @note userChromeJS.downloadPlus.enableSaveAs 下载对话框启用另存为
// @note userChromeJS.downloadPlus.enableSaveTo 下载对话框启用保存到
// @note userChromeJS.downloadPlus.showAllDrives 下载对话框显示所有驱动器
// @note            20250226 正式进入无 JSM 时代，暂时未实现 FlashGot 集成，请使用独立版 FlashGot.uc.js，永久删除文件功能也并未集成，请使用 removeFileFromDownloadManager.uc.js，下载规则暂时也不支持
// @async           true
// @include         main
// @include         chrome://browser/content/places/places.xhtml
// @include         chrome://mozapps/content/downloads/unknownContentType.xhtml
// @include         chrome://browser/content/downloads/contentAreaDownloadsView.xhtml
// @include         chrome://browser/content/downloads/contentAreaDownloadsView.xhtml?SM
// @include         about:downloads
// @version         1.0.1
// @compatibility   Firefox 136
// @homepageURL     https://github.com/benzBrake/FirefoxCustomize
// ==/UserScript==
(async function (gloalCSS, placesCSS, unknownContentCSS) {
    if (window.DownloadPlus) return;
    let { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;
    const Services = globalThis.Services;
    const Downloads = globalThis.Downloads || ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs").Downloads;
    const ctypes = globalThis.ctypes || ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs").ctypes;

    const LANG = {
        'zh-CN': {
            "remove from disk": "从硬盘删除",
            "operation not support": "操作不支持",
            "file not found": "文件未找到 %s",
            "directory not exists": "目录不存在 %s",
            "use flashgot to download": "FlashGot",
            "dowload this link by flashGot": "FlashGot 下载此链接",
            "download all links by flashgot": "FlashGot 下载所有链接",
            "about download plus": "关于 downloadPlus",
            "original name": "默认编码: ",
            "encoding convert tooltip": "点击转换编码",
            "complete link": "链接：",
            "copy link": "复制链接",
            "copied": "复制完成",
            "dobule click to copy link": "双击复制链接",
            "successly copied": "复制成功",
            "default download manager": "（默认）",
            "download by default download manager": "FlashGot 默认",
            "no download managers": "没有下载工具",
            "force reload download managers list": "重新读取下载工具列表",
            "reloading download managers list": "正在重新读取下载工具列表，请稍后！",
            "reload download managers list finish": "读取下载工具列表完成，请选择你喜欢的下载器",
            "set to default download manger": "设置 %s 为默认下载器",
            "save and open": "保存并打开",
            "save as": "另存为",
            "quick save to": "快速保存到：",
            "desktop": "桌面",
            "disk %s": "%s 盘",
        },
        format (...args) {
            if (!args.length) {
                throw new Error("format: no arguments");
            }

            const formatString = this.LANGUAGE[args[0]] || args[0];
            const values = args.slice(1);
            let valueIndex = 0;
            let result = "";

            if (typeof formatString !== 'string') {
                throw new Error("format: first argument must be a string");
            }

            if (!values.length) {
                return formatString.charAt(0).toUpperCase() + formatString.slice(1);
            }

            for (let i = 0; i < formatString.length; i++) {
                if (formatString[i] === '%') {
                    i++; // Move to the next character (the format specifier)

                    if (i >= formatString.length) {
                        // Incomplete format specifier at the end, treat as literal '%'
                        result += '%';
                        break;
                    }

                    switch (formatString[i]) {
                        case 's': // String
                            if (valueIndex < values.length) {
                                result += String(values[valueIndex]);
                                valueIndex++;
                            } else {
                                result += '%s'; // Not enough arguments
                            }
                            break;
                        case 'n': // Number
                            if (valueIndex < values.length) {
                                const num = Number(values[valueIndex]);
                                if (isNaN(num)) {
                                    result += 'NaN';
                                } else {
                                    result += num.toString();
                                }
                                valueIndex++;
                            } else {
                                result += '%n'; // Not enough arguments
                            }
                            break;

                        case '%': // Literal '%'
                            result += '%';
                            break;
                        default:
                            // Unknown format specifier - treat as literal characters
                            result += '%' + formatString[i];
                    }
                } else {
                    result += formatString[i];
                }
            }

            while (valueIndex < values.length) {
                result += " " + String(values[valueIndex]);
                valueIndex++;
            }

            return result;
        },
        init () {
            const _LOCALE = LANG.hasOwnProperty(Services.locale.appLocaleAsBCP47) ? Services.locale.appLocaleAsBCP47 : 'zh-CN';
            if (_LOCALE in this) {
                this.LANGUAGE = this[_LOCALE];
            } else {
                this.LANGUAGE = this['zh-CN'];
            }
        }
    }

    LANG.init();

    window.DownloadPlus = {
        SAVE_DIRS: [[Services.dirsvc.get('Desk', Ci.nsIFile).path, LANG.format("desktop")]],
        init: async function () {
            const documentURI = location.href.replace(/\?.*$/, '');
            switch (documentURI) {
                case 'chrome://browser/content/browser.xhtml':
                    windowUtils.loadSheetUsingURIString("data:text/css;charset=utf-8," + encodeURIComponent(gloalCSS), windowUtils.USER_SHEET);
                    await this.initChrome();
                    break;
                case 'about:downloads':
                case 'chrome://browser/content/places/places.xhtml':
                    windowUtils.loadSheetUsingURIString("data:text/css;charset=utf-8," + encodeURIComponent(placesCSS), windowUtils.AUTHOR_SHEET);
                    break;
                case 'chrome://mozapps/content/downloads/unknownContentType.xhtml':
                    windowUtils.loadSheetUsingURIString("data:text/css;charset=utf-8," + encodeURIComponent(unknownContentCSS), windowUtils.AUTHOR_SHEET);
                    await this.initDownloadPopup();
                    break;
            }
        },
        initChrome: async function () {
            // 保存按钮无需等待即可点击
            Services.prefs.setIntPref('security.dialog_enable_delay', 0);
            if (isTrue('userChromeJS.downloadPlus.enableRename')) {
                const obsService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
                const RESPONSE_TOPIC = 'http-on-examine-response';

                this.changeNameObserver = {
                    observing: false,
                    observe: function (subject, topic, data) {
                        try {
                            let channel = subject.QueryInterface(Ci.nsIHttpChannel);
                            let header = channel.contentDispositionHeader;
                            let associatedWindow = channel.notificationCallbacks
                                .getInterface(Ci.nsILoadContext)
                                .associatedWindow;
                            associatedWindow.localStorage.setItem(channel.URI.spec, header.split("=")[1]);
                        } catch (e) { };
                    },
                    start: function () {
                        if (!this.observing) {
                            obsService.addObserver(this, RESPONSE_TOPIC, false);
                            this.observing = true;
                        }
                    },
                    stop: function () {
                        if (this.observing) {
                            obsService.removeObserver(this, RESPONSE_TOPIC, false);
                            this.observing = false;
                        }
                    }
                };

                this.changeNameObserver.start();
                window.addEventListener("beforeunload", () => {
                    window.DownloadPlus.changeNameObserver.stop();
                });
            }
            if (isTrue('userChromeJS.downloadPlus.enableSaveAndOpen')) {
                this.URLS_FOR_OPEN = [];
                const saveAndOpenView = {
                    onDownloadChanged: function (dl) {
                        if (dl.progress != 100) return;
                        if (window.DownloadPlus.URLS_FOR_OPEN.indexOf(dl.source.url) > -1) {
                            let target = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                            target.initWithPath(dl.target.path);
                            target.launch();
                            window.DownloadPlus.URLS_FOR_OPEN[window.DownloadPlus.URLS_FOR_OPEN.indexOf(dl.source.url)] = "";
                        }
                    },
                    onDownloadAdded: function (dl) { },
                    onDownloadRemoved: function (dl) { },
                }
                Downloads.getList(Downloads.ALL).then(list => { list.addView(saveAndOpenView).then(null, Cu.reportError); });
                window.addEventListener("beforeunload", () => {
                    Downloads.getList(Downloads.ALL).then(list => { list.removeView(saveAndOpenView).then(null, Cu.reportError); });
                });
            }
            if (isTrue('userChromeJS.downloadPlus.showAllDrives ')) {
                getAllDrives().forEach(drive => {
                    this.SAVE_DIRS.push([drive, LANG.format("disk %s", drive.replace(':\\', ""))])
                });
            }
        },
        initDownloadPopup: async function () {
            const dialogFrame = dialog.dialogElement('unknownContentType');
            // 原有按钮增加 accesskey
            dialogFrame.getButton('accept').setAttribute('accesskey', 'c');
            dialogFrame.getButton('cancel').setAttribute('accesskey', 'x');
            if (isTrue('userChromeJS.downloadPlus.enableRename')) {
                let locationHbox = createEl(document, 'hbox', {
                    id: 'locationHbox',
                    flex: 1,
                    align: 'center',
                });
                let location = $('#location');
                location.hidden = true;
                location.after(locationHbox);
                let locationText = locationHbox.appendChild(createEl(document, "html:input", {
                    id: "locationText",
                    value: dialog.mLauncher.suggestedFileName,
                    flex: 1
                }));
                if (isTrue('userChromeJS.downloadPlus.enableEncodeConvert')) {
                    let encodingConvertButton = locationHbox.appendChild(createEl(document, 'button', {
                        id: 'encodingConvertButton',
                        type: 'menu',
                        tooltiptext: LANG.format("encoding convert tooltip")
                    }));
                    let converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                        .getService(Ci.nsIScriptableUnicodeConverter);
                    let menupopup = createEl(document, 'menupopup', {}), orginalString;
                    menupopup.appendChild(createEl(document, 'menuitem', {
                        value: dialog.mLauncher.suggestedFileName,
                        label: LANG.format("original name") + dialog.mLauncher.suggestedFileName,
                        selected: true,
                        default: true,
                    }));
                    try {
                        orginalString = (opener.localStorage.getItem(dialog.mLauncher.source.spec) ||
                            dialog.mLauncher.source.asciiSpec.substring(dialog.mLauncher.source.asciiSpec.lastIndexOf("/"))).replace(/[\/:*?"<>|]/g, "");
                        opener.localStorage.removeItem(dialog.mLauncher.source.spec)
                    } catch (e) {
                        orginalString = dialog.mLauncher.suggestedFileName;
                    }
                    function createMenuitem (encoding) {
                        converter.charset = encoding;
                        let menuitem = menupopup.appendChild(document.createXULElement("menuitem"));
                        menuitem.value = converter.ConvertToUnicode(orginalString).replace(/^"(.+)"$/, "$1");
                        menuitem.label = encoding + ": " + menuitem.value;
                    }
                    ["GB18030", "BIG5", "Shift-JIS"].forEach(function (item) {
                        createMenuitem(item)
                    });
                    menupopup.addEventListener('click', (event) => {
                        let { target } = event;
                        if (target.localName === "menuitem") {
                            locationText.value = target.value;
                        }
                    });
                    encodingConvertButton.appendChild(menupopup);
                }
            }
            // 复制链接
            if (isTrue('userChromeJS.downloadPlus.enableDoubleClickToCopyLink')) {
                let h = createEl(document, 'hbox', { align: 'center' });
                $("#source").parentNode.after(h);
                let label = h.appendChild(createEl(document, 'label', {
                    innerHTML: LANG.format("complete link"),
                    style: 'margin-top: 1px'
                }));
                let description = h.appendChild(createEl(document, 'description', {
                    id: 'completeLinkDescription',
                    class: 'plain',
                    flex: 1,
                    crop: 'center',
                    value: dialog.mLauncher.source.spec,
                    tooltiptext: LANG.format("dobule click to copy link"),
                }));
                h.appendChild(createEl(document, 'button', {
                    id: 'copy-link-btn',
                    label: LANG.format("copy link"),
                    onclick: function () {
                        copyText(dialog.mLauncher.source.spec);
                        this.setAttribute("label", LANG.format("copied"));
                        this.parentNode.classList.add("copied");
                        setTimeout(function () {
                            this.setAttribute("label", LANG.format("copy link"));
                            this.parentNode.classList.remove("copied");
                        }.bind(this), 1000);
                    }
                }));
                [label, description].forEach(el => el.addEventListener("dblclick", () => {
                    copyText(dialog.mLauncher.source.spec);
                }))
            }
            // 双击保存
            if (isTrue('userChromeJS.downloadPlus.enableDoubleClickToSave')) {
                $('#save').addEventListener('dblclick', (event) => {
                    const { dialog } = event.target.ownerGlobal;
                    dialog.dialogElement('unknownContentType').getButton("accept").click();
                });
            }
            // 保存并打开
            if (isTrue('userChromeJS.downloadPlus.enableSaveAndOpen')) {
                let saveAndOpen = createEl(document, 'button', {
                    id: 'save-and-open',
                    label: LANG.format("save and open"),
                    accesskey: 'P',
                    part: 'dialog-button'
                });
                saveAndOpen.addEventListener('click', () => {
                    Services.wm.getMostRecentWindow("navigator:browser").DownloadPlus.URLS_FOR_OPEN.push(dialog.mLauncher.source.asciiSpec);
                    dialog.dialogElement('save').click();
                    dialogFrame.getButton("accept").disabled = 0;
                    dialogFrame.getButton("accept").click();
                });
                dialogFrame.getButton('extra2').before(saveAndOpen);
            }
            // 另存为
            if (isTrue('userChromeJS.downloadPlus.enableSaveAs')) {
                let saveAs = createEl(document, 'button', {
                    id: 'save-as',
                    label: "另存为",
                    accesskey: 'E',
                    oncommand: function () {
                        const mainwin = Services.wm.getMostRecentWindow("navigator:browser");
                        // 感谢 ycls006
                        mainwin.eval("(" + mainwin.internalSave.toString().replace("let ", "").replace("var fpParams", "fileInfo.fileExt=null;fileInfo.fileName=aDefaultFileName;var fpParams") + ")")(dialog.mLauncher.source.asciiSpec, null, null, (document.querySelector("#locationText") ? document.querySelector("#locationText").value : dialog.mLauncher.suggestedFileName), null, null, false, null, null, null, null, null, false, null, mainwin.PrivateBrowsingUtils.isBrowserPrivate(mainwin.gBrowser.selectedBrowser), Services.scriptSecurityManager.getSystemPrincipal());
                        close();
                    }
                });
                dialogFrame.getButton('extra2').before(saveAs);
            }
            // 快速保存
            if (isTrue('userChromeJS.downloadPlus.enableSaveTo')) {
                let quickSave = createEl(document, 'vbox', {
                    id: 'quickSaveBox',
                    flex: 1
                });
                quickSave.appendChild(createEl(document, 'label', {
                    class: 'header',
                    value: LANG.format("quick save to"),
                    flex: 1,
                    control: 'quickSave'
                }));
                let hbox = quickSave.appendChild(createEl(document, 'hbox', {
                    id: 'quickSave',
                    flex: 1,
                    pack: 'end'
                }));
                quickSave.appendChild(createEl(document, 'separator', {
                    class: 'thin'
                }))
                Services.wm.getMostRecentWindow("navigator:browser").DownloadPlus.SAVE_DIRS.forEach(item => {
                    let [name, dir] = [item[1], item[0]];
                    hbox.appendChild(createEl(document, "button", {
                        label: name || (dir.match(/[^\\/]+$/) || [dir])[0],
                        dir: dir,
                        image: "moz-icon:file:///" + dir + "\\",
                        onclick: function () {
                            let dir = this.getAttribute('dir');
                            let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                            let path = dir.replace(/^\./, Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile).path);
                            path = path.endsWith("\\") ? path : path + "\\";
                            file.initWithPath(path + (document.querySelector("#locationText") ? document.querySelector("#locationText").value : document.querySelector("#location").value).trim());
                            if (typeof dialog.mLauncher.saveToDisk === 'function') {
                                dialog.mLauncher.saveToDisk(file, 1);
                            } else {
                                dialog.mLauncher.MIMEInfo.preferredAction = dialog.mLauncher.MIMEInfo.saveToDisk;
                                dialog.mLauncher.saveDestinationAvailable(file);
                            }
                            dialog.onCancel = function () { };
                            close();
                        }
                    }));
                })
                document.getElementById("normalBox").after(quickSave);
            }
            setTimeout(() => {
                document.getElementById("normalBox").removeAttribute("collapsed");
                window.sizeToContent();
            }, 100);
        },
        exec: async function (path, arg, options) {
            let file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
            let process = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
            try {
                let a;
                if (typeof arg == "undefined") arg = []; // fix slice error
                if (typeof arg == 'string' || arg instanceof String) {
                    a = arg.split(/\s+/)
                } else if (Array.isArray(arg)) {
                    a = arg;
                } else {
                    a = [arg];
                }
                file.initWithPath(path);
                if (!file.exists()) {
                    this.alerts(LANG.format("file not found", path), "error");
                    throw new Error(LANG.format("file not found", path));
                }

                if (!file.isDirectory() && file.isExecutable()) {
                    process.init(file);
                    process.runw(false, a, a.length);
                } else {
                    file.launch();
                }
            } catch (e) {
                console.error(e);
            }
        },
        /**
         * 弹出右下角提示
         * 
         * @param {string} aMsg 提示信息
         * @param {string} aTitle 提示标题
         * @param {Function} aCallback 提示回调，可以不提供
         */
        alerts (aMsg, aTitle, aCallback) {
            var callback = aCallback ? {
                observe: function (subject, topic, data) {
                    if ("alertclickcallback" != topic)
                        return;
                    aCallback.call(null);
                }
            } : null;
            var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
            alertsService.showAlertNotification(
                this.appVersion >= 78 ? "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiLz48cGF0aCBkPSJNMTIgMjJDNi40NzcgMjIgMiAxNy41MjMgMiAxMlM2LjQ3NyAyIDEyIDJzMTAgNC40NzcgMTAgMTAtNC40NzcgMTAtMTAgMTB6bTAtMmE4IDggMCAxIDAgMC0xNiA4IDggMCAwIDAgMCAxNnpNMTEgN2gydjJoLTJWN3ptMCA0aDJ2NmgtMnYtNnoiLz48L3N2Zz4=" : "chrome://global/skin/icons/information-32.png", aTitle || "DownloadPlus",
                aMsg + "", !!callback, "", callback);
        }
    }
    function isTrue (pref, defaultValue = true) {
        return Services.prefs.getBoolPref(pref, defaultValue) === true;
    }

    /**
     * 获取所有盘符，用到 dll 调用，只能在 windows 下使用
     * 
     * @system windows
     * @returns {array} 所有盘符数组
     */
    function getAllDrives () {
        let lib = ctypes.open("kernel32.dll");
        let GetLogicalDriveStringsW = lib.declare('GetLogicalDriveStringsW', ctypes.winapi_abi, ctypes.unsigned_long, ctypes.uint32_t, ctypes.char16_t.ptr);
        let buffer = new (ctypes.ArrayType(ctypes.char16_t, 1024))();
        let rv = GetLogicalDriveStringsW(buffer.length, buffer);
        let resultLen = parseInt(rv.toString() || "0");
        let arr = [];
        if (!resultLen) {
            lib.close();
            return arr;
        }
        for (let i = 0; i < resultLen; i++) {
            arr[i] = buffer.addressOfElement(i).contents;
        }
        arr = arr.join('').split('\0').filter(el => el.length);
        lib.close();
        return arr;
    }

    function $ (sel) {
        return document.querySelector(sel);
    }

    /**
     * 创建 DOM 元素
     * 
     * @param {Document} doc 
     * @param {string} type 
     * @param {Object} attrs 
     * @returns 
     */
    function createEl (doc, type, attrs = {}) {
        let el = type.startsWith('html:') ? doc.createElementNS('http://www.w3.org/1999/xhtml', type) : doc.createXULElement(type);
        for (let key of Object.keys(attrs)) {
            if (key === 'innerHTML') {
                el.innerHTML = attrs[key];
            } else if (key.startsWith('on')) {
                el.addEventListener(key.slice(2).toLocaleLowerCase(), attrs[key]);
            } else {
                el.setAttribute(key, attrs[key]);
            }
        }
        return el;
    }

    function copyText (aText) {
        Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(aText);
    }

    await window.DownloadPlus.init();
})(`
.FlashGot {
    list-style-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiLz48cGF0aCBkPSJNMTcgMTh2LTJoLjVhMy41IDMuNSAwIDEgMC0yLjUtNS45NVYxMGE2IDYgMCAxIDAtOCA1LjY1OXYyLjA4OWE4IDggMCAxIDEgOS40NTgtMTAuNjVBNS41IDUuNSAwIDEgMSAxNy41IDE4bC0uNS4wMDF6bS00LTEuOTk1aDNsLTUgNi41di00LjVIOGw1LTYuNTA1djQuNTA1eiIvPjwvc3ZnPg==);
}
`, `
#downloadsContextMenu:not([needsgutter]) > .downloadPlus-menuitem > .menu-iconic-left {
    visibility: collapse;
}
`, `
#contentTypeImage {
    height: 24px;
    width: 24px;
}
#location {
    padding: 3px 0;
}
#locationText {
    border: 1px solid var(--in-content-box-border-color, ThreeDDarkShadow);
    border-right-width: 0;
    border-radius:var(--border-radius-small) 0 0 var(--border-radius-small);
    padding-inline: 5px;
    flex: 1;
    appearance: none;
    padding-block: 2px;
    margin: 0;
    height: 18px;
}
#locationHbox {
    display: flex;
}
#locationHbox[hidden="true"] {
    visibility: collapse;
}
#encodingConvertButton {
    height: 23px;
    min-width: unset;
    list-style-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGQ9Ik0zLjYwMzUxNTYgMkwwIDEyLjc5Mjk2OUwwIDEzTDEgMTNMMSAxMi45NTcwMzFMMS45ODYzMjgxIDEwTDcuMDE5NTMxMiAxMEw4IDEyLjk1NTA3OEw4IDEzTDkgMTNMOSAxMi43OTQ5MjJMNS40MTYwMTU2IDJMNC41IDJMMy42MDM1MTU2IDIgeiBNIDQuMzIyMjY1NiAzTDQuNSAzTDQuNjk1MzEyNSAzTDYuNjg3NSA5TDIuMzIwMzEyNSA5TDQuMzIyMjY1NiAzIHogTSAxMSA1TDExIDZMMTMuNSA2QzE0LjMzNTAxNSA2IDE1IDYuNjY0OTg0OSAxNSA3LjVMMTUgOC4wOTM3NUMxNC44NDI3NSA4LjAzNzEzMzUgMTQuNjc1NjcgOCAxNC41IDhMMTEuNSA4QzEwLjY3NzQ2OSA4IDEwIDguNjc3NDY4NiAxMCA5LjVMMTAgMTEuNUMxMCAxMi4zMjI1MzEgMTAuNjc3NDY5IDEzIDExLjUgMTNMMTMuNjcxODc1IDEzQzE0LjE0NjI5NyAxMyAxNC42MDQ0ODYgMTIuODYwMDg0IDE1IDEyLjYxMTMyOEwxNSAxM0wxNiAxM0wxNiAxMS43MDcwMzFMMTYgOS41TDE2IDcuNUMxNiA2LjEyNTAxNTEgMTQuODc0OTg1IDUgMTMuNSA1TDExIDUgeiBNIDExLjUgOUwxNC41IDlDMTQuNzgxNDY5IDkgMTUgOS4yMTg1MzE0IDE1IDkuNUwxNSAxMS4yOTI5NjlMMTQuNzMyNDIyIDExLjU2MDU0N0MxNC40NTEwNzQgMTEuODQxODk1IDE0LjA2OTE3MSAxMiAxMy42NzE4NzUgMTJMMTEuNSAxMkMxMS4yMTg1MzEgMTIgMTEgMTEuNzgxNDY5IDExIDExLjVMMTEgOS41QzExIDkuMjE4NTMxNCAxMS4yMTg1MzEgOSAxMS41IDkgeiIvPjwvc3ZnPg==);
    border-radius: 0;
    margin-block: 0;
    margin-inline: 0;
    outline: none;
    appearance: none;
    box-sizing: border-box;
    border: 1px solid var(--in-content-box-border-color, ThreeDDarkShadow);
    border-radius: 0 var(--border-radius-small) var(--border-radius-small) 0;
}
#basicBox {
    display: none;
}
#completeLinkDescription {
    max-width: 340px;
    cursor:pointer;
}
hbox.copied > #completeLinkDescription {
    text-decoration: underline;
}
#quickSave > button {
    padding: 0;
    & > .button-box {
        margin: 0;
        & >.button-icon {
            height: 16px;
            width: 16px;
            margin-right: 4px;
        }
    }
}
`)