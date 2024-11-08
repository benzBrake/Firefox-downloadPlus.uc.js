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
// @version         1.0.4
// @license         MIT License
// @compatibility   Firefox 90
// @charset         UTF-8
// @include         main
// @include         chrome://mozapps/content/downloads/unknownContentType.xhtml
// @homepageURL     https://github.com/benzBrake/FirefoxCustomize/tree/master/userChromeJS
// @note            1.0.5 结合 AI 优化代码
// @note            1.0.4 修复新窗口报错
// @note            1.0.3 新增右键二级菜单
// @note            1.0.2 修复弹出窗口尺寸问题，修复有时候无法显示 FlashGot 选项
// @note            1.0.1 修复总是显示为英文和按钮总是在左边的问题
// @note            1.0.0 相比 downloadPlus_ff98.uc.js 的 FlashGot 功能，新增了 FlashGot 按钮，去除了下载页面的设置默认下载器的功能
// ==/UserScript==
(async (css) => {
    const CustomizableUI = globalThis.CustomizableUI || Cu.import("resource:///modules/CustomizableUI.jsm").CustomizableUI;
    const Services = globalThis.Services || Cu.import("resource://gre/modules/Services.jsm").Services;

    const LANG = {
        "flashgot-btn": "FlashGot",
        "force-reload-download-managers-list": "刷新下载工具",
        "about-flashgot": "关于 FlashGot",
        // "reloading-download-managers-list": "正在重新读取 FlashGot 支持的下载工具列表，请稍后！",
        "reload-download-managers-list-finish": "读取FlashGot 支持的下载工具完成，请选择你喜欢的下载工具",
        "download-through-flashgot": "使用 FlashGot 下载",
        "download-by-default-download-manager": "使用默认工具下载",
        "no-supported-download-manager": "没有找到 FlashGot 支持的下载工具",
        "default-download-manager": "%s（默认）",
        "file not found": "文件不存在：%s"
    };

    const FLASHGOT_OUTPUT_ENCODING = (() => {
        switch (Services.locale.appLocaleAsBCP47) {
            case 'zh-CN': return 'GBK';
            case 'zh-TW':
            case 'zh-HK': return 'BIG5';
            default: return 'UTF-8';
        }
    })();

    /* Do not change below */
    const sprintf = (f, ...args) => {
        if (LANG[f]) {
            let s = LANG[f]
            return args.reduce((str, a) => str.replace(/%[sd]/, a), s);
        }
        return f.split('-').map((f) => f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()).join(' ');
    };

    const ICONIC_TAGS = ['menu', 'menuitem'];
    const createElement = (doc, tag, attrs, children = []) => {
        let elem = _uc.createElement(doc, tag, attrs);
        if (ICONIC_TAGS.includes(tag)) elem.classList.add(tag + '-iconic');
        children.forEach(child => elem.appendChild(child));
        return elem;
    };

    if (location.href.startsWith("chrome://browser/content/browser.x")) {
        const FlashGot = {
            PREF_FLASHGOT: 'userChromeJS.downloadPlus.flashgotPath',
            PREF_FLASHGOT_DEFAULT_MANAGER: 'userChromeJS.downloadPlus.flashgotDefaultManager',
            PREF_FLASHGOT_DOWNLOAD_MANAGERS: 'userChromeJS.downloadPlus.flashgotDownloadManagers',
            FLASHGOT_FILE_STRUCTURE: `{num};{download-manager};{is-private};;\n{referer}\n{url}\n{description}\n{cookies}\n{post-data}\n{filename}\n{extension}\n{download-page-referer}\n{download-page-cookies}\n\n\n{user-agent}`,
            DOWNLOAD_MANAGERS: [],
            FLASHGOT_PATH: null,
            USERAGENT_OVERRIDES: {},

            get DEFINED_PATHS () {
                return {
                    GreD: Services.dirsvc.get("GreD", Ci.nsIFile).path,
                    ProfD: Services.dirsvc.get("ProfD", Ci.nsIFile).path,
                    ProfLD: Services.dirsvc.get("ProfLD", Ci.nsIFile).path,
                    UChrm: Services.dirsvc.get("UChrm", Ci.nsIFile).path,
                    TmpD: Services.dirsvc.get("TmpD", Ci.nsIFile).path,
                    Home: Services.dirsvc.get("Home", Ci.nsIFile).path,
                    Desk: Services.dirsvc.get("Desk", Ci.nsIFile).path,
                    Favs: Services.dirsvc.get("Favs", Ci.nsIFile).path,
                    LocalAppData: Services.dirsvc.get("LocalAppData", Ci.nsIFile).path
                };
            },

            get FLASHGOT_PATH () {
                if (!this._FLASHGOT_PATH) {
                    let flashgotPref = Services.prefs.getStringPref(this.PREF_FLASHGOT, "\\chrome\\UserTools\\FlashGot.exe");
                    flashgotPref = this.handleRelativePath(flashgotPref);
                    const flashgotFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
                    flashgotFile.initWithPath(flashgotPref);
                    if (flashgotFile.exists()) {
                        this._FLASHGOT_PATH = flashgotFile.path;
                    } else {
                        return false;
                    }
                }
                return this._FLASHGOT_PATH;
            },

            get DEFAULT_MANAGER () {
                return Services.prefs.getStringPref(this.PREF_FLASHGOT_DEFAULT_MANAGER, '');
            },

            set DEFAULT_MANAGER (val) {
                return Services.prefs.setStringPref(this.PREF_FLASHGOT_DEFAULT_MANAGER, val);
            },

            async init () {
                this.applyStyles(css);
                this.reloadManagers();
                try {
                    CustomizableUI.createWidget({
                        id: 'FlashGot-Btn',
                        removable: true,
                        defaultArea: CustomizableUI.AREA_NAVBAR,
                        type: "custom",
                        onBuild: doc => this.createButton(doc)
                    });
                } catch (e) { }
                this.btn = CustomizableUI.getWidget('FlashGot-Btn').forWindow(window).node;
                this.initContextMenu();
                setTimeout(_ => {
                    this.onAftercustomization();
                    window.addEventListener("aftercustomization", this, false);
                }, 0);
            },

            applyStyles (css) {
                const styleService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
                const styleURI = Services.io.newURI("data:text/css," + encodeURIComponent(css));
                if (!styleService.sheetRegistered(styleURI, styleService.AUTHOR_SHEET))
                    styleService.loadAndRegisterSheet(styleURI, styleService.AUTHOR_SHEET);
            },
            createButton (doc) {
                const btn = createElement(doc, 'toolbarbutton', {
                    id: 'FlashGot-Btn',
                    label: sprintf('flashgot-btn'),
                    type: 'menu',
                    class: 'toolbarbutton-1 chromeclass-toolbar-additional FlashGot-icon',
                });
                const popup = createElement(doc, 'menupopup', {
                    id: 'FlashGot-Btn-Popup',
                });
                popup.addEventListener('popupshowing', this, false);
                btn.appendChild(popup);
                return btn;
            },
            initButtonPopup (popup) {
                const { ownerDocument: doc } = popup;
                if (popup.getAttribute('inited')) return;
                popup.appendChild(createElement(doc, 'menuitem', {
                    label: sprintf('force-reload-download-managers-list'),
                    id: 'FlashGot-reload',
                    class: 'FlashGot-reload'
                }));
                popup.appendChild(createElement(doc, 'menuseparator'));
                popup.appendChild(createElement(doc, 'menuseparator', {
                    id: "FlashGot-DownloadManagers-Separator"
                }));
                popup.appendChild(createElement(doc, 'menuitem', {
                    label: sprintf('about-flashgot'),
                    id: 'FlashGot-about',
                    class: 'FlashGot-about'
                }));
                popup.addEventListener('command', this, false);
                popup.setAttribute('inited', true);
            },
            initContextMenu () {
                const contextMenu = document.getElementById('contentAreaContextMenu');
                const doc = contextMenu.ownerDocument;
                const item = createElement(doc, 'menu', {
                    id: 'FlashGot-ContextMenu',
                    label: sprintf("download-through-flashgot"),
                    class: 'FlashGot-icon',
                    accesskey: 'F',
                    onclick: 'event.target.querySelector("#FlashGot-ContextMenuitem")?.doCommand()'
                });
                const popup = createElement(doc, 'menupopup', {
                    id: 'FlashGot-ContextMenu-Popup',
                });
                popup.appendChild(createElement(doc, 'menuitem', {
                    id: 'FlashGot-ContextMenuitem',
                    label: sprintf("download-by-default-download-manager"),
                    class: 'FlashGot-icon',
                    accesskey: 'F',
                    trigger: 'link',
                }));
                popup.appendChild(createElement(doc, 'menuseparator'));
                popup.addEventListener('command', this, false);
                item.appendChild(popup);
                contextMenu.insertBefore(item, contextMenu.querySelector('#context-media-eme-learnmore ~ menuseparator'));
                contextMenu.addEventListener('popupshowing', this, false);
            },
            populateMenu (popup) {
                let ins = popup.querySelector('#FlashGot-DownloadManagers-Separator'), radio = popup.id === 'FlashGot-Btn-Popup';
                popup.querySelectorAll('menuitem[manager]').forEach(item => item.remove());
                this.DOWNLOAD_MANAGERS.forEach(m => {
                    let obj = {
                        label: m,
                        manager: m,
                    }
                    if (radio) {
                        Object.assign(obj, {
                            checked: m === this.DEFAULT_MANAGER,
                            type: 'radio'
                        })
                    }
                    popup.insertBefore(createElement(popup.ownerDocument, 'menuitem', obj), ins);
                });
                if (!radio || popup.querySelectorAll('menuitem[manager][checked=true]').length) return;
                popup.querySelector('menuitem[manager]').setAttribute('checked', true);
            },
            handleEvent (event) {
                const { type } = event;
                const fuT = type.slice(0, 1).toUpperCase() + type.slice(1);
                if ('on' + fuT in this) return this['on' + fuT](event);
                this.log('Unhandled event: ' + type);
            },
            onPopupshowing (event) {
                const { target } = event;
                const doc = target.ownerDocument;
                switch (event.target.id) {
                    case 'contentAreaContextMenu':
                        let item = doc.getElementById('FlashGot-ContextMenu');
                        item.setAttribute('hidden', !gContextMenu.onLink);
                        let node = doc.querySelector('#context-media-eme-separator')?.nextElementSibling;
                        let nums = 0;
                        while (node.tagName !== "menuseparator") {
                            if (!node.hidden) nums++;
                            node = node.nextElementSibling;
                        }
                        doc.querySelector('#context-media-eme-separator')?.setAttribute('hidden', !nums);
                        break;
                    case 'FlashGot-Btn-Popup':
                        this.initButtonPopup(target);
                    case 'FlashGot-ContextMenu-Popup':
                        this.populateMenu(target);
                        break;
                }
            },
            onCommand (event) {
                const { target } = event;
                const menuitem = target.closest('menuitem');
                if (!(menuitem instanceof XULElement)) return;
                if (menuitem.id === 'FlashGot-reload') {
                    (async _ => {
                        await this.reloadManagers(true, true);
                        this.populateMenu(target.closest('menupopup'));
                    })()
                } else if (menuitem.id === 'FlashGot-about') {
                    openTrustedLinkIn("https://github.com/benzBrake/Firefox-downloadPlus.uc.js", "tab");
                } else if (menuitem.getAttribute('manager')) {
                    if (menuitem.closest('menupopup').id === 'FlashGot-Btn-Popup') {
                        this.DEFAULT_MANAGER = menuitem.getAttribute('manager');
                    } else {
                        downloadBy(menuitem.getAttribute('manager') || '');
                    }
                } else if (menuitem.id === 'FlashGot-ContextMenuitem') {
                    downloadBy(FlashGot.DEFAULT_MANAGER || FlashGot.DOWNLOAD_MANAGERS[0] || '');
                }

                function downloadBy (manager) {
                    if (manager.length === 0) {
                        return alerts(sprintf("no-supported-download-manager"));
                    }
                    const { linkURI: uri, linkTextStr: description, browser, contentData } = target.ownerGlobal.gContextMenu;
                    FlashGot.download(uri, {
                        manager,
                        description,
                        mBrowser: browser,
                        mContentData: contentData,
                        isPrivate: PrivateBrowsingUtils.isBrowserPrivate(browser) + 0
                    });
                }
            },
            onAftercustomization: function (event) {
                if (!this.btn) return;
                const { btn } = this;
                let mp = btn.querySelector("#FlashGot-Btn-Popup", btn);
                if (!mp) return;
                // 获取按钮的位置信息
                const rect = btn.getBoundingClientRect();
                // 获取窗口的宽度和高度
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                const x = rect.left + rect.width / 2;  // 按钮的水平中心点
                const y = rect.top + rect.height / 2;  // 按钮的垂直中心点

                if (x < windowWidth / 2 && y < windowHeight / 2) {
                    mp.removeAttribute("position");
                } else if (x >= windowWidth / 2 && y < windowHeight / 2) {
                    mp.setAttribute("position", "after_end");
                } else if (x >= windowWidth / 2 && y >= windowHeight / 2) {
                    mp.setAttribute("position", "before_end");
                } else {
                    mp.setAttribute("position", "before_start");
                }
            },
            async reloadManagers (force = false, notify = false) {
                if (!this.FLASHGOT_PATH) return;
                try {
                    let prefVal = Services.prefs.getStringPref(this.PREF_FLASHGOT_DOWNLOAD_MANAGERS);
                    this.DOWNLOAD_MANAGERS = prefVal.split(",");
                } catch (e) { force = true }
                if (force) {
                    const resultPath = this.handleRelativePath('{TmpD}\\.flashgot.dm.' + Math.random().toString(36).slice(2) + '.txt');
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
                    let resultString = readText(resultPath, FLASHGOT_OUTPUT_ENCODING);
                    this.FLASHGOT_DOWNLOAD_MANSGERS = resultString.split("\n").filter(l => l.includes("|OK")).map(l => l.replace("|OK", ""))
                    await IOUtils.remove(resultPath, { ignoreAbsent: true });
                    Services.prefs.setStringPref(this.PREF_FLASHGOT_DOWNLOAD_MANAGERS, this.FLASHGOT_DOWNLOAD_MANSGERS.join(","));
                }
                if (notify) alerts(sprintf('reload-download-managers-list-finish'));
            },
            exec (path, args, options = { startHidden: false }) {
                switch (typeof args) {
                    case 'string':
                        args = args.split(/\s+/);
                    case 'object':
                        if (Array.isArray(args)) break;
                    default:
                        args = [];
                }
                const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
                const process = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
                if (options.startHidden) process.startHidden = true;

                try {
                    file.initWithPath(path);
                    if (!file.exists()) {
                        alerts($L("file not found", path), "error");
                        return;
                    }

                    if (file.isExecutable()) {
                        process.init(file);
                        if (typeof options.processObserver === "object") {
                            process.runwAsync(args, args.length, options.processObserver);
                        } else {
                            process.runw(false, args, args.length);
                        }

                    } else {
                        file.launch();
                    }
                } catch (e) {
                    console.error("Execution error:", e);
                }
            },
            handleRelativePath (path, parentPath) {
                if (!path) return '';
                path = path.replace(/\//g, '\\');
                let p;
                Object.keys(this.DEFINED_PATHS).some(key => {
                    if (path.includes(`{${key}}`)) {
                        p = path.replace(`{${key}}`, this.DEFINED_PATHS[key] || "");
                        return true; // Breaks the loop
                    }
                    return false;
                });
                if (!p) p = PathUtils.join(parentPath ? parentPath : PathUtils.profileDir, ...path.split("\\"));
                return p;
            },
            download (uri, options = {}) {
                if (!options.manager) return;
                if (uri instanceof Ci.nsIURI) {
                    const { FLASHGOT_PATH, FLASHGOT_FILE_STRUCTURE, USERAGENT_OVERRIDES } = this;
                    const { manager, description, mBrowser, isPrivate } = options;
                    const userAgent = (function (o, u, m, c) {
                        for (let d of Object.keys(o)) {
                            // need to implement regex / subdomain process
                            if (u.host.endsWith(d)) return o[d];
                        }
                        return m?.browsingContext?.customUserAgent || c["@mozilla.org/network/protocol;1?name=http"].getService(Ci.nsIHttpProtocolHandler).userAgent;
                    })(USERAGENT_OVERRIDES, uri, mBrowser, Cc);
                    let referer = '', postData = '', fileName = '', extension = '', downloadPageReferer = '', downloadPageCookies = '';
                    if (options.mBrowser) {
                        const { mBrowser, mContentData } = options;
                        referer = mBrowser.currentURI.spec;
                        downloadPageReferer = mContentData.referrerInfo.originalReferrer.spec
                    } else if (options.mLauncher) {
                        const { mLauncher } = options;
                        fileName = options.fileName || mLauncher.suggestedFileName;
                        try { extension = mLauncher.MIMEInfo.primaryExtension; } catch (e) { }
                    }
                    if (downloadPageReferer) {
                        downloadPageCookies = gatherCookies(downloadPageReferer);
                    }
                    const initData = replaceArray(FLASHGOT_FILE_STRUCTURE, [
                        '{num}', '{download-manager}', '{is-private}', '{referer}', '{url}', '{description}', '{cookies}', '{post-data}',
                        '{filename}', '{extension}', '{download-page-referer}', '{download-page-cookies}', '{user-agent}'
                    ], [
                        1, manager, isPrivate, referer, uri.spec, description || '', gatherCookies(uri.spec), postData,
                        fileName, extension, downloadPageReferer, downloadPageCookies, userAgent
                    ]);

                    const initFilePath = this.handleRelativePath(`{TmpD}\\${hashText(uri.spec)}.dl.properties`);
                    saveFile(initFilePath, initData);
                    (async _ => {
                        await new Promise((resolve, reject) => {
                            this.exec(FLASHGOT_PATH, initFilePath, {
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
                        // await IOUtils.remove(initFilePath, { ignoreAbsent: true });
                    })()
                }
            },
            error: console.error,
            log: console.log
        };

        window.FlashGot = FlashGot;
        await FlashGot.init();
    } else if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x") && Services.prefs.getBoolPref("userChromeJS.downloadPlus.enableFlashgotIntergention", true)) {
        const FlashGotHelper = {
            get Top () {
                return Services.wm.getMostRecentWindow('navigator:browser');
            },
            get FlashGot () {
                return this.Top.FlashGot;
            },

            get DEFAULT_MANAGER () {
                return this.FlashGot.DEFAULT_MANAGER || this.FlashGot.DOWNLOAD_MANAGERS[0];
            },

            init () {
                if (!this.FlashGot.FLASHGOT_PATH) return;
                if (!this.FlashGot.DOWNLOAD_MANAGERS.length) return;
                const $ = (id) => dialog.dialogElement(id);
                let modeGroup = $('mode');
                const createElem = (tag, attrs, children = []) => {
                    let elem = createElement(document, tag, attrs);
                    children.forEach(child => elem.appendChild(child));
                    return elem;
                };

                // Create elements with structure in one go
                let flashgotHbox = createElem('hbox', { id: 'flashgotBox' }, [
                    createElem('radio', { id: 'flashgotRadio', label: sprintf("download-through-flashgot"), accesskey: 'F' }),
                    createElem('deck', { id: 'flashgotDeck', flex: 1 }, [
                        createElem('hbox', { flex: 1, align: 'center' }, [
                            createElem('menulist', { id: 'flashgotHandler', label: sprintf('default-download-manager', this.DEFAULT_MANAGER), manager: this.DEFAULT_MANAGER, flex: 1, native: true }, [
                                createElem('menupopup', { onpopupshowing: 'FlashGotHelper.onPopupshowing(event)' })
                            ]),
                            createElem('toolbarbutton', {
                                id: 'Flashgot-Download-By-Default-Manager',
                                tooltiptext: sprintf("download-through-flashgot"),
                                class: "toolbarbutton-1 FlashGot-download",
                                accesskey: "D"
                            })
                        ])
                    ])
                ]);

                modeGroup.appendChild(flashgotHbox);

                const download = _ => {
                    const { mLauncher, mContext } = dialog;
                    let { source } = mLauncher;
                    if (source.schemeIs('blob')) {
                        source = Services.io.newURI(source.spec.slice(5));
                    }
                    this.FlashGot.download(source, {
                        manager: document.querySelector('#flashgotHandler').getAttribute('manager'),
                        fileName: document.querySelector("#locationText")?.value,
                        mLauncher,
                        isPrivate: this.Top.PrivateBrowsingUtils.isWindowPrivate(window)
                    })
                    close();
                }

                const flashGotRadio = $('flashgotRadio');
                flashGotRadio.addEventListener('dblclick', download);

                $('Flashgot-Download-By-Default-Manager').addEventListener('command', _ => {
                    $('flashgotRadio').click();
                    download();
                })

                setTimeout(() => {
                    $('normalBox')?.removeAttribute("collapsed");
                    window.sizeToContent();
                }, 10);

                $('mode').addEventListener("select", function (event) {
                    const flashGotRadio = $('flashgotRadio');
                    const rememberChoice = $('rememberChoice');
                    if (flashGotRadio && flashGotRadio.selected) {
                        rememberChoice.disabled = true;
                        rememberChoice.checked = false;
                        other = false;
                    } else {
                        rememberChoice.disabled = false;
                    }
                });

                dialog.onOK = (() => {
                    var cached_function = dialog.onOK;
                    return function () {
                        if (flashGotRadio.selected)
                            return download();
                        else
                            return cached_function.apply(this, arguments);
                    };
                })();
            },

            onPopupshowing (e) {
                let dropdown = e.target;
                dropdown.querySelectorAll('menuitem[manager]').forEach(e => e.remove());
                this.FlashGot.DOWNLOAD_MANAGERS.forEach(manager => {
                    const menuitemManager = createElement(dropdown.ownerDocument, 'menuitem', {
                        label: this.DEFAULT_MANAGER === manager ? sprintf('default-download-manager', manager) : manager,
                        manager,
                        default: this.DEFAULT_MANAGER === manager
                    });
                    menuitemManager.addEventListener('command', (event) => {
                        const { target } = event;
                        const { ownerDocument: aDoc } = target;
                        const handler = aDoc.querySelector("#flashgotHandler");
                        target.parentNode.querySelectorAll("menuitem").forEach(el => el.removeAttribute("selected"));
                        handler.setAttribute("label",
                            target.getAttribute("default") === "true" ? sprintf('default-download-manager', target.getAttribute("manager")) : target.getAttribute("manager"));
                        handler.setAttribute("manager", target.getAttribute("manager"));
                        target.setAttribute("selected", true);
                        aDoc.querySelector("#flashgotRadio").click();
                    })
                    dropdown.appendChild(menuitemManager);
                })
            }
        }
        window.FlashGotHelper = FlashGotHelper;
        FlashGotHelper.init();
    }
    function alerts (aMsg, aTitle, aCallback) {
        const callback = aCallback ? {
            observe: (subject, topic) => {
                if (topic === "alertclickcallback") {
                    aCallback.call(null);
                }
            }
        } : null;

        const alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
        alertsService.showAlertNotification(
            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiLz48cGF0aCBkPSJNMTIgMjJDNi40NzcgMjIgMiAxNy41MjMgMiAxMlM2LjQ3NyAyIDEyIDJzMTAgNC40NzcgMTAgMTAtNC40NzcgMTAtMTAgMTB6bTAtMmE4IDggMCAxIDAgMC0xNiA4IDggMCAwIDAgMCAxNnpNMTEgN2gydjJoLTJWN3ptMCA0aDJ2NmgtMnYtNnoiLz48L3N2Zz4=", aTitle || "FlashGot",
            aMsg + "", !!callback, "", callback);
    }

    function readText (aFileOrPath, encoding = "UTF-8") {
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

    function saveFile (aFileOrPath, data, encoding = "UTF-8") {
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
     * 收集 cookie 并保存到文件
     * 
     * @param {string} link 链接
     * @param {boolean} saveToFile 是否保存到文件 
     * @param {Function|string|undefined} filter Cookie 过滤器
     * @returns 
     */
    function gatherCookies (link, saveToFile = false, filter) {
        if (!link) return "";
        if (!/^https?:\/\//.test(link)) return "";
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
})(`.FlashGot-icon {
    list-style-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiLz48cGF0aCBkPSJNMTcgMTh2LTJoLjVhMy41IDMuNSAwIDEgMC0yLjUtNS45NVYxMGE2IDYgMCAxIDAtOCA1LjY1OXYyLjA4OWE4IDggMCAxIDEgOS40NTgtMTAuNjVBNS41IDUuNSAwIDEgMSAxNy41IDE4bC0uNS4wMDF6bS00LTEuOTk1aDNsLTUgNi41di00LjVIOGw1LTYuNTA1djQuNTA1eiIvPjwvc3ZnPg==);
}
.FlashGot-reload {
    list-style-image: url("chrome://global/skin/icons/reload.svg");
}
.FlashGot-about {
    list-style-image: url("chrome://global/skin/icons/help.svg");
}
    .FlashGot-download {
    list-style-image: url("chrome://browser/skin/downloads/downloads.svg");
}
#FlashGot-Btn-Popup menuitem:is([type="checkbox"], [type="radio"]):not([checked="true"]) > .menu-iconic-left > .menu-iconic-icon {
    display: flex;
}
menuseparator:not([hidden=true])+#FlashGot-DownloadManagers-Separator,
#context-media-eme-learnmore:has(~ #FlashGot-ContextMenu[hide-eme-sep=true]) {
    display: none !important;
}`);
