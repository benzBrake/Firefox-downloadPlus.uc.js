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
// @version         1.0.9
// @license         MIT License
// @compatibility   Firefox 90
// @charset         UTF-8
// @include         main
// @include         chrome://mozapps/content/downloads/unknownContentType.xhtml
// @homepageURL     https://github.com/benzBrake/FirefoxCustomize/tree/master/userChromeJS
// @note            1.0.9 merge from DownloadPlus_Fx143.uc.js
// @note            1.0.8 merge from DownloadPlus_Fx135.uc.js
// @note            1.0.7 Remove Cu.import, per Bug 1881888
// @note            1.0.6 修复 Referer 获取
// @note            1.0.5 结合 AI 优化代码
// @note            1.0.4 修复新窗口报错
// @note            1.0.3 新增右键二级菜单
// @note            1.0.2 修复弹出窗口尺寸问题，修复有时候无法显示 FlashGot 选项
// @note            1.0.1 修复总是显示为英文和按钮总是在左边的问题
// @note            1.0.0 相比 downloadPlus_ff98.uc.js 的 FlashGot 功能，新增了 FlashGot 按钮，去除了下载页面的设置默认下载器的功能
// ==/UserScript==
(async (css) => {
    const CustomizableUI = globalThis.CustomizableUI || ChromeUtils.importESModule("resource:///modules/CustomizableUI.sys.mjs").CustomizableUI;
    const Services = globalThis.Services;

    // Updated LANG object from DownloadPlus_Fx135.uc.js for better internationalization
    const LANG = {
        'zh-CN': {
            "flashgot-btn": "FlashGot",
            "download enhance click to switch default download manager": "下载增强，点击可切换默认下载工具",
            "force-reload-download-managers-list": "刷新下载工具",
            "reload-download-managers-list-finish": "读取FlashGot 支持的下载工具完成，请选择你喜欢的下载工具",
            "download-through-flashgot": "使用 FlashGot 下载",
            "download-by-default-download-manager": "使用默认工具下载",
            "no-supported-download-manager": "没有找到 FlashGot 支持的下载工具",
            "default-download-manager": "%s（默认）",
            "file not found": "文件不存在：%s",
            "about-flashgot": "关于 FlashGot",
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
                    i++;
                    if (i >= formatString.length) {
                        result += '%';
                        break;
                    }
                    switch (formatString[i]) {
                        case 's':
                            if (valueIndex < values.length) {
                                result += String(values[valueIndex]);
                                valueIndex++;
                            } else {
                                result += '%s';
                            }
                            break;
                        case 'n':
                            if (valueIndex < values.length) {
                                const num = Number(values[valueIndex]);
                                if (isNaN(num)) {
                                    result += 'NaN';
                                } else {
                                    result += num.toString();
                                }
                                valueIndex++;
                            } else {
                                result += '%n';
                            }
                            break;
                        case '%':
                            result += '%';
                            break;
                        default:
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
    };
    LANG.init();

    const versionGE = (v) => {
        return Services.vc.compare(Services.appinfo.version, v) >= 0;
    }

    const processCSS = (css) => {
        if (versionGE("143a1")) {
            css =  `#DownloadPlus-Btn { list-style-image: var(--menuitem-icon); }\n` + css.replaceAll('list-style-image', '--menuitem-icon');
        }
        return css;
    }

    const FLASHGOT_OUTPUT_ENCODING = (() => {
        switch (Services.locale.appLocaleAsBCP47) {
            case 'zh-CN': return 'GBK';
            case 'zh-TW':
            case 'zh-HK': return 'BIG5';
            default: return 'UTF-8';
        }
    })();

    if (location.href.startsWith("chrome://browser/content/browser.x")) {
        const FlashGot = {
            PREF_FLASHGOT_PATH: 'userChromeJS.downloadPlus.flashgotPath',
            PREF_DEFAULT_MANAGER: 'userChromeJS.downloadPlus.flashgotDefaultManager',
            PREF_DOWNLOAD_MANAGERS: 'userChromeJS.downloadPlus.flashgotDownloadManagers',
            FLASHGOT_FILE_STRUCTURE: `{num};{download-manager};{is-private};;\n{referer}\n{url}\n{description}\n{cookies}\n{post-data}\n{filename}\n{extension}\n{download-page-referer}\n{download-page-cookies}\n\n\n{user-agent}`,
            DOWNLOAD_MANAGERS: [],
            USERAGENT_OVERRIDES: {},
            REFERER_OVERRIDES: {
                'aliyundrive.net': 'https://www.aliyundrive.com/'
            },

            get FLASHGOT_PATH () {
                if (!this._FLASHGOT_PATH) {
                    let flashgotPref = Services.prefs.getStringPref(this.PREF_FLASHGOT_PATH, "\\chrome\\UserTools\\FlashGot.exe");
                    flashgotPref = handlePath(flashgotPref);
                    const flashgotFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
                    flashgotFile.initWithPath(flashgotPref);
                    this._FLASHGOT_PATH = flashgotFile.exists() ? flashgotFile.path : false;
                }
                return this._FLASHGOT_PATH;
            },

            get DEFAULT_MANAGER () {
                return Services.prefs.getStringPref(this.PREF_DEFAULT_MANAGER, '');
            },

            set DEFAULT_MANAGER (value) {
                Services.prefs.setStringPref(this.PREF_DEFAULT_MANAGER, value);
            },

            async init () {
                if (!this.FLASHGOT_PATH) {
                    alerts(LANG.format("file not found", Services.prefs.getStringPref(this.PREF_FLASHGOT_PATH, "\\chrome\\UserTools\\FlashGot.exe")), "error");
                    return;
                }
                const styleService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
                const styleURI = Services.io.newURI("data:text/css," + encodeURIComponent(processCSS(css)));
                if (!styleService.sheetRegistered(styleURI, styleService.AUTHOR_SHEET)) {
                    styleService.loadAndRegisterSheet(styleURI, styleService.AUTHOR_SHEET);
                }
                await this.reloadSupportedManagers();
                try {
                    CustomizableUI.createWidget({
                        id: 'FlashGot-Btn',
                        removable: true,
                        defaultArea: CustomizableUI.AREA_NAVBAR,
                        type: "custom",
                        onBuild: doc => {
                            const btn = createElement(doc, 'toolbarbutton', {
                                id: 'FlashGot-Btn',
                                label: LANG.format('flashgot-btn'),
                                tooltiptext: LANG.format('download enhance click to switch default download manager'),
                                type: 'menu',
                                class: 'toolbarbutton-1 chromeclass-toolbar-additional FlashGot-icon',
                            });
                            btn.appendChild(this.populateMenu(doc, {
                                id: 'FlashGot-Btn-Popup',
                            }));
                            btn.addEventListener('mouseover', this, false);
                            return btn;
                        }
                    });
                } catch (e) {
                    console.error("Error creating FlashGot button:", e);
                }
                this.btn = CustomizableUI.getWidget('FlashGot-Btn').forWindow(window).node;
                const contextMenu = document.getElementById('contentAreaContextMenu');
                const downloadPlusMenu = createElement(document, 'menu', {
                    id: 'FlashGot-ContextMenu',
                    label: LANG.format("download-through-flashgot"),
                    class: 'FlashGot-icon menu-iconic',
                    accesskey: 'F',
                    onclick: function (event) {
                        event.target.querySelector("#FlashGot-ContextMenuitem")?.doCommand();
                    }
                });
                downloadPlusMenu.appendChild(this.populateMenu(document, {
                    id: 'FlashGot-ContextMenu-Popup',
                }));
                contextMenu.insertBefore(downloadPlusMenu, contextMenu.querySelector('#context-media-eme-learnmore ~ menuseparator'));
                contextMenu.addEventListener('popupshowing', this, false);
                window.addEventListener("aftercustomization", this, false);
            },

            populateMenu (doc, menuObj) {
                const popup = createElement(doc, 'menupopup', menuObj);
                if (menuObj.id === 'FlashGot-ContextMenu-Popup') {
                    popup.appendChild(createElement(doc, 'menuitem', {
                        label: LANG.format('download-by-default-download-manager'),
                        id: 'FlashGot-ContextMenuitem',
                        class: 'FlashGot-icon menuitem-iconic',
                        oncommand: () => {
                            this.downloadByManager();
                        }
                    }));
                } else {
                    popup.appendChild(createElement(doc, 'menuitem', {
                        label: LANG.format('force-reload-download-managers-list'),
                        id: 'FlashGot-reload',
                        class: 'FlashGot-reload menuitem-iconic',
                        oncommand: () => {
                            this.reloadSupportedManagers(true, true, () => {
                                document.querySelector('#FlashGot-ContextMenu-Popup')?.removeAttribute("initialized");
                                document.querySelector('#FlashGot-Btn-Popup')?.removeAttribute("initialized");
                            });
                        }
                    }));
                }
                popup.appendChild(createElement(doc, 'menuseparator', {}));
                popup.appendChild(createElement(doc, 'menuseparator', {
                    id: 'FlashGot-DownloadManagers-Separator'
                }));
                popup.appendChild(createElement(doc, 'menuitem', {
                    label: LANG.format('about-flashgot'),
                    id: 'FlashGot-about',
                    class: 'FlashGot-about menuitem-iconic',
                    oncommand: function () {
                        openTrustedLinkIn("https://github.com/benzBrake/Firefox-downloadPlus.uc.js", "tab");
                    }
                }));
                popup.addEventListener('popupshowing', this, false);
                return popup;
            },

            populateDynamicItems (popup) {
                if (popup.hasAttribute("initialized")) return;
                popup.setAttribute("initialized", true);
                popup.querySelectorAll('menuitem[dynamic]').forEach(item => item.remove());
                const sep = popup.querySelector("#FlashGot-DownloadManagers-Separator");
                for (let name of this.DOWNLOAD_MANAGERS) {
                    if (name.trim() === '') continue;
                    let obj = {
                        label: name,
                        managerId: name.trim().replace(/\s+/g, '-'),
                        dynamic: true,
                    };
                    if (popup.id === "FlashGot-Btn-Popup") {
                        obj.type = 'radio';
                        obj.oncommand = () => {
                            this.DEFAULT_MANAGER = name;
                        };
                        obj.checked = this.isManagerEnabled(name);
                    } else if (popup.id === "FlashGot-ContextMenu-Popup") {
                        obj.oncommand = (event) => {
                            this.downloadByManager(name);
                        };
                        obj.class = 'downloader-item menuitem-iconic';
                    }
                    let item = createElement(popup.ownerDocument, 'menuitem', obj);
                    popup.insertBefore(item, sep);
                }
                if (!popup.querySelector("menuitem[dynamic]")) popup.removeAttribute("initialized");
            },

            isManagerEnabled (name) {
                return this.DEFAULT_MANAGER === name;
            },

            handleEvent (event) {
                const { button, type, target } = event;
                if (type === 'popupshowing') {
                    if (target.id === "FlashGot-Btn-Popup" || target.id === "FlashGot-ContextMenu-Popup") {
                        this.populateDynamicItems(target);
                    }
                    if (target.id === 'contentAreaContextMenu') {
                        let item = target.querySelector('#FlashGot-ContextMenu');
                        let node = target.querySelector('#context-media-eme-separator')?.nextElementSibling;
                        let nums = 0;
                        while (node && node.tagName !== "menuseparator") {
                            if (!node.hidden) nums++;
                            node = node.nextElementSibling;
                        }
                        target.querySelector('#context-media-eme-separator')?.setAttribute('hidden', !nums);
                        let status = [];
                        if (gContextMenu.onLink || (gContextMenu.isTextSelected && gContextMenu.onPlainTextLink)) {
                            status.push('link');
                        }
                        if (gContextMenu.onImage || gContextMenu.onCanvas || gContextMenu.onVideo || gContextMenu.onAudio) {
                            status.push('media');
                        }
                        if (gContextMenu.onTextInput) {
                            status.push('input');
                        }
                        item.setAttribute('status', status.join(' '));
                    }
                } else if (type === "mouseover") {
                    const btn = target.ownerDocument.querySelector('#FlashGot-Btn');
                    if (!btn) return;
                    const mp = btn.querySelector("#FlashGot-Btn-Popup");
                    if (!mp) return;
                    const rect = btn.getBoundingClientRect();
                    const windowWidth = target.ownerGlobal.innerWidth;
                    const windowHeight = target.ownerGlobal.innerHeight;
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;
                    if (x < windowWidth / 2 && y < windowHeight / 2) {
                        mp.removeAttribute("position");
                    } else if (x >= windowWidth / 2 && y < windowHeight / 2) {
                        mp.setAttribute("position", "after_end");
                    } else if (x >= windowWidth / 2 && y >= windowHeight / 2) {
                        mp.setAttribute("position", "before_end");
                    } else {
                        mp.setAttribute("position", "before_start");
                    }
                } else if (type === "aftercustomization") {
                    this.onAftercustomization(event);
                }
            },

            onAftercustomization (event) {
                if (!this.btn) return;
                const { btn } = this;
                let mp = btn.querySelector("#FlashGot-Btn-Popup");
                if (!mp) return;
                const rect = btn.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
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

            async reloadSupportedManagers (force = false, alert = false, callback) {
                try {
                    let prefVal = Services.prefs.getStringPref(this.PREF_DOWNLOAD_MANAGERS);
                    this.DOWNLOAD_MANAGERS = prefVal.split(",");
                } catch (e) {
                    force = true;
                }
                if (force) {
                    const resultPath = handlePath('{TmpD}\\.flashgot.dm.' + Math.random().toString(36).slice(2) + '.txt');
                    await new Promise((resolve, reject) => {
                        this.exec(this.FLASHGOT_PATH, ["-o", resultPath], {
                            processObserver: {
                                observe (subject, topic) {
                                    switch (topic) {
                                        case "process-finished":
                                            try {
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
                    this.DOWNLOAD_MANAGERS = resultString.split("\n").filter(l => l.includes("|OK")).map(l => l.replace("|OK", ""));
                    await IOUtils.remove(resultPath, { ignoreAbsent: true });
                    Services.prefs.setStringPref(this.PREF_DOWNLOAD_MANAGERS, this.DOWNLOAD_MANAGERS.join(","));
                }
                if (alert) {
                    alerts(LANG.format("reload-download-managers-list-finish"));
                }
                if (typeof callback === "function") {
                    callback(this);
                }
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
                        alerts(LANG.format("file not found", path), "error");
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

            downloadByManager (manager, url, options = {}) {
                if (!url) {
                    if (gContextMenu) {
                        if (gContextMenu.onLink) {
                            url = gContextMenu.linkURL;
                        } else if (gContextMenu.isTextSelected && gContextMenu.onPlainTextLink) {
                            try {
                                let URI = Services.uriFixup.getFixupURIInfo(gContextMenu.selectedText).fixedURI;
                                url = URI.spec;
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    } else {
                        url = gBrowser.selectedBrowser.currentURI.spec;
                    }
                }
                if (!url) return;
                const uri = Services.io.newURI(url);
                options.manager = manager;
                this.download(uri, options);
            },

            download (uri, options = {}) {
                if (!options.manager) options.manager = this.DEFAULT_MANAGER || this.DOWNLOAD_MANAGERS[0] || '';
                if (!options.manager) {
                    alerts(LANG.format("no-supported-download-manager"));
                    return;
                }
                if (uri instanceof Ci.nsIURI) {
                    const { FLASHGOT_PATH, FLASHGOT_FILE_STRUCTURE, USERAGENT_OVERRIDES, REFERER_OVERRIDES } = this;
                    let { manager, description, mBrowser, isPrivate, mLauncher, mSourceContext, fileName } = options;
                    const userAgent = (function (o, u, m, c) {
                        for (let d of Object.keys(o)) {
                            if (u.host.endsWith(d)) return o[d];
                        }
                        return m?.browsingContext?.customUserAgent || c["@mozilla.org/network/protocol;1?name=http"].getService(Ci.nsIHttpProtocolHandler).userAgent;
                    })(USERAGENT_OVERRIDES, uri, mBrowser, Cc);
                    let referer = '', postData = '', extension = '', downloadPageReferer = '', downloadPageCookies = '';
                    if (mBrowser) {
                        referer = mBrowser.currentURI.spec;
                        downloadPageReferer = options.mContentData?.referrerInfo?.originalReferrer.spec || '';
                    } else if (mLauncher) {
                        downloadPageReferer = mSourceContext.currentURI.spec;
                        downloadPageCookies = gatherCookies(downloadPageReferer);
                        fileName = fileName || mLauncher.suggestedFileName;
                        try { extension = mLauncher.MIMEInfo.primaryExtension; } catch (e) { }
                    }
                    if (downloadPageReferer) {
                        downloadPageCookies = gatherCookies(downloadPageReferer);
                    }
                    let refMatched = domainMatch(uri.host, REFERER_OVERRIDES);
                    if (refMatched) {
                        referer = refMatched;
                    }
                    let uaMatched = domainMatch(uri.host, USERAGENT_OVERRIDES);
                    if (uaMatched) {
                        userAgent = uaMatched;
                    }
                    const initData = replaceArray(FLASHGOT_FILE_STRUCTURE, [
                        '{num}', '{download-manager}', '{is-private}', '{referer}', '{url}', '{description}', '{cookies}', '{post-data}',
                        '{filename}', '{extension}', '{download-page-referer}', '{download-page-cookies}', '{user-agent}'
                    ], [
                        1, manager, isPrivate, referer, uri.spec, description || '', gatherCookies(uri.spec), postData,
                        fileName || '', extension, downloadPageReferer, downloadPageCookies, userAgent
                    ]);
                    const initFilePath = handlePath(`{TmpD}\\${hashText(uri.spec)}.dl.properties`);
                    saveFile(initFilePath, initData);
                    this.exec(FLASHGOT_PATH, initFilePath, {
                        processObserver: {
                            observe (subject, topic) {
                                switch (topic) {
                                    case "process-finished":
                                        setTimeout(() => {
                                            IOUtils.remove(initFilePath, { ignoreAbsent: true });
                                        }, 1000);
                                        break;
                                    default:
                                        console.error("Process error:", topic);
                                        break;
                                }
                            }
                        },
                    });
                }

                function domainMatch (domain, domainCollections) {
                    let isObject = typeof domainCollections === 'object', isMatch = false;
                    if (isObject && !Array.isArray(domainCollections)) {
                        isMatch = match(domain, Object.keys(domainCollections));
                        if (isMatch) {
                            return domainCollections[isMatch];
                        }
                        return;
                    }
                    return match(domain, domainCollections);
                    function match (domain, domains) {
                        for (let i = 0; i < domains.length; i++) {
                            if (domain.endsWith(domains[i])) {
                                return domains[i];
                            }
                        }
                        return false;
                    }
                }
            }
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
                if (!this.FlashGot.FLASHGOT_PATH || !this.FlashGot.DOWNLOAD_MANAGERS.length) return;
                const $ = (id) => document.querySelector(id);
                const createElem = (tag, attrs, children = []) => {
                    let elem = createElement(document, tag, attrs);
                    children.forEach(child => elem.appendChild(child));
                    return elem;
                };

                const triggerDownload = () => {
                    const { mLauncher, mContext } = dialog;
                    let { source } = mLauncher;
                    if (source.schemeIs('blob')) {
                        source = Services.io.newURI(source.spec.slice(5));
                    }
                    let mSourceContext = mContext.BrowsingContext.get(mLauncher.browsingContextId);
                    this.FlashGot.download(source, {
                        manager: $('#flashgotHandler').getAttribute('manager'),
                        fileName: $("#locationText")?.value?.replace(/[<>:"/\\|?*]/g, '_') || dialog.mLauncher.suggestedFileName,
                        mLauncher,
                        mSourceContext: mSourceContext.parent ? mSourceContext.parent : mSourceContext,
                        isPrivate: this.Top.PrivateBrowsingUtils.isWindowPrivate(window)
                    });
                    close();
                };

                let flashgotHbox = createElem('hbox', { id: 'flashgotBox' }, [
                    createElem('radio', {
                        id: 'flashgotRadio',
                        label: LANG.format("download-through-flashgot"),
                        accesskey: 'F',
                        ondblclick: triggerDownload
                    }),
                    createElem('deck', { id: 'flashgotDeck', flex: 1 }, [
                        createElem('hbox', { flex: 1, align: 'center' }, [
                            createElem('menulist', {
                                id: 'flashgotHandler',
                                label: LANG.format('default-download-manager', this.DEFAULT_MANAGER),
                                manager: this.DEFAULT_MANAGER,
                                flex: 1,
                                native: true
                            }, [
                                createElem('menupopup', {
                                    id: 'FlashGot-Handler-Popup',
                                    onpopupshowing: (event) => this.onPopupshowing(event)
                                })
                            ]),
                            createElem('toolbarbutton', {
                                id: 'Flashgot-Download-By-Default-Manager',
                                tooltiptext: LANG.format("download-through-flashgot"),
                                class: "toolbarbutton-1 FlashGot-download",
                                accesskey: "D",
                                oncommand: () => {
                                    $('#flashgotRadio').click();
                                    triggerDownload();
                                }
                            })
                        ])
                    ])
                ]);

                $('#mode').appendChild(flashgotHbox);

                $('#mode').addEventListener("select", (event) => {
                    const flashGotRadio = $('#flashgotRadio');
                    const rememberChoice = $('#rememberChoice');
                    if (flashGotRadio && flashGotRadio.selected) {
                        rememberChoice.disabled = true;
                        rememberChoice.checked = false;
                    } else {
                        rememberChoice.disabled = false;
                    }
                });

                dialog.onOK = (() => {
                    var cached_function = dialog.onOK;
                    return function () {
                        if ($('#flashgotRadio')?.selected) {
                            return triggerDownload();
                        }
                        return cached_function.apply(this, arguments);
                    };
                })();

                setTimeout(() => {
                    $('#normalBox')?.removeAttribute("collapsed");
                    window.sizeToContent();
                }, 100);
            },

            onPopupshowing (event) {
                let dropdown = event.target;
                dropdown.querySelectorAll('menuitem[manager]').forEach(e => e.remove());
                this.FlashGot.DOWNLOAD_MANAGERS.forEach(manager => {
                    const menuitemManager = createElement(dropdown.ownerDocument, 'menuitem', {
                        label: this.DEFAULT_MANAGER === manager ? LANG.format('default-download-manager', manager) : manager,
                        manager,
                        default: this.DEFAULT_MANAGER === manager
                    });
                    menuitemManager.addEventListener('command', (event) => {
                        const { target } = event;
                        const { ownerDocument: aDoc } = target;
                        const handler = aDoc.querySelector("#flashgotHandler");
                        target.parentNode.querySelectorAll("menuitem").forEach(el => el.removeAttribute("selected"));
                        handler.setAttribute("label",
                            target.getAttribute("default") === "true" ? LANG.format('default-download-manager', target.getAttribute("manager")) : target.getAttribute("manager"));
                        handler.setAttribute("manager", target.getAttribute("manager"));
                        target.setAttribute("selected", true);
                        aDoc.querySelector("#flashgotRadio").click();
                    });
                    dropdown.appendChild(menuitemManager);
                });
            }
        };

        window.FlashGotHelper = FlashGotHelper;
        FlashGotHelper.init();
    }

    function createElement (doc, tag, attrs = {}, children = []) {
        let elem = doc.createXULElement(tag);
        Object.keys(attrs).forEach(key => {
            if (key.startsWith('on') && typeof attrs[key] === 'function') {
                elem.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
            } else {
                elem.setAttribute(key, attrs[key]);
            }
        });
        if (['menu', 'menuitem'].includes(tag)) elem.classList.add(tag + '-iconic');
        children.forEach(child => elem.appendChild(child));
        return elem;
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
            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiLz48cGF0aCBkPSJNMTIgMjJDNi40NzcgMjIgMiAxNy41MjMgMiAxMlM2LjQ3NyAyIDEyIDJzMTAgNC40NzcgMTAgMTAtNC40NzcgMTAtMTAgMTB6bTAtMmE4IDggMCAxIDAgMC0xNiA8IDggMCAwIDAgMCAxNnpNMTEgN2gydjJoLTJWN3ptMCA0aDJ2NmgtMnYtNnoiLz48L3N2Zz4=",
            aTitle || "FlashGot",
            aMsg + "", !!callback, "", callback);
    }

    function readText (aFileOrPath, encoding = "UTF-8") {
        encoding || (encoding = "UTF-8");
        var aFile;
        if (typeof aFileOrPath == "string") {
            aFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
            aFile.initWithPath(aFileOrPath);
        } else {
            aFile = aFileOrPath;
        }
        if (aFile.exists()) {
            let stream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
            stream.init(aFile, 0x01, 0, 0);
            let cvstream = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
            cvstream.init(stream, encoding, 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
            let content = '', data = {};
            while (cvstream.readString(4096, data)) {
                content += data.value;
            }
            cvstream.close();
            return content.replace(/\r\n?/g, '\n');
        }
        return "";
    }

    function saveFile (aFileOrPath, data, encoding = "UTF-8") {
        encoding || (encoding = "UTF-8");
        var aFile;
        if (typeof aFileOrPath == "string") {
            aFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
            aFile.initWithPath(aFileOrPath);
        } else {
            aFile = aFileOrPath;
        }
        var suConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
        suConverter.charset = encoding;
        data = suConverter.ConvertFromUnicode(data);
        var foStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
        foStream.init(aFile, 0x02 | 0x08 | 0x20, 0o666, 0);
        foStream.write(data, data.length);
        foStream.close();
    }

    function handlePath (path) {
        if (typeof path !== "string") throw new Error("Path must be a string");
        path = path.replace(/{\w*}/g, function (...matches) {
            let match = matches[0];
            try {
                return Services.dirsvc.get(match.slice(1, -1), Ci.nsIFile).path;
            } catch (e) {
                throw new Error("Invalid path variable: " + match);
            }
        });
        if (AppConstants.platform === "win") {
            path = path.replace(/\//g, "\\");
            if (path.startsWith("\\")) {
                let f = Services.dirsvc.get("ProfD", Ci.nsIFile);
                f.appendRelativePath(path.slice(1));
                path = f.path;
            }
        } else {
            path = path.replace(/\\/g, "/");
            if (/^\w/.test(path)) {
                let f = Services.dirsvc.get("ProfD", Ci.nsIFile);
                f.appendRelativePath(path.slice(1));
                path = f.path;
            }
        }
        return path;
    }

    function hashText (text, type) {
        if (!(typeof text == 'string' || text instanceof String)) {
            text = "";
        }
        let data = new TextEncoder("utf-8").encode(text);
        if (Ci.nsICryptoHash[type]) {
            type = Ci.nsICryptoHash[type];
        } else {
            type = 2;
        }
        var hasher = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
        hasher.init(type);
        hasher.update(data, data.length);
        var hash = hasher.finish(false);
        function toHexString (charCode) {
            return ("0" + charCode.toString(16)).slice(-2);
        }
        return Array.from(hash, (c, i) => toHexString(hash.charCodeAt(i))).join("");
    }

    function replaceArray (replaceString, find, replace) {
        var regex;
        for (var i = 0; i < find.length; i++) {
            regex = new RegExp(find[i], "g");
            replaceString = replaceString.replace(regex, replace[i]);
        }
        return replaceString;
    }

    function gatherCookies (link, saveToFile = false, filter) {
        if (!link) return "";
        if (!/^https?:\/\//.test(link)) return "";
        const uri = Services.io.newURI(link, null, null);
        let cookies = Services.cookies.getCookiesFromHost(uri.host, {});
        const cookieSavePath = handlePath("{TmpD}");
        if (filter) cookies = cookies.filter(cookie => filter.includes(cookie.name));
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
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABd0lEQVQ4T5WTv0/CQBzFXy22Axh+NHXqYJjAYggd2JTYNrK5OTg5GTf/Dv0jHEjUzdnEUHbD1KQaEwYTnAwlhiiIxub0jvCjFCjeeN/3Pn33eschZFWrVZJOpxGPxyFJEjctD2xMCqjZMIzRluu6kGXZ5wkAqIk6kskkNE3zfZAC6JqE+ADUXCqVwPM8E3JcMCAhBO12ewQZKai5UCgglUotbGUIGCZhgOmzhhXreR4sy0K5XB5kpABd18N8vnmtVoNpmmNAPp//F8C27TGgXq+z5judzlKQSCQCVVVZkb6aHxyHCKKIt/MDH+jn2cF334N7coGsVmQzNZdj3sB/sg6zRFeaTETWFHitBj5egNezR2QymfCb2DJBEtkV8OuDEA2bYOOqD1EUZ97awGav1yPvR1HIO38Jvjh8OgTN03tsasXlALdGjOzud7EaA+6uo9iqPEFRlLlvJjCggL3jLtwbIHE5P/qw5Zkl0uF2xYYgCAtfK9X9AmZ+hRG+dHY+AAAAAElFTkSuQmCC');
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
#FlashGot-ContextMenu {
    display: none;
}
#FlashGot-ContextMenu[status~="link"],
#FlashGot-ContextMenu[status~="media"] {
    display: flex;
}
.downloader-item[managerId="BitComet"] {
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADcUlEQVQ4T12Ta2hbZQCGn+/kpLltS9J7adps7eqlK047GF3qZUwHOhCpxWyCOH9s+qOgrIMIoqN4+aFQhxX2Q4cIrkgbBoKYKmrLZG02sa51W2fXa2zWZs3aNWkuTU5yjsfIoPr9+fh+vM/38vK+gv+die6uFkMqcsJaZPaaXPVoGmzcuML8xEx/ssh4+lDfT5c2S8S9R6Cny3VfIt1tqizxOj0HsOxsBFGEEBqqmiMdmmL6q89YGL7Yr7h3nWw/2xv+R1sADPX4XPV504j14Udq7Huf1HVmMBgKbJHPFu5kNMSWskpCgW8YP3N6IV9a7WnvHQgXABPvvd5X/uh+r6P1ANr6Opi3ISy2glBJxSgyWcjMjqEsTmNqfoLQ+X4ufX6m/2hw7rAY8h1raaguD1a+2gmxNd2ugqF8B0p0UgcVQy5JLn4bc00TuR/PEYuv43zqOX5+o4PIcmKfuPrm0b7atnavbXsjInmXnM2OsDvQxr9DczejSSq5a99j8bxC5uYwpqlRltI5FFMVgz2f+kX47Re1io63yEcXkCXIuxpITF3Anlokt2M/GGWkyQDxbbVYK5uQLvaS+vMK6sHjjLxzCnHn3SOa/dkjelgKqbgeVGsbK/7XKKlvJuXYpQdqwHx7lLWVCM6n3yf2tQ/LSpR1Ry2Xz/2AiH9wWJNrSilybyeTWYIH9ui/fIixbg9Joxth0JBZQrkWxNr2BYmBT7BE5ojNhpiZ1RBrvlZNkiMYXXZU9260UivG8CCivB7FUo2QdUAmDvNBsntPwfQohrEAybkovy0XIyZPNPZVaXe8JucGiqcdSZ1Gzi4inE7yljodoCJlMhC+zEbdy0ixFPIvXxKaz3Jhtd4vho41tzSY5oLFjg2kxw8hZcf09iTAUYxmrQbdgUgnkJYmyJY9g5rIkR8ZYPAPmM09uK9QpGDHzr4Gy5LX+lAd8paZQoGkqiryBqvuwKLz9GxWo+S37ib5V5wbv84xEi7z+75d8BYA533Pu+5Xr4+U2G7VlLlVvYUZtK1WVJsuNphgXQcoMsqajfGrWUYjzgVH9WOelz7q/bfK9yAV4np3hXzLW1mawewEzSwjJH1MGyrLy/D7TZmJ1Qp/aZOn83jXpjFtnmfA19oicoudxcbYC2o+QTYPac3O7F2zP22s/fjk2eH/zPlvFuZthlH+/JwAAAAASUVORK5CYII=');
}
.downloader-item[managerId="Download-Accelerator-Manager"] {
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACwUlEQVQ4T22TbUhTYRTH/8/clDmdZk7WarbIrcJSCiyvFRVIS8MoJRA/BFHRC/QClQrSJ/ODfrCgD1GwbyZFIJGoTSIkRG30QsZ62bSmk5k2JOfLWO7e27n3QbPycuHhnpff+Z/znMuwwuN0Ovs8Ho+QZTJBlOKYnAxDEIR+t9td9G84W25QEoPDL4Vr16tx5NhprMowqe7v4wF0PWlG8y0XrPbiv0BLAIfDMVomjFgbmlsh6gTok2TERY7XahmiMQ0SZh6grvYq2gccQZ/Pl634VIBSOW+NW2i6eQli+knMzAPpKcB8jPOTk4DpOYYUPUEmalFd34HBcaeqRI3YZGNyzZlEHDjaguhCMowGQKOhqr+4An0SgywDMwSJR7/C030BjS6GLwGZMaX68UK3cKrCBpjr4B+TYM8mLiWEI1xBplHRyjAUBHLWkiN4Ga6n83g84OxnqSkG+XPbHCxmAmSewKBPRp6DEiguNMUBlgw66f3gZ9hm19BUmxAKz2JzuQFsdbpOfnZ3AQk6I9KsFfASIDeHV5yY4mMyZ/Dz4zC1uzGOyEgLJEnEofO6PwANgdPMRXjtNaBgq6KAIRjmidYsPos3XobtjglEJt9BIoUqYKkFpYo2FZ2v1qN0L5/BJ+pZAWyxqge6emWUFPgAMUbtgbewNMQyXuXhi2RUltAdSgyDAW7Ls1G2RkZrx09UFcdUm6sdfIjKh83C5BtnZWipjfd+qLdg0GsR/EHXR/5sk4y5aBz+URn5diAuAfX3GAIhukYFoKjIt7iFxitAZBZ47gHK9wNvh7iCHTTUth6geCdgJHE1t6lQaNkiKUHqKhf6rA0XQVKBqlLA+40DcjeQrZNsh4G6O/h/lXkYVzI21C2cq5QxPQ3s28XtPf1UOQ24/4hhnf3gyj/TImQR1NfXKyQwvsuilIii3XtW/J1/A3isFeq04ej9AAAAAElFTkSuQmCC');
}
.downloader-item[managerId="EagleGet"] {
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADV0lEQVQ4T11TXWxTZRh+ztdzuq6tHbSDAd2WUmFotkAnCnHTKSWoGQI3DjXq1TK2xAsXvYAEYwzRkBiyCAE2QQI3u8CMMILGJSaQDWEMwhxE1nVja9c6fja6tuv56fmt3zlkCnzJe/HlzfN8z/e+z8PguePf1h3iSspb7S5XmNgdAbOtyVJcExYuqQupn2b+2D3yNIRZvJS/3lFs879y2O2vbCY2G5HmHkHOZqy2Y+lSFPvKoGuKwc8kTun3R774Z/BLyexZBOVNHcX1NfV9tRuWN7hZHSQzB00SkeMV3H8o4G40jb/Gc/CsrYG3qhoLidiAmrjxnkliEezaP3jiSFtFC0EBuq7DMIznf4bZlIj2b65gSvRi5aY3kJmKnpw+F97DBBq7Qwf3Ndz6e/gekR7PgbXpmE6kaAnY/m4VPm0KYfj2FNZXV8J2/Wt0982i3/khHhSHjUxkZCPzwbc3O39uX9smKxoFM5YCXhDQvrcX8biM1uY6fH/od5z98WXUxA6BGLql7k5+CT4bOtDFdJybiLa8s6KqUChY0s3SNA2SJGF+Pg2TeNnDs3Dc68NkmmDycRFeKhXh8DrRNHJsnPmlPym//5rPvkhgKjBLVVXwPI9YLIbI5V78dtOJoTEWfJ7A51GwfmsQycKbCtNzZUbesanUbr68OEATHIlE0D9wGxd/fYBYUoOoFKxiWA6EY1H2aj1cZasU5uiFeLS10V9lSmYYxpJ+7doges5HcXkgDbudAy+qSGUVCmb/I6gMN4IQMs589N1wZ+fnq9ui0QkEgwH8eXUIXWfGMRbl4XJyEAQF2axMpWsW2CRh3S9gzc7dyCXiXXSNp0NHvqq9VeFjyOzsPH44PmqtEHSoRRzBQi6PNCXIy3T6FExYG5bXbkbJi+uMzOjgRstI2/dePXHgY0/LwTNx3BmahKHpcDo4KLIKgco3HSmYCmwEnsAa+Ou2IBObODnd8/aeJ1amOVhd91Yf8a5qECfvYm50DMtKWCo9D1FSoSg6BJVgCbVxafUG5GYSA0rs+v9WXiRxBjcf9gYrmulDhBVTyD5KUR8YIC4POO9KGiaDhmn6lJocfjZMTxvfv+10yL1iXavb5w6DKwroegGqIMfz2eylfCpJ4/zJM3H+F/BksCbdxY7YAAAAAElFTkSuQmCC');
}
.downloader-item[managerId="FlareGet"] {
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADLklEQVQ4T6WTW0iUeRjGn/98M85BZ75vxmZq/BzTHPOc5WSaWClu0LawGy3ssrGFDRVWlBVtUBfddOFNQVEYdLAgomKEqHRBd9gs0qDaZdZGbLdxtIPmpI5z+ObsfP9mhYKC6KL39uX5vQ8vz0PwlUM+p79bXy9NT5vc8Wx6pnOJuXC5VKlZ53Q8dASoaP9jccOwzWZL/q/9CEApJW0NhvQqUaNlLY22f33B3ECaSsVKoM73DmOBLhNExyM4+cr7evSf47U97taPAH2r8ptCyfj4VPWPl+dZm42E4TDhCUCtkSMijSPafgJ1A11+3UITS/Tz8cTxdMsHwKX6XEUVZxy6zy8TfWu2LrIU8yl/qdNKOQzpUsSVDB57wui+0dWz8dZv59YsK+uYlGfYySmLNscgUdJcPr9Rlld56eEv+1HAqeD3hqHVsWDVCmiQgDvlJJaZgbv2QfRfu3L4NNO7mytaOkL2mDP0zQU5HSrLN9JOcVGt7FcrBOd/4HRqaDNZaFUMTLIQno24ITx3oZ8uhvPMkeBBU/gYl8WL5JBZl91SveSlYqEZR2OrSUhvQHamHLGIH4rJYZRTH0pTPzCQOJiBLuzNakHvLZt4yvj8/NNA4ADpbizeUG2puZmIeLHBVTHGW6r54iI9Mhx3UBiegjHloMBkBHU9QGTchSauBa57t3FQ4ajY5Xw7QB40rW8uMfFnZ14MBusGyq8bc/K2f7fpJ0i1DDx9nSgbsuNnfQTE9wKvIxJsxj64H3WMBse68+ZycGF17sUfamqsoneEHuqdaP9d8a21uLKKmKQ+7Ez0oFQqYNb3FiP+CEaZLOybKEEanToy6uxsnQPc27b+askCdpM4MYS4N4T+sBx+qFDLiTBGBZB4Aq1javQJMtSzUXQwJU/Emb/qXC5XbA5wdmU231BVYdcyQpFEpMBsAjQQSlkOQxJLom1ajXZaAaVslpoxfnNYUGwfHOz2vq/AXJCOlaq/X6FRtRWq0vhEkmI6PivMk8mY/ig5eV63NkpEOi1EPH/+fb9r6NPufEjiznJWy0Gcn4zTsgZNeuUb4IL1scf9pbJ+to1fEr7fvwOS4EAIdr4rTAAAAABJRU5ErkJggg==');
}
.downloader-item[managerId="Free-Download-Manager"] {
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACqElEQVQ4T42STUhUURTH//e9NzM6M45jSqFI0a5FtAn6WKTRSnAIUsayDzVnaCVElohETS2CNiFCtIxoUZBIChXJtFLUooVSkNiQJYM6kvgxn+/NzL2vc9/gJy66cN+97957fvz/5xxmP3vjCDf5IxM4BzAN/zXMOSbMEB99PsDU2sCQaeK8SR9TEIb9F4EemT+RzTcxpTaQpEBXZUUZLtQcR6nbCQnba2yeFjb5jJHpIEBQF5w7bl6sQ29HkyVA3ksxckrWnivAF2JLtzcBD4ONuN9ajzw3keUCnKJksFSzAdgAFxQyHlvaBngQbCCAD2kjj8fvJzD5Nw3FZrdyYj1ntNnIj1wZ43oisaVAAu61+JDI5OB/8QnhlAvM5YHCTHg0E6s5wmhUJEWhSQCFcSTXtgECDbhLgCQBml6NIJwrByspg1cTeHLMg9HFON4sGkjbnVA01bKgJJZ3AnquSQs5dL37inHDDcXphkcV6DtRiWq3HYOzy+iLrGNGOMBsDq7GdwG6r/qQywusZ7IwhPReqInbppFiZv1F1lJ4OrOMoVVwPZXcUhAiC91XCgBF+rTKV6hAliojZFUIoBLl89w8OiZjPGqwnYCuyz4YOY4vv6KIpXSyqcCuKjh5qAolxUWUHx0DU9N4Nr2AqLeaq+YuwJ1mH1JGFtdfhzG8rkItdmGfDeivO0oydPSOfcOHNeqTAwfB3F6O+AopqAnMCiEOSwudl2QSDbS9HcewqIDiKYObquUvSWMk8gcRrRRKRRVQVCztJJWl+Ram1rS1U+OFQu2N1bdIQUYqGJzAR+wngJcSR/71lNX8zOmkXrBZJyyTeOkZG+thfr9f7Y/aT3U2+0631p9x6Nk8usJTGEE5NBlAObAGLUIml4hM13+7fnwfjvcGV/4BtgR56y5SI9QAAAAASUVORK5CYII=');
}
.downloader-item[managerId="Internet-Download-Manager"] {
    list-style-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADRUlEQVQ4T6WTf2wTZRzGn/e9u/687my3MVgZRegGOoEhS9hYQFGqKBH+ARPQ6B8zkSjEQAwhBnUxxhBiwB+I6AwYCI5MGYSYGEJIzAiQJSwBQxldSdfa9Xd37dq73W6963mQiEaJ//j9503evM/nyfvk+xD8zyH/pT99urdDY+q3lvSZQEzmQ+WJscEje97+ytTM/Kl7KMAwDLL/cPe+Zf5nt3sErdEl+JAsl/BjuBVKTs6x4m9v+dhXBnp6SPVfgGCwx/Jpb3Dj/Ceun1reuMriqbHD3dSMMr8JZ4NNSERsKMbGdMR+2PHzsQ+OPgD0938jPKJe3EKV8qb+dHR1kz8pzHN3YW37RjS4JYjGMvQNezB8ezmK8STE8C/K1OjJtvuAgYHXWoRc+oTr0tjKGylavfl8grq9FDWCC2s72uD3rMKNyWdwfmgJomGglAqhEL0COfzTx6Tnu25PR92tQffRbOudMAkeczJi64bMamEhBWezYE5DIyTyCeKFpzEeVVDKJSDnTUBsCFp26BzZfqbrozfU5PvyQaK9GSmuEZ2ezZ1rpN32uTUA5wWhs1DU9kCrGJiWRajlDKbECMqJYTByuI+8eqFj/F1X2isfYNX9caFlKDXxpHtO7Vmu2YLyegKh4ACXXAQmXwMyqcJQwlClUajFPCZFdhdZcX69vnvBHdqW0zF5qeHX76/M7L2QZA8rTtouvzQM24scCDhQ0Q4+X4H1rorpoAY95kpoor2TrDtwqJQP9Lpedsp4rlqFLWvNXr5uyX/bN/F4aEkGxEdhNSGgBqCbiVfNM2OA3rWU/PFF+0hn4L3P7IGWdzJdp+BqDOMxCnjNd5nfKzhzLgtZrIBtpmAfZaCFqtBGqmCzbJ7GuUOGRHsJz8+uX9y+8+DsFYFtii9C5blBaM4i2IoDqavXkE4NwiiZxhHAMBfYYdgvG1nmQykvXTN9pu/vAc/z9e66pzYvaH2921a7eCkYK0cqup4wvi6OWr6srY4ARKKSVXZ8oaX1I4qipE3ZvQ+Z+fw1nMNRV8cwnN/Oe2fpM4UC9cnzSgvTx9kR600k2b2yTR5EElN/L+DDyvTgbuULS72hXHSXGqx8brqO34vwn+39A9u2aguAlsZkAAAAAElFTkSuQmCC");
}
.downloader-item[managerId="Mass-Downloader"] {
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABhUlEQVQ4T72SzUsCQRjGH02LLgXRsYj6DyoIOlVEx7BDx+jQITqG4X/QoUMJ4knCCOkQfRBSUZCUCVGnoHNgipJJWu26yX7Nvu0Imp8oHRoYmJ15398+88xjQYvjKnNEM73zlurymo16vMv3fcozCTld8DEoyCopJIUYPCOnK00B68/LpLA8JFWAIulgqgFZVHHtj4YTwfhUUwBXtHQxTbm0jIeTZLhcYV1AIOmmxT5nDbjfMXDDm3lTOaSi8PbjjPyRTQTmwi0p46BSIW8WtU8c3vsxPjyBLlsPus1ps9phgKAyGd9MxKsShWvIU+orLHYSG0RgpstfELQsdNLQYe2E3dIOq7UNZJ7ChMimmduuUMG84jUKgNWnWTI0A0w3oOZ1aHkG/m0YMAG/OplGiOzFagEcsnA8Sbqs4+4gUeF0vVzUKCgWObxj9BhKV/yhWVDrPlf1U3GI+2WNnINbf4ty8G2XVJIhMdGnGQoyagopIQ7v6Pk/RZkbrOS01qLcyLRGUf4BUtDoEQLpHdwAAAAASUVORK5CYII=');
}
.downloader-item[managerId="Jdownloader"] {
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADhElEQVQ4T12Ta2hbBRTH//fevN+5aR4djQup9GHItAsTV2GUqu2gBZlTJyqFsq44oXNitSIKUYbCsKiruA9KfVCdHVgcswNlQsSWIWQ6terWJVlTtzQxaXKbx703uS/TSIvswDkfDuf8zuE8CNwmejO9lzLoH9dotcFHutX2E4eta99+n7nw0sf8p5lMpnJ7PLHl8Hg8TlFvmVZpdYManQoGcw20h8UOUo/pcRqnZpKZ32PV47PzmS//D2kATPVkb6dxIdSjbUunDODKJCRRhr+jiF8iBI72t+Cxbh5vf35DGep2PX/38JX3tiANgMPfcf7pMWrw0QEr5i+RiMdVSMa0YFI8KgUWZopFZLoLf16K4r4ulxB66ufdf8XLS5u5hJ6m9/YNORbHjzqJ1TUKKrWEUlXB2XM0Er8p4Jl1CCyLyRd3offOGzBbtNh/5MrZxcuFQw2Azet9540P6OO9uy3IMgoWr7nww08tyK3WUM7eApdfR61SQn93MybHFCi5IgYmljmm5LDHYrEq0dTmv7jvoO4Bj8uKbKkVaaajUZUvMqjk0uAKmx1U4LKxWPgkhJvRa+gLx5HPksFaubxE2He2Lty1T30/w3hhcdrBcjSkKodqeQMck0etVIRQ5RH0SfjsRCdyiQQGw0kUU9IelmWjhMnjPWOgbU+421QwWw3Irlkh1lCvWv5P+SoUgcUXJ31wW3RoUmXx0HhSuRljd1QqlTRhoJtGNGb7hx0hGQcPabHByvhunsLKH6o6SIAkVHF40IKxITcSV3l0tnIYfT2x9M3FbLAxRLfbbWRJfdx5h+Tu2U/AYqRQqshIr4m4lVDgpox4/xU//kkwmJor4tRrdnw9mzo5Orky0QBsGoPN8TBlMM85miVyV0iE1URCqMkwiWoc6fdBKvF49fQqzGYNPnrLj2KssLye5JYzBeXH7VM20s5hUmc8bTBL2vb2CvY0m9AbsNVnIOHdr/J4ZsiFvgebIBVrqKZYcGm+OjGbb98GBAIBTYZhhru84ssD96h3mgwU8Wv9FuaiilLitUWKlC+88KSlPHLANiJkWCIaLU8dePP6sW2AoiiE0+fzyIIcVFNyQBDRIiuUGpBzBKm6DlJcslD5XE+7/tnRfudzx6YS915eqV3dBmw9RzgcJmdmZtT1HVOSJBF6vV7y+XxiJBIRN2M2O91IJ5x/57gUQUD5FyLSlbNVZqIRAAAAAElFTkSuQmCC');
}
.downloader-item[managerId="Thunder"] {
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABUUlEQVQ4T2NkAAL/5p9bGRgYvUBs4sH/bRtr2b0ZydMMs+b/NqABv/4Ta6uWPAODpxEzw4sP/xmW7v8H1gY2QFmSgeHuc9zGgDRG2TEz6MgzMTx6/Z8hb+YfuGK4C/SVGBlyfJgZRPkYGebs+sOw5dR/BkZGBobGaGYGPQUmuIYZ2/8w7DiLcDSKF0A2tcWyghXvvfSXwVaLmYGNBdVlSZN+M7z7hBDDCIMNNRADsIG+jX8YDl1GDTKSDJi85Q/D3gsUGABz1dm7/xjWHvvLcO0hNBaQnRvrzMQQbMmM4YPbz/4xnL7zn+Hn7/8M20//Z/gFjQis6SDLh4nBzQBhSNXi32DbsAGcCUlVmoEhxoGZQV+RieHyg38MtUv+kmYATLU2MGpbgVFbsfA3w43HmGYQlZRB6cPHlJmhaw2mK4jOTCBDMMMBmJlAjiIvR0KyMwB0zo+VR+VNTAAAAABJRU5ErkJggg==');
}
menuseparator:not([hidden=true])+#FlashGot-DownloadManagers-Separator,
#context-media-eme-learnmore:has(~ #FlashGot-ContextMenu[hide-eme-sep=true]) {
    display: none !important;
}`);