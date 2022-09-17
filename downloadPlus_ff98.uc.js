// ==UserScript==
// @name            DownloadPlus_ff98.uc.js
// @description     修改整合自（w13998686967、ywzhaiqi、黒仪大螃蟹、Alice0775、紫云飞），已重写代码。
// 相关 about:config 选项
// userChromeJS.DownloadPlus.enableRemoveFromDiskMenuitem 启用从硬盘删除右键菜单
// userChromeJS.downloadPlus.enableFlashgotIntergention 启用 Flashgot 集成
// userChromeJS.downloadPlus.flashgotPath Flashgot可执行文件路径
// userChromeJS.downloadPlus.flashgotManagers 下载器列表缓存（一般不需要修改)
// userChromeJS.downloadPlus.flashgotDefaultManager 默认第三方下载器（一般不需要修改）
// userChromeJS.downloadPlus.enableRename 下载对话框启用改名功能
// userChromeJS.downloadPlus.enableDoubleClickToCopyLink 下载对话框双击复制链接
// userChromeJS.downloadPlus.enableSaveAndOpen 下载对话框启用保存并打开
// userChromeJS.downloadPlus.enableSaveAs 下载对话框启用另存为
// userChromeJS.downloadPlus.enableSaveTo 下载对话框启用保存到
// userChromeJS.downloadPlus.enableDownloadNotice 启用下载通知音
// userChromeJS.downloadPlus.notice.DL_START 下载开始通知音路径
// userChromeJS.downloadPlus.notice.DL_DONE 下载成功通知音路径
// userChromeJS.downloadPlus.notice.DL_CANCEL 下载取消通知音
// userChromeJS.downloadPlus.notice.DL_FAILED 下载失败通知音路径
// @author          Ryan
// @include         main
// @include         chrome://browser/content/places/places.xhtml
// @include         chrome://browser/content/places/places.xul
// @include         chrome://mozapps/content/downloads/unknownContentType.xhtml
// @include         chrome://mozapps/content/downloads/unknownContentType.xul
// @version         0.2.0
// @compatibility   Firefox 72
// @homepage        https://github.com/benzBrake/FirefoxCustomize
// @note            20220917 重构脚本
// @note            20220730 修复右键菜单 BUG 独立成一个 REPO，移除 osfile_async_front.jsm 依赖，版本号从 0.1.0 起跳
// ==/UserScript==
(function (globalDebug) {
    if (window.DownloadPlus) return;
    let { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;
    const Services = globalThis.Services || Cu.import("resource://gre/modules/Services.jsm").Services;

    const LANG = {
        'zh-CN': {
            "remove from disk": "从硬盘删除",
            "file not found": "文件未找到 %s",
            "use flashgot to download": "FlashGot",
            "dowload this link by flashGot": "FlashGot 下载此链接",
            "download all links by flashgot": "FlashGot 下载所有链接",
            "about download plus": "关于 downloadPlus",
            "original name": "默认编码: ",
            "encoding convert tooltip": "点击转换编码",
            "complete link": "链接：",
            "dobule click to copy link": "双击复制链接",
            "default download manager": "（默认）",
            "download by default download manager": "FlashGot 默认",
            "force reload download managers list": "重新读取下载工具列表",
            "reloading download managers list": "正在重新读取下载工具列表，请稍后！",
            "set to default download manger": "设置 %s 为默认下载器",
            "save and open": "保存并打开",
            "save as": "另存为",
            "save to": "保存到",
            "desktop": "桌面",
            "disk %s": "%s 盘",
            "button aria2": "Aria2",
        }
    }

    const _LOCALE = LANG.hasOwnProperty(Services.locale.appLocaleAsBCP47) ? Services.locale.appLocaleAsBCP47 : 'zh-CN';
    const TopWindow = Services.wm.getMostRecentWindow("navigator:browser");

    // 快捷保存列表
    // need to implement read by shell32.dll and support linux
    const QUICK_SAVE_LIST = [
        [Services.dirsvc.get('Desk', Ci.nsIFile).path, $L("desktop")],
        ["C:\\", $L("disk %s", "C")],
        ["D:\\", $L("disk %s", "D")],
        ["E:\\", $L("disk %s", "E")],
        ["F:\\", $L("disk %s", "F")]
    ];

    var DownloadPlus = {
        modules: {},
        paths: {},
        $L: $L,
        get appVersion() {
            delete this.appVersion;
            return this.appVersion = Services.appinfo.version.split(".")[0];
        },
        get sss() {
            delete this.sss;
            return this.sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
        },
        get topWin() {
            return Services.wm.getMostRecentWindow("navigator:browser");
        },
        init(win) {
            win || (win = window);
            ["GreD", "ProfD", "ProfLD", "UChrm", "TmpD", "Home", "Desk", "Favs", "LocalAppData"].forEach(key => {
                var path = Services.dirsvc.get(key, Ci.nsIFile);
                this.paths[key] = path.path;
            });
            Object.values(this.modules).forEach(module => {
                if (!module.hasOwnProperty('PREF_ENABLED') || this.prefs.get(module.PREF_ENABLED, true)) {
                    if (typeof module.init === "function")
                        module.init(win.document, win, win.location, this);
                }
            });
        },
        prefs: {
            get: function (prefPath, defaultValue, setDefaultValueIfUndefined) {
                const sPrefs = Services.prefs;
                setDefaultValueIfUndefined = setDefaultValueIfUndefined || false;
                try {
                    switch (sPrefs.getPrefType(prefPath)) {
                        case 0:
                            return defaultValue;
                        case 32:
                            return sPrefs.getStringPref(prefPath);
                        case 64:
                            return sPrefs.getIntPref(prefPath);
                        case 128:
                            return sPrefs.getBoolPref(prefPath);
                    }
                } catch (ex) {
                    if (setDefaultValueIfUndefined && typeof defaultValue !== undefined) this.set(prefPath, defaultValue);
                    return defaultValue;
                }
                return
            }, getType: function (prefPath) {
                const sPrefs = Services.prefs;
                const map = {
                    0: undefined, 32: 'string', 64: 'int', 128: 'boolean'
                }
                try {
                    return map[sPrefs.getPrefType(prefPath)];
                } catch (ex) {
                    return map[0];
                }
            }, set: function (prefPath, value) {
                const sPrefs = Services.prefs;
                switch (typeof value) {
                    case 'string':
                        return sPrefs.setCharPref(prefPath, value) || value;
                    case 'number':
                        return sPrefs.setIntPref(prefPath, value) || value;
                    case 'boolean':
                        return sPrefs.setBoolPref(prefPath, value) || value;
                }
                return;
            }, addListener: (a, b) => {
                let o = (q, w, e) => (b(cPref.get(e), e));
                Services.prefs.addObserver(a, o);
                return { pref: a, observer: o }
            }, removeListener: (a) => (Services.prefs.removeObserver(a.pref, a.observer))
        },
        copyText: function (aText) {
            Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(aText);
        },
        handleRelativePath: function (path, parentPath) {
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
                ["GreD", "ProfD", "ProfLD", "UChrm", "TmpD", "Home", "Desk", "Favs", "LocalAppData"].forEach(key => {
                    if (path.includes("{" + key + "}")) {
                        path = path.replace("{" + key + "}", this.paths[key] || "");
                        handled = true;
                    }
                })
                if (!handled) {
                    path = path.replace(/\//g, '\\').toLocaleLowerCase();
                    if (/^(\\)/.test(path)) {
                        if (!parentPath) {
                            parentPath = Cc['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile).path;
                        }
                        path = parentPath + path;
                        path = path.replace("\\\\", "\\");
                    }
                }
                return path;
            }
        },
        exec: function (path, arg) {
            var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
            var process = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
            try {
                var a;
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
                    DownloadPlus.alert($L("file not found", path), "error");
                    this.error($L("file not found", path));
                    return;
                }

                if (file.isExecutable()) {
                    process.init(file);
                    process.runw(false, a, a.length);
                } else {
                    file.launch();
                }
            } catch (e) {
                this.error(e);
            }
        },
        alert: function (aMsg, aTitle, aCallback) {
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
        },
        error: TopWindow.console.error,
        log: TopWindow.console.log
    }

    DownloadPlus.modules.addStyle = {
        init(doc, win, location, parent) {
            if (!this.STYLE_DOWNLOADS_POPUP) {
                this.STYLE_DOWNLOADS_POPUP = addStyle(`
                #location {
                    padding: 3px 0;
                }
                #location,
                #locationHbox {
                    height: 22px;
                }
                #locationText {
                    border: 1px solid var(--in-content-box-border-color, ThreeDDarkShadow);
                    padding-inline: 5px;
                    flex: 1;
                    appearance: none;
                    padding-block: 2px;
                    margin: 0;
                }
                #locationHbox {
                    display: flex;
                }
                #locationHbox[hidden="true"] {
                    visibility: collapse;
                }
                #encodingConvertButton {
                    min-width: unset !important;
                    list-style-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGQ9Ik0zLjYwMzUxNTYgMkwwIDEyLjc5Mjk2OUwwIDEzTDEgMTNMMSAxMi45NTcwMzFMMS45ODYzMjgxIDEwTDcuMDE5NTMxMiAxMEw4IDEyLjk1NTA3OEw4IDEzTDkgMTNMOSAxMi43OTQ5MjJMNS40MTYwMTU2IDJMNC41IDJMMy42MDM1MTU2IDIgeiBNIDQuMzIyMjY1NiAzTDQuNSAzTDQuNjk1MzEyNSAzTDYuNjg3NSA5TDIuMzIwMzEyNSA5TDQuMzIyMjY1NiAzIHogTSAxMSA1TDExIDZMMTMuNSA2QzE0LjMzNTAxNSA2IDE1IDYuNjY0OTg0OSAxNSA3LjVMMTUgOC4wOTM3NUMxNC44NDI3NSA4LjAzNzEzMzUgMTQuNjc1NjcgOCAxNC41IDhMMTEuNSA4QzEwLjY3NzQ2OSA4IDEwIDguNjc3NDY4NiAxMCA5LjVMMTAgMTEuNUMxMCAxMi4zMjI1MzEgMTAuNjc3NDY5IDEzIDExLjUgMTNMMTMuNjcxODc1IDEzQzE0LjE0NjI5NyAxMyAxNC42MDQ0ODYgMTIuODYwMDg0IDE1IDEyLjYxMTMyOEwxNSAxM0wxNiAxM0wxNiAxMS43MDcwMzFMMTYgOS41TDE2IDcuNUMxNiA2LjEyNTAxNTEgMTQuODc0OTg1IDUgMTMuNSA1TDExIDUgeiBNIDExLjUgOUwxNC41IDlDMTQuNzgxNDY5IDkgMTUgOS4yMTg1MzE0IDE1IDkuNUwxNSAxMS4yOTI5NjlMMTQuNzMyNDIyIDExLjU2MDU0N0MxNC40NTEwNzQgMTEuODQxODk1IDE0LjA2OTE3MSAxMiAxMy42NzE4NzUgMTJMMTEuNSAxMkMxMS4yMTg1MzEgMTIgMTEgMTEuNzgxNDY5IDExIDExLjVMMTEgOS41QzExIDkuMjE4NTMxNCAxMS4yMTg1MzEgOSAxMS41IDkgeiIvPjwvc3ZnPg==);
                    border-radius: 0 !important;
                    margin-block: 0 !important;
                    margin-inline: 0 !important;
                    outline: none !important;
                    appearance: none !important;
                    border: 1px solid var(--in-content-box-border-color, ThreeDDarkShadow) !important;
                }
                #completeLinkDescription {
                    max-width: 340px;
                    cursor:pointer;
                }
                menupopup > menuitem, menupopup > menu {
                    padding-block: 4px;
                }
                [disabled="true"] {
                    color: GrayText !important;
                }
                `);
            }
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                this.MAIN_STYLE = addStyle(`
                #contentAreaContextMenu:not([needsgutter]) > .downloadPlus:is(menu, menuitem) > .menu-iconic-left {
                    visibility: collapse;
                }
                .FlashGot {
                    list-style-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGZpbGw9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiLz48cGF0aCBkPSJNMTcgMTh2LTJoLjVhMy41IDMuNSAwIDEgMC0yLjUtNS45NVYxMGE2IDYgMCAxIDAtOCA1LjY1OXYyLjA4OWE4IDggMCAxIDEgOS40NTgtMTAuNjVBNS41IDUuNSAwIDEgMSAxNy41IDE4bC0uNS4wMDF6bS00LTEuOTk1aDNsLTUgNi41di00LjVIOGw1LTYuNTA1djQuNTA1eiIvPjwvc3ZnPg==);
                }
                #contentAreaContextMenu:not([needsgutter]) > .flashGot > .menu-iconic-left {
                    display: none;
                }
                #downloadsContextMenu:not([needsgutter]) > .downloadPlus-menuitem > .menu-iconic-left {
                    visibility: collapse;
                }`);
            }

            if (location.href.startsWith("chrome://browser/content/places/places.x")) {
                this.PLACES_STYLE = addStyle(`
                #downloadsContextMenu:not([needsgutter]) > .downloadPlus-menuitem > .menu-iconic-left {
                    visibility: collapse;
                }`);
            }

            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                this.UNKNOWN_CONTENT_CSS = addStyle(`
                #location {
                    padding: 3px 0;
                }
                #location,
                #locationHbox {
                    height: 22px;
                }
                #locationText {
                    border: 1px solid var(--in-content-box-border-color, ThreeDDarkShadow);
                    padding-inline: 5px;
                    flex: 1;
                    appearance: none;
                    padding-block: 2px;
                    margin: 0;
                }
                #locationHbox {
                    display: flex;
                }
                #locationHbox[hidden="true"] {
                    visibility: collapse;
                }
                #encodingConvertButton {
                    min-width: unset;
                    list-style-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPjxwYXRoIGQ9Ik0zLjYwMzUxNTYgMkwwIDEyLjc5Mjk2OUwwIDEzTDEgMTNMMSAxMi45NTcwMzFMMS45ODYzMjgxIDEwTDcuMDE5NTMxMiAxMEw4IDEyLjk1NTA3OEw4IDEzTDkgMTNMOSAxMi43OTQ5MjJMNS40MTYwMTU2IDJMNC41IDJMMy42MDM1MTU2IDIgeiBNIDQuMzIyMjY1NiAzTDQuNSAzTDQuNjk1MzEyNSAzTDYuNjg3NSA5TDIuMzIwMzEyNSA5TDQuMzIyMjY1NiAzIHogTSAxMSA1TDExIDZMMTMuNSA2QzE0LjMzNTAxNSA2IDE1IDYuNjY0OTg0OSAxNSA3LjVMMTUgOC4wOTM3NUMxNC44NDI3NSA4LjAzNzEzMzUgMTQuNjc1NjcgOCAxNC41IDhMMTEuNSA4QzEwLjY3NzQ2OSA4IDEwIDguNjc3NDY4NiAxMCA5LjVMMTAgMTEuNUMxMCAxMi4zMjI1MzEgMTAuNjc3NDY5IDEzIDExLjUgMTNMMTMuNjcxODc1IDEzQzE0LjE0NjI5NyAxMyAxNC42MDQ0ODYgMTIuODYwMDg0IDE1IDEyLjYxMTMyOEwxNSAxM0wxNiAxM0wxNiAxMS43MDcwMzFMMTYgOS41TDE2IDcuNUMxNiA2LjEyNTAxNTEgMTQuODc0OTg1IDUgMTMuNSA1TDExIDUgeiBNIDExLjUgOUwxNC41IDlDMTQuNzgxNDY5IDkgMTUgOS4yMTg1MzE0IDE1IDkuNUwxNSAxMS4yOTI5NjlMMTQuNzMyNDIyIDExLjU2MDU0N0MxNC40NTEwNzQgMTEuODQxODk1IDE0LjA2OTE3MSAxMiAxMy42NzE4NzUgMTJMMTEuNSAxMkMxMS4yMTg1MzEgMTIgMTEgMTEuNzgxNDY5IDExIDExLjVMMTEgOS41QzExIDkuMjE4NTMxNCAxMS4yMTg1MzEgOSAxMS41IDkgeiIvPjwvc3ZnPg==);
                    border-radius: 0;
                    margin-block: 0;
                    margin-inline: 0;
                    outline: none;
                    appearance: none;
                    border: 1px solid var(--in-content-box-border-color, ThreeDDarkShadow);
                }
                #basicBox {
                    display: none;
                }
                #completeLinkDescription {
                    max-width: 340px;
                    cursor:pointer;
                }
                menupopup > menuitem, menupopup > menu {
                    padding-block: 4px;
                }
                [disabled="true"] {
                    color: GrayText !important;
                }`);
            }
        },
    }

    DownloadPlus.modules.removeFileMenuitem = {
        PREF_ENABLED: 'userChromeJS.downloadPlus.enableRemoveFileFromDiskMenuitem',
        init(doc, win, location) {
            const { DownloadPlus } = win;
            if (!DownloadPlus.prefs.get("userChromeJS.downloadPlus.enableRemoveFromDiskMenuitem", true)) return;
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                if (DownloadPlus.appVersion >= 98 && !this.hasOwnProperty('clearHistoryOnDelete')) {
                    this.clearHistoryOnDelete = DownloadPlus.prefs.get("browser.download.clearHistoryOnDelete");
                    if (this.clearHistoryOnDelete !== "undefined")
                        DownloadPlus.prefs.set("browser.download.clearHistoryOnDelete", 2);
                }
            }

            if (location.href.startsWith("chrome://browser/content/browser.x") || location.href.startsWith("chrome://browser/content/places/places.x")) {
                let context = $("downloadsContextMenu", doc);
                if (context.querySelector("#downloadRemoveFromHistoryEnhanceMenuItem")) return;
                context.insertBefore(
                    $C(document, "menuitem", {
                        id: 'downloadRemoveFromHistoryEnhanceMenuItem',
                        class: 'downloadRemoveFromHistoryMenuItem downloadPlus-menuitem',
                        onclick: "window.DownloadPlus.modules.removeFileMenuitem.action(event);",
                        label: $L("remove from disk")
                    }),
                    context.querySelector(".downloadRemoveFromHistoryMenuItem")
                );
            }
        },
        action(event) {
            function removeSelectedFile(path) {
                let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                try {
                    file.initWithPath(path);
                } catch (e) {

                }
                if (!file.exists()) {
                    if (/\..{0,10}(\.part)$/.test(file.path))
                        file.initWithPath(file.path.replace(".part", ""));
                    else
                        file.initWithPath(file.path + ".part");
                }
                if (file.exists()) {
                    file.permissions |= 0666;
                    file.remove(0);
                }
            }
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                let aTriggerNode = DownloadsView.contextMenu.triggerNode,
                    element = aTriggerNode.closest('.download-state'),
                    sShell = element._shell,
                    path = sShell.download.target.path;
                removeSelectedFile(path);
                sShell.doCommand("cmd_delete");
            } else if (location.href.startsWith("chrome://browser/content/places/places.x")) {
                var ddBox = document.getElementById("downloadsRichListBox");
                if (!(ddBox && ddBox._placesView)) {
                    ddBox = document.getElementById("downloadsListBox");
                }
                if (!ddBox) return;
                var len = ddBox.selectedItems.length;

                for (var i = len - 1; i >= 0; i--) {
                    let sShell = ddBox.selectedItems[i]._shell;
                    let path = sShell.download.target.path;
                    removeSelectedFile(path);
                    sShell.doCommand("cmd_delete");
                }
            } else {
                DownloadPlus.error("operation not support");
            }
        },
        destroy(doc, win, location) {
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                if (this.hasOwnProperty('clearHistoryOnDelete')) {
                    DownloadPlus.prefs.set("browser.download.clearHistoryOnDelete", this.clearHistoryOnDelete);
                    delete this.clearHistoryOnDelete;
                }
            }
            if (location.href.startsWith("chrome://browser/content/browser.x") || location.href.startsWith("chrome://browser/content/places/places.x")) {
                let context = $("downloadsContextMenu", doc),
                    child = context.querySelector("#downloadRemoveFromHistoryEnhanceMenuItem");
                if (context && child)
                    context.removeChild(child);
            }
        },
    }

    DownloadPlus.modules.contextMenu = {
        destroy(doc, win, location) {
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                let context = $("contentAreaContextMenu", doc);
                context.removeEventListener('popupshowing', this);
            }
        },
        init(doc, win, location) {
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                let context = $("contentAreaContextMenu", doc);
                context.addEventListener('popupshowing', this);
            }
        },
        handleEvent(event) {
            if (event.target != event.currentTarget) return;
            if (event.target.id == 'contentAreaContextMenu') {
                var state = [];
                if (gContextMenu.onTextInput)
                    state.push("input");
                if (gContextMenu.isContentSelected || gContextMenu.isTextSelected)
                    state.push("select");
                if (gContextMenu.onLink || event.target.querySelector("#context-openlinkincurrent").getAttribute("hidden") !== "true")
                    state.push(gContextMenu.onMailtoLink ? "mailto" : "link");
                if (gContextMenu.onCanvas)
                    state.push("canvas image");
                if (gContextMenu.onImage)
                    state.push("image");
                if (gContextMenu.onVideo || gContextMenu.onAudio)
                    state.push("media");

                event.target.querySelectorAll(".downloadPlus").forEach(m => m.hidden = true);
                if (state.length) {
                    event.target.querySelectorAll(
                        state.map(s => `.downloadPlus[condition~="${s}"]`).join(', ')
                    ).forEach(m => {
                        m.hidden = false;
                    });
                } else {
                    event.target.querySelectorAll(`.downloadPlus[condition~="normal"]`).forEach(m => m.hidden = false);
                }
            }
        }
    }

    DownloadPlus.modules.downloadDialogBasic = {
        init(doc, win, location, href) {
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                let shadowRoot = doc.getElementById('unknownContentType').shadowRoot,
                    link = $C(doc, 'html:link', {
                        rel: 'stylesheet',
                        href: 'chrome://global/content/widgets.css'
                    });
                shadowRoot.insertBefore(link, shadowRoot.firstChild);
                $A(dialog.dialogElement('unknownContentType').getButton('accept'), {
                    accesskey: 'C'
                });
                $A(dialog.dialogElement('unknownContentType').getButton('cancel'), {
                    accesskey: 'Q'
                });
                setTimeout(function () {
                    doc.getElementById("normalBox").removeAttribute("collapsed");
                }, 100);
            }
        }
    }

    DownloadPlus.modules.flashgot = {
        PREF_FLASHGOT_DEFAULT: 'userChromeJS.downloadPlus.flashgotDefaultManager',
        PREF_FLASHGOT_DOWNLOAD_MANAGERS: 'userChromeJS.downloadPlus.flashgotManagers',
        PREF_FLASHGOT: 'userChromeJS.downloadPlus.flashgotPath',
        PREF_ENABLED: 'userChromeJS.downloadPlus.enableFlashgotIntergention',
        FLASHGOT_STRUCTURE: `{num};{download-manager};{is-private};;\n{referer}\n{url}\n{description}\n{cookies}\n{post-data}\n{filename}\n{extension}\n{download-page-referer}\n{download-page-cookies}\n\n\n{user-agent}`,
        FLASHGOT_FORCE_USERAGENT: {
            'd.pcs.baidu.com': 'pan.baidu.com'
        },
        FLASHGOT_COOKIES_FILTER: {
            'd.pcs.baidu.com': ['BDUSS']
        },
        FLASHGOT_NULL_REFERER: [

        ],
        FLASHGOT_DONT_SEND_DOWNLOAD_PAGE_INFO: [

        ],
        get flashgotPath() {
            var flashgotPref = DownloadPlus.prefs.get(this.PREF_FLASHGOT, "\\chrome\\UserTools\\FlashGot.exe");
            flashgotPref = DownloadPlus.handleRelativePath(flashgotPref);
            var flashgotPath = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
            flashgotPath.initWithPath(flashgotPref);
            if (flashgotPath.exists()) {
                delete this.flashgotPath
                return this.flashgotPath = flashgotPath.path;
            } else
                return false;
        },
        init(doc, win, location) {
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                this.loadDownloadManagersList();
                this.initContextMenu(doc, win);
            }
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                this.initFlashGotDropdownAndButton(doc, win, parent);
            }
        },
        destroy(doc, win, location) {

        },
        initContextMenu(doc, win) {
            let ins = $("context-sep-sendlinktodevice", doc);
            let link = $C(doc, 'menuitem', {
                id: 'downloadPlus-flashgot-this-link',
                class: 'downloadPlus FlashGot',
                label: $L("dowload this link by flashGot"),
                condition: "link",
                trigger: "link",
                oncommand: "DownloadPlus.modules.flashgot.handleFlashGotEvent(event);"
            });
            ins.after(link);
        },
        getDefaultDownloadManager() {
            return DownloadPlus.prefs.get(this.PREF_FLASHGOT_DEFAULT, "");
        },
        loadDownloadManagersList(forceLoad, notify) {
            this.FLASHGOT_DOWNLOAD_MANSGERS = [];
            if (notify) DownloadPlus.alert($L("reloading download managers list"));
            if (this.flashgotPath) {
                try {
                    let prefVal = Services.prefs.getStringPref(this.PREF_FLASHGOT_DOWNLOAD_MANAGERS);
                    this.FLASHGOT_DOWNLOAD_MANSGERS = prefVal.split(",");
                } catch (e) { forceLoad = true }
                if (forceLoad) {
                    // get download managers list from flashgot
                    var dmPathTextPath = PathUtils.join(DownloadPlus.handleRelativePath("{tmpDir}\\.flashgot.dm.txt"));
                    DownloadPlus.exec(this.flashgotPath, ["-o", dmPathTextPath]);
                    let that = this;
                    setTimeout(function () {
                        var dmText = readFile(dmPathTextPath);
                        that.FLASHGOT_DOWNLOAD_MANSGERS = dmText.split("\n").filter(l => l.includes("|OK")).map(l => l.replace("|OK", ""))
                        removeFile(dmPathTextPath);
                        DownloadPlus.prefs.set(that.PREF_FLASHGOT_DOWNLOAD_MANAGERS, that.FLASHGOT_DOWNLOAD_MANSGERS.join(","));
                    }, 5000);
                }
                if (globalDebug) DownloadPlus.log("DownloadPlus load download managers list complete.");
            }
        },
        initFlashGotDropdownAndButton(doc, win, parent) {
            if (!this.flashgotPath) return;
            const { dialog } = win;
            let modeGroup = dialog.dialogElement('mode');
            let flashgotHbox = $C(document, 'hbox');
            modeGroup.appendChild(flashgotHbox);
            let flashgotRadio = $C(document, 'radio', {
                id: 'flashgot',
                label: $L("use flashgot to download"),
                accesskey: 'F',
            });
            flashgotHbox.appendChild(flashgotRadio);
            let flashgotDeck = $C(document, 'deck', {
                id: 'flashgotDeck',
                flex: 1
            });
            flashgotHbox.appendChild(flashgotDeck);
            let flashgotListHbox = $C(document, 'hbox', {
                flex: 1,
                align: 'center'
            })
            flashgotDeck.appendChild(flashgotListHbox);
            let flashgotHandler = $C(document, 'menulist', {
                id: 'flashgotHandler',
                flex: 1,
                native: true
            });
            flashgotListHbox.appendChild(flashgotHandler);
            let flashgotPopup = $C(document, 'menupopup', {});
            flashgotHandler.appendChild(flashgotPopup);

            this.refreshDownloadManagersPopup(flashgotPopup);

            let flashgotDownloadByDefault = $C(document, 'toolbarbutton', {
                id: 'flashgotDownloadByDefault',
                tooltiptext: $L("download by default download manager"),
                class: "toolbarbutton-1",
                style: 'list-style-image: url(chrome://browser/skin/downloads/downloads.svg)',
                accesskey: "D",
                onclick: function (event) {
                    var flashgotPopup = event.target.ownerDocument.getElementById("flashgotHandler").querySelector("menupopup");
                    event.target.ownerGlobal.DownloadPlus.modules.flashgot.handleFlashGotEvent({ target: flashgotPopup.querySelector('[default="true"]') });
                }
            });
            let flashgotReloadManagers = $C(document, 'toolbarbutton', {
                id: 'flasgotReload',
                tooltiptext: $L("force reload download managers list"),
                class: "toolbarbutton-1",
                style: 'list-style-image: url(chrome://global/skin/icons/reload.svg)',
                accesskey: "R",
                onclick: function (event) {
                    let { target } = event;
                    let { ownerGlobal: win, ownerDocument: aDoc } = target;
                    let hbox = aDoc.getElementById("flashgot").parentNode;
                    let popup = target.parentNode.querySelector("menupopup");
                    hbox.childNodes.forEach(el => el.setAttribute('disabled', true));
                    DownloadPlus.topWin.DownloadPlus.modules.flashgot.loadDownloadManagersList(true, true);
                    setTimeout(() => {
                        DownloadPlus.topWin.DownloadPlus.modules.flashgot.refreshDownloadManagersPopup(popup)
                        hbox.childNodes.forEach(el => el.disabled = false);
                    }, 5500);
                }
            });
            let flashgotSetDefault = $C(document, 'toolbarbutton', {
                id: "flasgotSetDefault",
                class: "toolbarbutton-1",
                accesskey: "D",
                style: 'list-style-image: url(chrome://global/skin/icons/settings.svg)',
                onclick: function (event) {
                    let { target } = event;
                    let { ownerGlobal: win } = target;
                    let popup = target.parentNode.querySelector("menupopup");
                    let selectedManager = popup.querySelector('[selected="true"]');
                    if (selectedManager && selectedManager.hasAttribute("manager")) {
                        let { Services, DownloadPlus } = win;
                        Services.prefs.setStringPref(DownloadPlus.modules.flashgot.PREF_FLASHGOT_DEFAULT, selectedManager.getAttribute("manager"));
                        DownloadPlus.modules.flashgot.refreshDownloadManagersPopup(popup);
                    }
                },
                onmouseover: function (event) {
                    let { target } = event;
                    let { ownerGlobal: win } = target;
                    let popup = target.parentNode.querySelector("menupopup");
                    let selectedManager = popup.querySelector('[selected="true"]');
                    this.setAttribute('tooltiptext', win.DownloadPlus.$L("set to default download manger", selectedManager.getAttribute("label")));
                }
            });
            flashgotHbox.appendChild(flashgotDownloadByDefault);
            flashgotHbox.appendChild(flashgotReloadManagers);
            flashgotHbox.appendChild(flashgotSetDefault);

            function flashgotDefaultDownload(event) {
                window.DownloadPlus.modules.flashgot.handleFlashGotEvent({ target: flashgotPopup.querySelector('[selected="true"]') });
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

            dialog.dialogElement('mode').addEventListener("select", function (event) {
                const flashGotRadio = $('flashgot');
                const rememberChoice = $('rememberChoice');
                const flashgot = $('flashgot');
                var other = true;
                if (flashGotRadio && flashGotRadio.selected) {
                    rememberChoice.disabled = true;
                    other = false;
                }
                if (flashgot && flashgot.selected) {
                    other = false;
                }
                if (other) {
                    rememberChoice.disabled = false;
                }
            });
            if (globalDebug) DownloadPlus.log("DownloadPlus flashgot init complete.");
        },
        refreshDownloadManagersPopup(flashgotPopup) {
            if (!flashgotPopup) return;
            // remove all download managers items
            let { ownerDocument: document } = flashgotPopup;
            flashgotPopup.querySelectorAll("menuitem").forEach(el => el.parentNode.removeChild(el));
            DownloadPlus.topWin.DownloadPlus.modules.flashgot.FLASHGOT_DOWNLOAD_MANSGERS.forEach(m => {
                let menuitemDownload = $C(document, 'menuitem', {
                    label: m,
                    manager: m,
                    id: "dm-" + hashText(m),
                    onclick: function (event) {
                        let { target } = event;
                        let { ownerDocument: aDoc, ownerGlobal: win } = target;
                        target.parentNode.querySelectorAll("menuitem").forEach(el => el.removeAttribute("selected"));
                        if (target.getAttribute('default')) {
                            setTimeout(() => {
                                aDoc.querySelector("#flashgotHandler").setAttribute('label', target.label + win.DownloadPlus.$L("default download manager"));
                            }, 20);
                        } else {
                            aDoc.querySelector("#flashgotHandler").setAttribute('label', target.label);
                        }
                        target.setAttribute("selected", true);
                        aDoc.querySelector("#flashgot").click();
                    }
                });
                flashgotPopup.appendChild(menuitemDownload);
            });

            let defaultElement;
            try {
                let name = Services.prefs.getStringPref(this.PREF_FLASHGOT_DEFAULT);
                let el;
                if (name) el = flashgotPopup.querySelector('#dm-' + hashText(name));
                defaultElement = el || flashgotPopup.firstChild;
            } catch (e) {
                console.error(e);
                defaultElement = flashgotPopup.firstChild;
            }
            if (defaultElement) {
                defaultElement.setAttribute('selected', true);
                defaultElement.setAttribute('default', true);
                flashgotPopup.closest("#flashgotHandler").setAttribute('label', defaultElement.getAttribute('label') + $L("default download manager"));
            }
        },
        handleFlashGotEvent(event) {
            const { DownloadPlus } = window.DownloadPlus.topWin;
            if (DownloadPlus.modules.flashgot.FLASHGOT_DOWNLOAD_MANSGERS.length === 0) {
                DownloadPlus.alert($L("no supported download manager"));
                return;
            }
            let { target } = event,
                initFilePath,
                initData,
                downloadNum,
                downloadManager,
                isPrivate,
                referer,
                cookies,
                downloadLink,
                downloadHost,
                description,
                postData,
                fileName,
                extension,
                downloadPageReferer = "",
                downloadPageCookies = "",
                { userAgent } = navigator,
                username,
                password;
            if (target.hasAttribute("manager")) {
                var { targetFile: partFile } = dialog.mLauncher; // Future may be take use of part file
                ({ asciiSpec: downloadLink, host: downloadHost, username, userPass: password } = dialog.mLauncher.source);
                downloadManager = target.getAttribute("manager");
                isPrivate = dialog.mContext.PrivateBrowsingUtils.isBrowserPrivate(dialog.mContext) + 0;
                fileName = (document.querySelector("#locationText") ? document.querySelector("#locationText").value : dialog.mLauncher.suggestedFileName);
                referer = dialog.mSourcePath;
                extension = dialog.mLauncher.MIMEInfo.primaryExtension;
            } else if (target.hasAttribute("trigger")) {
                switch (target.getAttribute("trigger")) {
                    case 'link':
                        downloadManager = this.getDefaultDownloadManager() || this.FLASHGOT_DOWNLOAD_MANSGERS[0];
                        downloadLink = gContextMenu.linkURL;
                        downloadHost = gContextMenu.linkURI.host;
                        description = gContextMenu.linkTextStr;
                        ({ asciiSpec: referer, username, userPass: password } = gContextMenu.browser.currentURI);
                        downloadPageCookies = $Cookie(referer);
                        downloadPageReferer = referer;
                        isPrivate = PrivateBrowsingUtils.isBrowserPrivate(gContextMenu.browser) + 0;
                        break;
                    default:
                        return;
                }
            } else {
                this.alert($L("operate not support"));
                return;
            }
            if (!downloadLink) {
                this.alert($L("error link"));
                return;
            }
            if (this.FLASHGOT_NULL_REFERER.includes(downloadHost)) {
                referer = "";
            }
            if (this.FLASHGOT_DONT_SEND_DOWNLOAD_PAGE_INFO.includes(downloadHost)) {
                downloadPageReferer = "";
                downloadPageCookies = "";
            }
            if (Object.keys(this.FLASHGOT_FORCE_USERAGENT).includes(downloadHost)) {
                userAgent = this.FLASHGOT_FORCE_USERAGENT[downloadHost];
            }
            if (Object.keys(this.FLASHGOT_COOKIES_FILTER).includes(downloadHost)) {
                cookies = $Cookie(downloadLink, false, this.FLASHGOT_COOKIES_FILTER[downloadHost]);
            } else {
                cookies = $Cookie(downloadLink)
            }
            initData = replaceArray(this.FLASHGOT_STRUCTURE, [
                '{num}',
                '{download-manager}',
                '{is-private}',
                '{referer}',
                '{url}',
                '{description}',
                '{cookies}',
                '{post-data}',
                '{filename}',
                '{extension}',
                '{download-page-referer}',
                '{download-page-cookies}',
                '{user-agent}'
            ], [
                downloadNum || 1,
                downloadManager,
                isPrivate || 0,
                referer || "",
                downloadLink,
                description || "",
                cookies || "",
                postData || "", // need to implement
                fileName || "",
                extension || "",
                downloadPageReferer || "", // need to implement
                downloadPageCookies || "",
                userAgent || "" // need to implement custom agent
            ]);
            initFilePath = DownloadPlus.handleRelativePath("{tmpDir}\\" + hashText(downloadLink) + ".dl.properties");
            saveFile(initFilePath, initData);
            if (globalDebug) DownloadPlus.log(initFilePath, initData);
            DownloadPlus.exec(this.flashgotPath, initFilePath);
            if (globalDebug) DownloadPlus.log("DownloadPlus calling flashgot", this.flashgotPath, initFilePath);
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) close();
        }
    }

    DownloadPlus.modules.renameFunction = {
        PREF_ENABLED: 'userChromeJS.downloadPlus.enableRename',
        destroy(doc, win, location, parent) {
            this.respObserver.stop();
        },
        init(doc, win, location, parent) {
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                this.respObserver.start();
            }
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                this.downloadDialogInit(doc, win);
            }
        },
        respObserver: {
            obsService: Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService),
            RESPONSE_TOPIC: 'http-on-examine-response',
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
                    this.obsService.addObserver(this, this.RESPONSE_TOPIC, false);
                    this.observing = true;
                    if (globalDebug) DownloadPlus.log("DownloadPlus change name monitor started!");
                }
            },
            stop: function () {
                if (this.observing) {
                    this.obsService.removeObserver(this, this.RESPONSE_TOPIC, false);
                    this.observing = false;
                    if (globalDebug) DownloadPlus.log("DownloadPlus change name monitor stopped!");
                }
            }
        },
        downloadDialogInit(doc, win) {
            let { dialog } = win;
            let locationHbox = $C(doc, 'hbox', {
                id: 'locationHbox',
                flex: 1,
                align: 'center',
            })
            let location = $('location', doc);
            location.hidden = true;
            location.after(locationHbox);
            let locationText = locationHbox.appendChild($CNS(doc, "http://www.w3.org/1999/xhtml", "html:input", {
                id: "locationText",
                value: dialog.mLauncher.suggestedFileName,
                flex: 1
            })), encodingConvertButton = locationHbox.appendChild($C(doc, 'button', {
                id: 'encodingConvertButton',
                type: 'menu',
                tooltiptext: $L("encoding convert tooltip")
            }));
            let converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                .getService(Ci.nsIScriptableUnicodeConverter);
            let menupopup = $C(doc, 'menupopup', {}), orginalString;
            menupopup.appendChild($C(doc, 'menuitem', {
                value: dialog.mLauncher.suggestedFileName,
                label: $L("original name") + dialog.mLauncher.suggestedFileName,
                default: true,
            }, ['class']));
            try {
                orginalString = (opener.localStorage.getItem(dialog.mLauncher.source.spec) ||
                    dialog.mLauncher.source.asciiSpec.substring(dialog.mLauncher.source.asciiSpec.lastIndexOf("/"))).replace(/[\/:*?"<>|]/g, "");
                opener.localStorage.removeItem(dialog.mLauncher.source.spec)
            } catch (e) {
                orginalString = dialog.mLauncher.suggestedFileName;
            }
            function createMenuitem(encoding) {
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
            $('mode', doc).addEventListener("select", () => {
                if (dialog.dialogElement("save").selected) {
                    location.hidden = true;
                    locationHbox.hidden = false;
                } else {
                    location.hidden = false;
                    locationHbox.hidden = true;
                }
            });
            dialog.dialogElement("save").selected && dialog.dialogElement("save").click();
            window.addEventListener("dialogaccept", function (event) {
                if ((document.querySelector("#locationText").value != dialog.mLauncher.suggestedFileName) && dialog.dialogElement("save").selected) {
                    event.stopPropagation();
                    var mainwin = DownloadPlus.topWin,
                        fileName = document.querySelector("#locationText") ? document.querySelector("#locationText").value : dialog.mLauncher.suggestedFileName;
                    if (globalDebug) this.log("DownloadPlus change name and save: " + fileName);
                    mainwin.eval("(" + mainwin.internalSave.toString().replace("let ", "").replace("var fpParams", "fileInfo.fileExt=null;fileInfo.fileName=aDefaultFileName;var fpParams") + ")")(dialog.mLauncher.source.asciiSpec, null, document, fileName, null, null, false, null, null, null, null, null, true, null, mainwin.PrivateBrowsingUtils.isBrowserPrivate(mainwin.gBrowser.selectedBrowser), Services.scriptSecurityManager.getSystemPrincipal());
                    close();
                }
            }, true);
            if (globalDebug) this.log("DownloadPlus change name init complete.");
        }
    }

    DownloadPlus.modules.doubleClickToCopyLink = {
        PREF_ENABLED: "userChromeJS.downloadPlus.enableDoubleClickToCopyLink",
        destroy(doc, win, location) {
            const { DownloadPlus } = win;
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                $R($("completeLinkHbox", doc));
                if (globalDebug) DownloadPlus.log("DownloadPlus show exact size destroy complete.");
            }
        },
        init(doc, win, location) {
            const { DownloadPlus } = win;
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                var h = $C(document, 'hbox', {
                    id: 'completeLinkHbox',
                    align: 'center'
                });
                document.querySelector("#source").parentNode.after(h);
                var label = h.appendChild($C(document, 'label', {
                    innerHTML: $L("complete link"),
                    style: 'margin-top: 1px'
                }));
                var description = h.appendChild($C(document, 'description', {
                    id: 'completeLinkDescription',
                    class: 'plain',
                    flex: 1,
                    crop: 'center',
                    value: dialog.mLauncher.source.spec,
                    tooltiptext: $L("dobule click to copy link"),
                }));
                [label, description].forEach(el => el.setAttribute("ondblclick", 'DownloadPlus.copyText(dialog.mLauncher.source.spec);'))
                if (globalDebug) DownloadPlus.log("DownloadPlus show exact size init complete.");
            }
        },
    }

    DownloadPlus.modules.saveAndOpen = {
        URLS: [],
        PREF_ENABLED: 'userChromeJS.downloadPlus.enableSaveAndOpen',
        destroy(doc, win, location) {
            const { DownloadPlus } = win;
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                win.DownloadPlus.modules.saveAndOpen.URLS = [];
                this.Downloads.getList(this.Downloads.ALL).then(list => { list.removeView(this.view).then(null, Cu.reportError); });
                if (globalDebug) DownloadPlus.log("DownloadPlus show extract size destroy complete.");
            }
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                    $R($('save-and-open', doc));
                }
            }
            if (globalDebug) this.log("DownloadPlus save and open destroy complete.");
        },
        init(doc, win, location) {
            const { DownloadPlus } = win;
            this.Downloads = globalThis.Downloads || Cu.import("resource://gre/modules/Downloads.jsm").Downloads;
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                this.Downloads.getList(Downloads.ALL).then(list => { list.addView(this.view).then(null, Cu.reportError); });
                if (globalDebug) DownloadPlus.log("DownloadPlus show extract size init complete.");
            }
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                const { dialog } = win;
                let saveAndOpen = $C(doc, 'button', {
                    id: 'save-and-open',
                    label: $L("save and open"),
                    accesskey: 'P',
                    hidden: false,
                });
                saveAndOpen.addEventListener('click', () => {
                    const saveAndOpen = Services.wm.getMostRecentWindow("navigator:browser").DownloadPlus.modules.saveAndOpen;
                    const dialogElement = dialog.dialogElement('unknownContentType');
                    saveAndOpen.URLS.push(dialog.mLauncher.source.asciiSpec);
                    document.querySelector("#save").click();
                    dialogElement.getButton("accept").disabled = 0;
                    dialogElement.getButton("accept").click();
                });
                dialog.dialogElement('unknownContentType').getButton('cancel').before(saveAndOpen);
                if (globalDebug) this.log("DownloadPlus save and open init complete.");
            }
        },
        view: {
            onDownloadChanged: function (dl) {
                const { saveAndOpen } = window.DownloadPlus.topWin.DownloadPlus.modules;
                if (dl.progress != 100) return;
                if (saveAndOpen.URLS.indexOf(dl.source.url) > -1) {
                    let target = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                    if (globalDebug) window.DownloadPlus.log("DownloadPlus opening: " + dl.target.path);
                    target.initWithPath(dl.target.path);
                    target.launch();
                    saveAndOpen.URLS[saveAndOpen.URLS.indexOf(dl.source.url)] = "";
                }
            },
            onDownloadAdded: function (dl) { },
            onDownloadRemoved: function (dl) { },
        }
    }

    DownloadPlus.modules.saveAs = {
        PREF_ENABLED: 'userChromeJS.downloadPlus.enableSaveAs',
        destroy(doc, win, location) {
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                $R($('save-as', doc));
            }
            if (globalDebug) this.log("DownloadPlus save as destroy complete.");
        },
        init(doc, win, location) {
            const { DownloadPlus } = win;
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                const { dialog } = win;
                let saveAs = $C(doc, 'button', {
                    id: 'save-as',
                    label: $L("save as"),
                    accesskey: 'E'
                })
                saveAs.addEventListener("command", () => {
                    var mainwin = DownloadPlus.topWin;
                    // 感谢 ycls006
                    mainwin.eval("(" + mainwin.internalSave.toString().replace("let ", "").replace("var fpParams", "fileInfo.fileExt=null;fileInfo.fileName=aDefaultFileName;var fpParams") + ")")(dialog.mLauncher.source.asciiSpec, null, null, (document.querySelector("#locationText") ? document.querySelector("#locationText").value : dialog.mLauncher.suggestedFileName), null, null, false, null, null, null, null, null, false, null, mainwin.PrivateBrowsingUtils.isBrowserPrivate(mainwin.gBrowser.selectedBrowser), Services.scriptSecurityManager.getSystemPrincipal());
                    close();
                });
                let ins = dialog.dialogElement('unknownContentType').getButton('cancel');
                ins.before(saveAs);
                if (globalDebug) this.log("DownloadPlus save as init complete.");
            }
        },
    }

    DownloadPlus.modules.saveTo = {
        PREF_ENABLED: 'userChromeJS.downloadPlus.enableSaveTo',
        SAVE_LIST: QUICK_SAVE_LIST,
        destroy(doc, win, location) {
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                $R($('save-to', doc));
            }
            if (globalDebug) DownloadPlus.log("DownloadPlus save to destroy complete.");
        },
        init(doc, win, location) {
            const { DownloadPlus } = win;
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                let saveTo = $C(document, 'button', {
                    label: $L("save to"),
                    class: 'dialog-button',
                    hidden: false,
                    type: 'menu',
                    accesskey: 'T'
                }), saveToMenu = $C(document, 'menupopup', {});
                saveTo.appendChild(saveToMenu);
                this.SAVE_LIST.forEach(dir => {
                    var [name, dir] = [dir[1], dir[0]];
                    var item = saveToMenu.appendChild($C(doc, "menuitem", {
                        label: name || (dir.match(/[^\\/]+$/) || [dir])[0],
                        image: "moz-icon:file:///" + dir + "\\"
                    }));
                    item.onclick = function () {
                        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                        var path = dir.replace(/^\./, Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile).path);
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
                    };
                })
                let ins = dialog.dialogElement('unknownContentType').getButton('cancel');
                ins.before(saveTo);
                if (globalDebug) DownloadPlus.log("DownloadPlus save to init complete.");
            }
        },
    }

    DownloadPlus.modules.downloadNotice = {
        PREF_ENABLED: "userChromeJS.downloadPlus.enableDownloadNotice",
        PREF_DL_START: "userChromeJS.downloadPlus.notice.DL_START",
        PREF_DL_CANCEL: "userChromeJS.downloadPlus.notice.DL_CANCEL",
        PREF_DL_DONE: "userChromeJS.downloadPlus.notice.DL_DONE",
        PREF_DL_FAILED: "userChromeJS.downloadPlus.notice.DL_FAILED",
        _list: null,
        destroy(doc, win, location) {
            const { DownloadPlus } = win;
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                if (this._list) this._list.removeView(this);
                if (globalDebug) DownloadPlus.log("DownloadPlus download notice destroy complete.");
            }
        },
        init(doc, win, location) {
            const { DownloadPlus } = win;
            this.Downloads = globalThis.Downloads || Cu.import("resource://gre/modules/Downloads.jsm").Downloads;
            this.DL_START = DownloadPlus.prefs.get(this.PREF_DL_START, "");
            this.DL_DONE = DownloadPlus.prefs.get(this.PREF_DL_DONE, "file:///C:/WINDOWS/Media/chimes.wav");
            this.DL_CANCEL = DownloadPlus.prefs.get(this.PREF_DL_CANCEL, "");
            this.DL_FAILED = DownloadPlus.prefs.get(this.PREF_DL_FAILED, "");
            if (location.href.startsWith("chrome://browser/content/browser.x")) {
                if (!this._list)
                    this.Downloads.getList(Downloads.ALL).then(list => {
                        this._list = list;
                        list.addView(this).then(null, Cu.reportError);
                    });
                if (globalDebug) DownloadPlus.log("DownloadPlus download notice init complete.");
            }
        },
        playSoundFile(aFilePath) {
            if (!aFilePath)
                return;
            var ios = Cc["@mozilla.org/network/io-service;1"]
                .createInstance(Ci["nsIIOService"]);
            try {
                var uri = ios.newURI(aFilePath, "UTF-8", null);
            } catch (e) {
                return;
            }
            var file = uri.QueryInterface(Ci.nsIFileURL).file;
            if (!file.exists())
                return;

            this.play(uri);
        },
        play(aUri) {
            var sound = Cc["@mozilla.org/sound;1"]
                .createInstance(Ci["nsISound"]);
            sound.play(aUri);
        },
        onDownloadChanged: function (aDownload) {
            // 取消下载
            if (aDownload.canceled && this.DL_CANCEL)
                this.playSoundFile(this.DL_CANCEL)
            // 下载失败
            if (aDownload.error && this.DL_FAILED)
                this.playSoundFile(this.DL_FAILED)
            // 下载完成
            if (aDownload.succeeded && this.DL_DONE) {
                this.playSoundFile(this.DL_DONE);
            }
        },
        onDownloadAdded: function (aDownload) {
            if (this.DL_START)
                this.playSoundFile(this.DL_START);
        },
        onDownloadRemoved: function (aDownload) { },
    }

    DownloadPlus.modules.showExactSize = {
        PREF_ENABLED: "userChromeJS.downloadPlus.enableExactSize",
        destroy(doc, win, location) {
            const { DownloadPlus } = win;
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                if (this.convertByteUnits) {
                    Cu.import("resource://gre/modules/DownloadUtils.jsm");
                    eval("DownloadUtils.convertByteUnits = " + this.convertByteUnits);
                }
                if (globalDebug) DownloadPlus.log("DownloadPlus show exact size destroy complete.");
            }
        },
        init(doc, win, location) {
            const { DownloadPlus } = win;
            if (location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) {
                Cu.import("resource://gre/modules/DownloadUtils.jsm");
                if (!DownloadUtils.convertByteUnits.toString().includes("999.5")) {
                    this.convertByteUnits = DownloadUtils.convertByteUnits.toString();
                    function DU_convertByteUnits(aBytes) {
                        let unitIndex = 0;
                        while ((aBytes >= 999.5) && (unitIndex < 3)) {
                            aBytes /= 1024;
                            unitIndex++;
                        }
                        return [(aBytes > 0) && (aBytes < 100) && (unitIndex != 0) ? (aBytes < 10 ? (parseInt(aBytes * 100) / 100).toFixed(2) : (parseInt(aBytes * 10) / 10).toFixed(1)) : parseInt(aBytes), ['bytes', 'KB', 'MB', 'GB'][unitIndex]];
                    }
                    eval("DownloadUtils.convertByteUnits = " + DU_convertByteUnits.toString());
                }
                if (globalDebug) DownloadPlus.log("DownloadPlus show exact size init complete.");
            }
        },
    }

    function $(id, aDoc) {
        aDoc || (aDoc = document);
        return aDoc.getElementById(id);
    }

    function $C(doc, tag, attrs, skipAttrs) {
        var el;
        if (!doc || !tag) return el;
        attrs = attrs || {};
        skipAttrs = skipAttrs || [];
        if (tag.startsWith('html:'))
            el = $CNS(doc, 'http://www.w3.org/1999/xhtml', tag)
        else
            el = doc.createXULElement(tag);

        $A(el, attrs, skipAttrs);

        if (['menu', 'menuitem'].includes(tag) && !skipAttrs.includes('class'))
            el.classList.add(tag + "-iconic");

        return el;
    }

    function $CNS(doc, namespace, type, props) {
        if (!type) return null;
        doc || (doc = document);
        namespace || (namespace = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");
        let el = doc.createElementNS(namespace, type);
        return $A(el, props);
    }

    function $A(el, attrs, skipAttrs) {
        skipAttrs = skipAttrs || [];
        skipAttrs.push("innerHTML");
        if (attrs) {
            Object.keys(attrs).forEach(function (key) {
                if (!skipAttrs.includes(key)) {
                    if (typeof attrs[key] === 'function')
                        el.setAttribute(key, "(" + attrs[key].toString() + ").call(this, event);");
                    else
                        el.setAttribute(key, attrs[key]);
                }
            });
            if (attrs["innerHTML"]) el.innerHTML = attrs["innerHTML"];
        }
        return el;
    }

    function $R(el) {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
            return true;
        }
        return false;
    }

    function $L(key, replace) {
        const capitalizeFirstLetter = ([first, ...rest], locale = navigator.language) =>
            first === undefined ? '' : first.toLocaleUpperCase(locale) + rest.join('')
        if (!LANG[_LOCALE]) return capitalizeFirstLetter(key);
        let str = LANG[_LOCALE].hasOwnProperty(key) ? LANG[_LOCALE][key] : capitalizeFirstLetter(key);
        if (typeof replace !== "undefined") {
            str = str.replace("%s", replace);
        }
        return str || "";
    }


    function $Cookie(link, saveToFile, filter) {
        saveToFile || (saveToFile = false);
        if (!link) return "";
        let uri = Services.io.newURI(link, null, null),
            cookies = Services.cookies.getCookiesFromHost(uri.host, {}),
            cookieSavePath = DownloadPlus.handleRelativePath("{tmpDir}");

        if (filter)
            cookies = cookies.filter(el => filter.includes(el.name));
        if (saveToFile) {
            let string = cookies.map(formatCookie).join('');
            let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            file.initWithPath(cookieSavePath);
            file.append(uri.host + ".txt");
            if (!file.exists()) {
                file.create(0, 0644);
            }
            let foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
            foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
            foStream.write(string, string.length);
            foStream.close();
            return file.path;
        } else {
            return cookies.map((el) => el.name + ':' + el.value).join("; ");
        }

        function formatCookie(co) {
            // 转换成 netscape 格式，抄袭自 cookie_txt 扩展
            return [
                [
                    co.isHttpOnly ? '#HttpOnly_' : '',
                    co.host
                ].join(''),
                co.isDomain ? 'TRUE' : 'FALSE',
                co.path,
                co.isSecure ? 'TRUE' : 'FALSE',
                co.expires,
                co.name,
                co.value + '\n'
            ].join('\t');
        }

    }

    function addStyle(css) {
        var pi = document.createProcessingInstruction(
            'xml-stylesheet',
            'type="text/css" href="data:text/css;utf-8,' + encodeURIComponent(css) + '"'
        );
        return document.insertBefore(pi, document.documentElement);
    }

    function saveFile(aFileOrPath, data, encoding) {
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

    function readFile(aFileOrPath, encoding) {
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

    function removeFile(aFileOrPath) {
        var aFile;
        if (typeof aFileOrPath == "string") {
            aFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);;
            aFile.initWithPath(aFileOrPath);
        } else {
            aFile = aFileOrPath;
        }
        if (aFile.exists()) {
            aFile.permissions |= 0666;
            aFile.remove(0);
            return true;
        } else {
            return false;
        }
    }

    function hashText(text, type) {
        if (!(typeof text == 'string' || text instanceof String)) {
            text = "";
        }
        var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
            .createInstance(Ci.nsIScriptableUnicodeConverter);

        converter.charset = "UTF-8";
        var result = {};
        var data = converter.convertToByteArray(text, result);

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

        function toHexString(charCode) {
            return ("0" + charCode.toString(16)).slice(-2);
        }

        return Array.from(hash, (c, i) => toHexString(hash.charCodeAt(i))).join("");
    }

    // make string support replace with array
    function replaceArray(replaceString, find, replace) {
        var regex;
        for (var i = 0; i < find.length; i++) {
            regex = new RegExp(find[i], "g");
            replaceString = replaceString.replace(regex, replace[i]);
        }
        return replaceString;
    };

    window.DownloadPlus = DownloadPlus;

    if (typeof gBrowserInit !== "undefined") {
        if (gBrowserInit.delayedStartupFinished) window.DownloadPlus.init();
        else {
            let delayedListener = (subject, topic) => {
                if (topic == "browser-delayed-startup-finished" && subject == window) {
                    Services.obs.removeObserver(delayedListener, topic);
                    window.DownloadPlus.init();
                }
            };
            Services.obs.addObserver(delayedListener, "browser-delayed-startup-finished");
        }
    } else {
        window.DownloadPlus.init();
    }
})(false);