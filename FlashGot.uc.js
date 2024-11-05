// ==UserScript==
// @name            FlashGot.uc.js
// @long-description
// @description
/* FlashGot 下载工具选择
FlashGot.exe 的默认存放路径是 配置文件夹\chrome\UserTools\FlashGot.exe
如果需要修改，请在 about:config 中新增字符串配置项 userChromeJS.downloadPlus.flashgotPath，填入相对路径即可。
比如 \\chrome\\UserTools\\FlashGot.exe，需要使用\\替代\

FlashGot.exe 下载：https://github.com/benzBrake/Firefox-downloadPlus.uc.js/releases/tag/v2023.05.11
*/
// @version         1.0.1
// @license         MIT License
// @compatibility   Firefox 90
// @charset         UTF-8
// @include         main
// @include         chrome://mozapps/content/downloads/unknownContentType.xhtml
// @homepageURL     https://github.com/benzBrake/FirefoxCustomize/tree/master/userChromeJS
// @note            1.0.1 修复总是显示为英文和按钮总是在左边的问题
// @note            1.0.0 相比 downloadPlus_ff98.uc.js 的 FlashGot 功能，新增了 FlashGot 按钮，去除了下载页面的设置默认下载器的功能
// ==/UserScript==
(async (css) => {
    const CustomizableUI = globalThis.CustomizableUI || Cu.import("resource:///modules/CustomizableUI.jsm").CustomizableUI;
    const Services = globalThis.Services || Cu.import("resource://gre/modules/Services.jsm").Services;

    const LANG = {
        "use flashgot to download": "FlashGot",
        "download with flashgot": "使用 FlashGot 下载",
        "default": "（默认）",
        "download by default download manager": "FlashGot 默认",
        "no supported download manager": "没有找到 FlashGot 支持的下载工具",
        "force reload download managers list": "刷新下载工具",
        "reloading download managers list": "正在重新读取 FlashGot 支持的下载工具列表，请稍后！",
        "reload download managers list finish": "读取FlashGot 支持的下载工具完成，请选择你喜欢的下载工具",
        "set to default download manger": "设置 %s 为默认下载工具",
        "file not found": "文件不存在：%s",
        "about flashgot": "关于 FlashGot"
    }

    const FLASHGOT_OUPUT_ENCODING = (() => {
        switch (Services.locale.appLocaleAsBCP47) {
            case 'zh-CN': return 'GBK';
            case 'zh-TW': return 'BIG5';
            case 'zh-HK': return 'BIG5';
            // you can add default encoding for your language
            default: return 'UTF-8';
        }
    })()

    /**
     * 格式化字符串
     * 
     * @param {string} f 格式字符串
     * @param  {...any} args 剩余参数，只能是数字和字符串
     * @returns 
     */
    const $L = function sprintf (f, ...args) {
        let s = f; 
        if (LANG[s]) s = LANG[s];
        for (let a of args) s = s.replace(/%[sd]/, a); return s;
    }

    if (location.href.startsWith("chrome://browser/content/browser.x")) {
        const FlashGot = {
            PREF_FLASHGOT: 'userChromeJS.downloadPlus.flashgotPath',
            PREF_FLASHGOT_DEFAULT: 'userChromeJS.downloadPlus.flashgotDefaultManager',
            PREF_FLASHGOT_DOWNLOAD_MANAGERS: 'userChromeJS.downloadPlus.flashgotDownloadManagers',
            FLASHGOT_FILE_STRUCTURE: `{num};{download-manager};{is-private};;\n{referer}\n{url}\n{description}\n{cookies}\n{post-data}\n{filename}\n{extension}\n{download-page-referer}\n{download-page-cookies}\n\n\n{user-agent}`,
            FLASHGOT_FORCE_USERAGENT: {},
            FLASHGOT_COOKIES_FILTER: {},
            FLASHGOT_NULL_REFERER: [],
            FLASHGOT_DONT_SEND_DOWNLOAD_PAGE_INFO: [],
            /**
             * 内置路径转换
             */
            get DEFINED_PATHS () {
                delete this.DEFINED_PATHS;
                let paths = [];
                ["GreD", "ProfD", "ProfLD", "UChrm", "TmpD", "Home", "Desk", "Favs", "LocalAppData"].forEach(key => {
                    var path = Services.dirsvc.get(key, Ci.nsIFile);
                    paths[key] = path.path;
                });
                return this.DEFINED_PATHS = paths;
            },
            async init () {
                try {
                    CustomizableUI.createWidget({
                        id: 'FlashGot-Btn',
                        removable: true,
                        defaultArea: CustomizableUI.AREA_NAVBAR,
                        type: "custom",
                        onBuild: doc => this.createButton(doc)
                    });
                } catch (e) { /* 防止新窗口报错 */ }
                await this.loadDownloadManagers();
                this.btn = CustomizableUI.getWidget('FlashGot-Btn').forWindow(window).node;
                this.refreshFlashGotPopup();
                this.createContextMenu();
                let styleService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
                let styleURI = Services.io.newURI("data:text/css," + encodeURIComponent(css));
                styleService.loadAndRegisterSheet(styleURI, Ci.nsIStyleSheetService.AUTHOR_SHEET);
            },
            createButton (doc) {
                let btn = createElement('toolbarbutton', {
                    id: 'FlashGot-Btn',
                    label: 'FlashGot Button',
                    type: 'menu',
                    class: 'toolbarbutton-1 chromeclass-toolbar-additional FlashGot-icon',
                });
                let popup = createElement('menupopup', {
                    id: 'FlashGot-Popup',
                    onpopupshowing: () => this.refreshFlashGotPopup(),
                });
                let refreshItem = createElement('menuitem', {
                    label: $L("force reload download managers list"),
                    style: 'list-style-image: url("chrome://global/skin/icons/reload.svg");',
                    accesskey: 'R',
                    oncommand: async _ => {
                        await this.loadDownloadManagers(true, true);
                        this.refreshFlashGotPopup()
                    }
                });
                popup.appendChild(refreshItem);
                let separatorTop = createElement('menuseparator');
                let separatorBottom = createElement('menuseparator', {
                    id: 'FlashGot-Popup-Separator-Downloaders',
                });
                let about = createElement('menuitem', {
                    label: $L("about flashgot"),
                    accesskey: 'A',
                    style: 'list-style-image: url("chrome://global/skin/icons/help.svg");',
                    oncommand: () => {
                        openTrustedLinkIn("https://github.com/benzBrake/Firefox-downloadPlus.uc.js", "tab")
                    }
                })
                popup.appendChild(separatorTop);
                popup.appendChild(separatorBottom);
                popup.appendChild(about);
                btn.appendChild(popup);
                return btn;
            },
            refreshFlashGotPopup () {
                if (!this.btn) return;
                let popup = this.btn.querySelector('#FlashGot-Popup');
                if (!popup) return;
                popup.querySelectorAll('menuitem[manager]').forEach(item => item.remove());
                if (this.FLASHGOT_DOWNLOAD_MANSGERS.length) {
                    this.FLASHGOT_DOWNLOAD_MANSGERS.forEach(manager => {
                        let item = createElement('menuitem', {
                            label: manager,
                            manager,
                            type: 'checkbox',
                            checked: manager == this.FLASHGOT_DEFAULT_MANAGER,
                            oncommand: e => this.setDefaultManager(e)
                        });
                        popup.insertBefore(item, popup.querySelector('#FlashGot-Popup-Separator-Downloaders'));
                    });
                }
                if (!popup.querySelector('menuitem[manager][checked=true]')) {
                    popup.querySelector('menuitem[manager]').setAttribute('checked', 'true');
                }
            },
            createContextMenu () {
                let menu = document.getElementById('contentAreaContextMenu');
                let item = createElement('menuitem', {
                    id: 'FlashGot-ContextMenu',
                    label: $L("download with flashgot"),
                    class: 'FlashGot-icon',
                    accesskey: 'F',
                    trigger: 'link',
                    oncommand: e => this.handleFlashgotEvent(e)
                });
                menu.insertBefore(item, menu.querySelector('#context-media-eme-learnmore ~ menuseparator'));
                menu.addEventListener('popupshowing', e => {
                    item.setAttribute('hidden', !gContextMenu.onLink);
                    let node = document.querySelector('#context-media-eme-separator')?.nextElementSibling;
                    let nums = 0;
                    while(node.tagName !== "menuseparator") {
                        if (!node.hidden) nums++;
                        node = node.nextElementSibling;
                    }
                    document.querySelector('#context-media-eme-separator')?.setAttribute('hidden', !nums);
                }, false);
            },
            setDefaultManager (e) {
                let manager = e.target.getAttribute('manager');
                this.FLASHGOT_DEFAULT_MANAGER = manager;
                Services.prefs.setStringPref(this.PREF_FLASHGOT_DEFAULT, manager);
            },
            async loadDownloadManagers (forceLoad, notify) {
                this.FLASHGOT_DOWNLOAD_MANSGERS = [];
                if (notify) alerts($L("reloading download managers list"));
                if (this.FLASHGOT_PATH) {
                    try {
                        let prefVal = Services.prefs.getStringPref(this.PREF_FLASHGOT_DOWNLOAD_MANAGERS);
                        this.FLASHGOT_DOWNLOAD_MANSGERS = prefVal.split(",");
                    } catch (e) { forceLoad = true }
                    if (forceLoad) {
                        let resultPath = PathUtils.join(this.handleRelativePath("{tmpDir}\\.flashgot.dm.txt"));
                        await new Promise((resolve, reject) => {
                            // read download managers list from flashgot.exe
                            this.exec(this.FLASHGOT_PATH, ["-o", resultPath], {
                                processObserver: {
                                    observe (subject, topic) {
                                        switch (topic) {
                                            case "process-finished":
                                                try {
                                                    // Wait 1s after process to resolve
                                                    setTimeout(resolve, 1000);
                                                } catch (ex) {
                                                    reject(ex);
                                                }
                                                break;
                                            default:
                                                reject(topic);
                                                break;
                                        }
                                    }
                                },
                            });
                        });
                        let resultString = readText(resultPath, FLASHGOT_OUPUT_ENCODING);
                        this.FLASHGOT_DOWNLOAD_MANSGERS = resultString.split("\n").filter(l => l.includes("|OK")).map(l => l.replace("|OK", ""))
                        await IOUtils.remove(resultPath, { ignoreAbsent: true });
                        Services.prefs.setStringPref(this.PREF_FLASHGOT_DOWNLOAD_MANAGERS, this.FLASHGOT_DOWNLOAD_MANSGERS.join(","));
                    }
                }
            },
            get FLASHGOT_PATH () {
                let flashgotPref = Services.prefs.getStringPref(this.PREF_FLASHGOT, "\\chrome\\UserTools\\FlashGot.exe");
                flashgotPref = this.handleRelativePath(flashgotPref);
                const flashgotPath = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
                flashgotPath.initWithPath(flashgotPref);
                delete this.FLASHGOT_PATH;
                if (flashgotPath.exists()) {
                    return this.FLASHGOT_PATH = flashgotPath.path;
                } else {
                    return false;
                }
            },
            exec: function (path, arg, opt = { startHidden: false }) {
                const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
                const process = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
                if (opt.startHidden) process.startHidden = true;
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
                        alerts(("file not found", path), "error");
                        this.error($L("file not found", path));
                        return;
                    }

                    if (file.isExecutable()) {
                        process.init(file);
                        if (opt.processObserver) {
                            process.runwAsync(a, a.length, opt.processObserver);
                        } else {
                            process.runw(false, a, a.length);
                        }
                    } else {
                        file.launch();
                    }
                } catch (e) {
                    this.error(e);
                }
            },
            handleRelativePath (path, parentPath) {
                if (path) {
                    let handled = false;
                    path = replaceArray(path, [
                        "{homeDir}",
                        "{libDir}",
                        "{localProfileDir}",
                        "{profileDir}",
                        "{tmpDir}"
                    ], [
                        "{Home}",
                        "{GreD}",
                        "{ProfLD}",
                        "{ProfD}",
                        "{TmpD}"
                    ]);
                    Object.keys(this.DEFINED_PATHS).forEach(key => {
                        if (path.includes("{" + key + "}")) {
                            path = path.replace("{" + key + "}", this.DEFINED_PATHS[key] || "");
                            handled = true;
                        }
                    })
                    if (!handled) {
                        path = path.replace(/\//g, '\\').toLocaleLowerCase();
                        if (/^(\\)/.test(path)) {
                            if (!parentPath) parentPath = PathUtils.profileDir
                            path = parentPath + path;
                            path = path.replace("\\\\", "\\");
                        }
                    }
                    return path;
                }
            },
            handleFlashgotEvent (event) {
                const { FLASHGOT_DOWNLOAD_MANSGERS, FLASHGOT_FILE_STRUCTURE, FLASHGOT_NULL_REFERER, FLASHGOT_DONT_SEND_DOWNLOAD_PAGE_INFO, FLASHGOT_FORCE_USERAGENT, FLASHGOT_COOKIES_FILTER, DEFAULT_DOWNLOAD_MANAGER, FLASHGOT_PATH } = this;

                if (!FLASHGOT_DOWNLOAD_MANSGERS.length) {
                    return alerts($L("no supported download manager"));
                }

                const { target } = event;
                let downloadManager, referer = "", cookies = "", isPrivate = 0;
                let downloadLink, downloadHost, description, fileName, extension = "", postData = "";
                let downloadPageReferer = "", downloadPageCookies = "", userAgent = navigator.userAgent;
                let downloadNum = 1;

                if (target.hasAttribute("manager")) {
                    const { ownerGlobal: win, ownerGlobal: { dialog } = {} } = target || {};
                    const { mLauncher, mContext } = dialog || {};
                    const partFile = mLauncher.targetFile; // 目前无法利用 partFile，将来可以利用
                    ({ asciiSpec: downloadLink, host: downloadHost, username, userPass: password } = mLauncher.source);

                    downloadManager = target.getAttribute("manager") || FLASHGOT_DOWNLOAD_MANSGERS[0];
                    isPrivate = mContext.PrivateBrowsingUtils.isBrowserPrivate(mContext) + 0;
                    fileName = (document.querySelector("#locationText")?.value || mLauncher.suggestedFileName);
                    referer = dialog.mSourcePath;

                    try { extension = mLauncher.MIMEInfo.primaryExtension; } catch (e) { }
                } else if (target.getAttribute("trigger") === "link") {
                    const { linkURL, linkURI, linkTextStr, browser } = gContextMenu;
                    downloadLink = linkURL;
                    downloadHost = linkURI.host;
                    description = linkTextStr;
                    referer = (browser || gBrowser.selectedBrowser)._documentURI.spec;
                    downloadManager = DEFAULT_DOWNLOAD_MANAGER || FLASHGOT_DOWNLOAD_MANSGERS[0];
                    downloadPageCookies = gatherCookies(referer);
                    downloadPageReferer = referer;
                    isPrivate = PrivateBrowsingUtils.isBrowserPrivate(browser) + 0;
                } else {
                    return alerts($L("operate not support"));
                }

                if (!downloadLink || !downloadManager) {
                    return alerts(downloadLink ? $L("no supported download manager") : $L("error link"));
                }

                if (FLASHGOT_NULL_REFERER.includes(downloadHost)) referer = "";
                if (FLASHGOT_DONT_SEND_DOWNLOAD_PAGE_INFO.includes(downloadHost)) {
                    downloadPageReferer = "";
                    downloadPageCookies = "";
                }
                if (FLASHGOT_FORCE_USERAGENT[downloadHost]) {
                    userAgent = FLASHGOT_FORCE_USERAGENT[downloadHost];
                }
                cookies = FLASHGOT_COOKIES_FILTER[downloadHost]
                    ? gatherCookies(downloadLink, false, FLASHGOT_COOKIES_FILTER[downloadHost])
                    : gatherCookies(downloadLink);

                const initData = replaceArray(FLASHGOT_FILE_STRUCTURE, [
                    '{num}', '{download-manager}', '{is-private}', '{referer}', '{url}', '{description}', '{cookies}', '{post-data}',
                    '{filename}', '{extension}', '{download-page-referer}', '{download-page-cookies}', '{user-agent}'
                ], [
                    downloadNum, downloadManager, isPrivate, referer, downloadLink, description, cookies, postData,
                    fileName, extension, downloadPageReferer, downloadPageCookies, userAgent
                ]);

                const initFilePath = this.handleRelativePath(`{tmpDir}\\${hashText(downloadLink)}.dl.properties`);
                saveFile(initFilePath, initData);
                this.exec(FLASHGOT_PATH, initFilePath);

                if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                    close();
                }
            },
            error: console.error,
            log: console.log
        }
        window.FlashGot = FlashGot;
        await FlashGot.init();
    } else if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x") && Services.prefs.getBoolPref("userChromeJS.downloadPlus.enableFlashgotIntergention", true)) {
        const FlashGotHelper = {
            PREF_FLASHGOT_DEFAULT: 'userChromeJS.downloadPlus.flashgotDefaultManager',
            get DEFAULT_DOWNLOAD_MANAGER () {
                return Services.prefs.getStringPref(this.PREF_FLASHGOT_DEFAULT, "");
            },
            init () {
                const { FlashGot } = Services.wm.getMostRecentBrowserWindow();
                if (!FlashGot.FLASHGOT_PATH) return;
                this.FlashGot = FlashGot;
                const { dialog } = window;
                let modeGroup = dialog.dialogElement('mode');
                const createElem = (tag, attrs, children = []) => {
                    let elem = createElement(tag, attrs);
                    children.forEach(child => elem.appendChild(child));
                    return elem;
                };

                // Create elements with structure in one go
                let flashgotHbox = createElem('hbox', { id: 'flashgot-box' }, [
                    createElem('radio', { id: 'flashgot', label: $L("use flashgot to download"), accesskey: 'F' }),
                    createElem('deck', { id: 'flashgotDeck', flex: 1 }, [
                        createElem('hbox', { flex: 1, align: 'center' }, [
                            createElem('menulist', { id: 'flashgotHandler', flex: 1, native: true }, [
                                createElem('menupopup', {})
                            ]),
                            createElem('toolbarbutton', {
                                id: 'Flashgot-Download-By-Default',
                                tooltiptext: $L("download by default download manager"),
                                class: "toolbarbutton-1",
                                style: 'list-style-image: url(chrome://browser/skin/downloads/downloads.svg)',
                                accesskey: "D",
                                oncommand: () => {
                                    this.FlashGot.handleFlashgotEvent({ target: flashgotRadio.parentNode.querySelector('menuitem[selected="true"]') });
                                    close();
                                }
                            })
                        ])
                    ])
                ]);

                modeGroup.appendChild(flashgotHbox);
                this.refreshDownloadManagersPopup(flashgotHbox.querySelector('#flashgotHandler menupopup'));

                const flashgotRadio = dialog.dialogElement('flashgot');
                const flashgotDefaultDownload = () => {
                    this.FlashGot.handleFlashgotEvent({ target: flashgotRadio.parentNode.querySelector('menuitem[selected="true"]') });
                }

                dialog.onOK = (function () {
                    var cached_function = dialog.onOK;
                    return function () {
                        if (flashgotRadio.selected)
                            return flashgotDefaultDownload.apply(this, arguments);
                        else
                            return cached_function.apply(this, arguments);
                    };
                })();
            },
            refreshDownloadManagersPopup (flashgotPopup) {
                if (!flashgotPopup) return;
                const { ownerDocument: document } = flashgotPopup;
                flashgotPopup.querySelectorAll("menuitem").forEach(el => el.remove());
                const setHandlerLabel = (target, label, isDefault) => {
                    const handlerLabel = `${label}${isDefault ? $L("default") : ''}`;
                    document.querySelector("#flashgotHandler").setAttribute('label', handlerLabel);
                };

                this.FlashGot.FLASHGOT_DOWNLOAD_MANSGERS.forEach(manager => {
                    const menuitemDownload = createElement('menuitem', {
                        label: manager,
                        manager,
                        id: `dm-${hashText(manager)}`,
                        onclick (event) {
                            const { target } = event;
                            const { ownerDocument: aDoc } = target;

                            target.parentNode.querySelectorAll("menuitem").forEach(el => el.removeAttribute("selected"));
                            setHandlerLabel(target, target.label, target.hasAttribute('default'));

                            target.setAttribute("selected", true);
                            aDoc.querySelector("#flashgot").click();
                        }
                    });

                    flashgotPopup.appendChild(menuitemDownload);
                });

                // Select the default download manager
                let defaultElement;
                try {
                    const defaultManager = Services.prefs.getStringPref(this.PREF_FLASHGOT_DEFAULT);
                    defaultElement = defaultManager ? flashgotPopup.querySelector(`#dm-${hashText(defaultManager)}`) : null;
                } catch (e) {
                    console.error(e);
                }
                defaultElement = defaultElement || flashgotPopup.firstChild;

                if (defaultElement) {
                    defaultElement.setAttribute('selected', true);
                    defaultElement.setAttribute('default', true);
                    setHandlerLabel(defaultElement, defaultElement.getAttribute('label'), true);
                }
            }
        }
        window.FlashGotHelper = FlashGotHelper;
        FlashGotHelper.init();
    }

    /**
     * 弹出右下角的通知
     * 
     * @param {string} aMsg 消息
     * @param {string|null} aTitle 标题
     * @param {Function|null} aCallback 点击后的回调函数 
     */
    function alerts (aMsg, aTitle, aCallback) {
        var callback = aCallback ? {
            observe: function (subject, topic, data) {
                if ("alertclickcallback" != topic)
                    return;
                aCallback.call(null);
            }
        } : null;
        var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
        alertsService.showAlertNotification(
            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiLz48cGF0aCBkPSJNMTIgMjJDNi40NzcgMjIgMiAxNy41MjMgMiAxMlM2LjQ3NyAyIDEyIDJzMTAgNC40NzcgMTAgMTAtNC40NzcgMTAtMTAgMTB6bTAtMmE4IDggMCAxIDAgMC0xNiA4IDggMCAwIDAgMCAxNnpNMTEgN2gydjJoLTJWN3ptMCA0aDJ2NmgtMnYtNnoiLz48L3N2Zz4=", aTitle || "FlashGot",
            aMsg + "", !!callback, "", callback);
    }

    /**
     * 文本串替换
     * 
     * @param {string} replaceString 需要处理的文本串
     * @param {Array} find 需要被替换的文本串
     * @param {Array} replace 替换的文本串
     * @returns string
     */
    function replaceArray (replaceString, find, replace) {
        var regex;
        for (var i = 0; i < find.length; i++) {
            regex = new RegExp(find[i], "g");
            replaceString = replaceString.replace(regex, replace[i]);
        }
        return replaceString;
    }

    /**
     * 读取文本内容
     * 
     * @param {Ci.nsIFile|string} aFileOrPath 文件对象或者路径
     * @param {string|null} encoding 文件编码
     * @returns string
     */
    function readText (aFileOrPath, encoding) {
        encoding || (encoding = "UTF-8");
        var aFile;
        if (typeof aFileOrPath == "string") {
            aFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);;
            aFile.initWithPath(aFileOrPath);
        } else {
            aFile = aFileOrPath;
        }
        if (aFile.exists()) {
            let stream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
            stream.init(aFile, 0x01, 0, 0);
            let cvstream = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
            cvstream.init(stream, encoding, 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
            let content = '',
                data = {};
            while (cvstream.readString(4096, data)) {
                content += data.value;
            }
            cvstream.close();
            return content.replace(/\r\n?/g, '\n');
        } else {
            return "";
        }
    }

    /**
     * 保存文本内容
     * 
     * @param {Ci.nsIFile|string} aFileOrPath 文件对象或者路径
     * @param {string} data 文本内容 
     * @param {string|null} encoding 编码格式
     */
    function saveFile (aFileOrPath, data, encoding) {
        encoding || (encoding = "UTF-8");
        var aFile;
        if (typeof aFileOrPath == "string") {
            aFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);;
            aFile.initWithPath(aFileOrPath);
        } else {
            aFile = aFileOrPath;
        }
        var suConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
        suConverter.charset = encoding;
        data = suConverter.ConvertFromUnicode(data);
        var foStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
        foStream.init(aFile, 0x02 | 0x08 | 0x20, 0664, 0);
        foStream.write(data, data.length);
        foStream.close();
    }

    /**
     * 创建 XUL/DOM 元素
     * 
     * @param {string} tag Tag 名
     * @param {Object} attrs 
     * @param {Array} skipAttrs 
     * @param {Document|null} doc HTML Document 
     * @returns 
     */
    function createElement (tag, attrs = {}, skipAttrs = [], doc = document) {
        if (!tag) return null;
        const isHTML = tag.startsWith('html:');
        const namespace = isHTML ? 'http://www.w3.org/1999/xhtml' : null;
        const el = isHTML ? createElementNS(namespace, tag, skipAttrs, doc) : doc.createXULElement(tag.replace('html:', ''));
        applyAttrs(el, attrs, skipAttrs);
        // Automatically add iconic class if it's a menu or menuitem and class is not skipped
        if (['menu', 'menuitem'].includes(tag) && !skipAttrs.includes('class')) {
            el.classList.add(`${tag}-iconic`);
        }
        return el;
    }

    function createElementNS (namespace = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", type, props = {}, doc = document) {
        if (!type) return null;
        const el = doc.createElementNS(namespace, type);
        return applyAttrs(el, props);
    }

    /**
     * 为元素设置属性
     * 
     * @param {HTMLElement} el HTML 元素
     * @param {Object} attrs 属性键值对
     * @param {Array} skipAttrs 需要跳过的属性
     * @returns 
     */
    function applyAttrs (el, attrs = {}, skipAttrs = []) {
        if (!skipAttrs.includes('innerHTML')) skipAttrs.push('innerHTML');
        Object.entries(attrs).forEach(([key, value]) => {
            if (!skipAttrs.includes(key)) {
                if (key.startsWith('on')) {
                    el.addEventListener(key.slice(2).toLowerCase(), value);
                } else {
                    el.setAttribute(key, value);
                }
            }
        });
        if (attrs.innerHTML) el.innerHTML = attrs.innerHTML;
        return el;
    }

    /**
     * 计算文本的哈希值
     * 
     * @param {string} text 需要计算的文本
     * @param {string} type 哈希类型
     * @returns 
     */
    function hashText (text, type) {
        if (!(typeof text == 'string' || text instanceof String)) {
            text = "";
        }

        // var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
        //     .createInstance(Ci.nsIScriptableUnicodeConverter);

        // converter.charset = "UTF-8";
        // var result = {};
        // var data = converter.convertToByteArray(text, result);

        // Bug 1851797 - Remove nsIScriptableUnicodeConverter convertToByteArray and convertToInputStream
        let data = new TextEncoder("utf-8").encode(text);

        if (Ci.nsICryptoHash[type]) {
            type = Ci.nsICryptoHash[type]
        } else {
            type = 2;
        }
        var hasher = Cc["@mozilla.org/security/hash;1"].createInstance(
            Ci.nsICryptoHash
        );

        text = null;
        hasher.init(type);
        hasher.update(data, data.length);
        var hash = hasher.finish(false);
        str = data = hasher = null;

        function toHexString (charCode) {
            return ("0" + charCode.toString(16)).slice(-2);
        }

        return Array.from(hash, (c, i) => toHexString(hash.charCodeAt(i))).join("");
    }

    /**
     * 收集 cookie 并保存到文件
     * 
     * @param {string} link 链接
     * @param {boolean} saveToFile 是否保存到文件 
     * @param {Function|string|undefined} filter Cookie 过滤器
     * @returns 
     */
    function gatherCookies (link, saveToFile = false, filter) {
        if (!link) return "";

        const uri = Services.io.newURI(link, null, null);
        let cookies = Services.cookies.getCookiesFromHost(uri.host, {});
        const cookieSavePath = FlashGot.handleRelativePath("{tmpDir}");

        // Apply filter if specified
        if (filter) cookies = cookies.filter(cookie => filter.includes(cookie.name));

        // Format and save cookies to file if needed
        if (saveToFile) {
            const cookieString = cookies.map(formatCookie).join('');
            const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            file.initWithPath(cookieSavePath);
            file.append(`${uri.host}.txt`);

            if (!file.exists()) file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0o644);

            const foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
            foStream.init(file, 0x02 | 0x08 | 0x20, 0o666, 0);
            foStream.write(cookieString, cookieString.length);
            foStream.close();

            return file.path;
        } else {
            return cookies.map(cookie => `${cookie.name}:${cookie.value}`).join("; ");
        }

        function formatCookie (co) {
            // Format to Netscape type cookie format
            return [
                `${co.isHttpOnly ? '#HttpOnly_' : ''}${co.host}`,
                co.isDomain ? 'TRUE' : 'FALSE',
                co.path,
                co.isSecure ? 'TRUE' : 'FALSE',
                co.expires > 0 ? co.expires : "0",
                co.name,
                co.value
            ].join('\t') + '\n';
        }
    }

})(`
.FlashGot-icon {
    list-style-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiLz48cGF0aCBkPSJNMTcgMTh2LTJoLjVhMy41IDMuNSAwIDEgMC0yLjUtNS45NVYxMGE2IDYgMCAxIDAtOCA1LjY1OXYyLjA4OWE4IDggMCAxIDEgOS40NTgtMTAuNjVBNS41IDUuNSAwIDEgMSAxNy41IDE4bC0uNS4wMDF6bS00LTEuOTk1aDNsLTUgNi41di00LjVIOGw1LTYuNTA1djQuNTA1eiIvPjwvc3ZnPg==);
}
#FlashGot-Popup menuitem:is([type="checkbox"], [type="radio"]):not([checked="true"]) > .menu-iconic-left > .menu-iconic-icon {
    display: flex;
}
#context-media-eme-learnmore:has(~ #FlashGot-ContextMenu[hide-eme-sep=true]) {
    display: none !important;
}
`)