// ==UserScript==
// @name            removeFileFromDownloadManager.uc.js
// @long-description
// @description
/* 下载管理器右键菜单增加【从硬盘删除】菜单

这个脚本最先是紫云飞开发的：https://files.cnblogs.com/ziyunfei/removeFileFromDownloadManager.uc.js
*/
// @version         1.0.1
// @license         MIT License
// @compatibility   Firefox 72
// @charset         UTF-8
// @include         main
// @include         about:downloads
// @include         chrome://browser/content/places/places.xhtml
// @include         chrome://browser/content/downloads/contentAreaDownloadsView.xhtml
// @include         chrome://browser/content/downloads/contentAreaDownloadsView.xhtml?SM
// @homepageURL     https://github.com/benzBrake/FirefoxCustomize/tree/master/userChromeJS
// @note            1.0.1 移除过时的兼容代码，兼容 about:downloads 页面
// @note            1.0.0
// ==/UserScript==
(function (css) {
    const $C = (doc, tag, attrs) => {
        let el = doc.createXULElement(tag);
        for (let [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
        return el;
    };
    const sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
    const addStyle = (css) => {
        let uri = Services.io.newURI('data:text/css;charset=UTF-8,' + encodeURIComponent(css));
        if (!sss.sheetRegistered(uri, sss.AUTHOR_SHEET)) sss.loadAndRegisterSheet(uri, sss.AUTHOR_SHEET);
    }

    const removeFileItem = {
        PREF_ENABLED: 'userChromeJS.DownloadPlus.enableRemoveFromDiskMenuitem',
        init: function () {
            if (!Services.prefs.getBoolPref(this.PREF_ENABLED, true)) return;
            if (location.href.startsWith("chrome://browser/content/browser.xhtml")) {
                document.addEventListener('DOMContentLoaded', this);
            }
            this.createMenu(document);
        },
        handleEvent: function (event) {
            const { type } = event;
            const fuT = type.slice(0, 1).toUpperCase() + type.slice(1);
            if (this[`on${fuT}`]) this[`on${fuT}`](event);
        },
        onCommand (event) {
            function removeSelectedFile (path) {
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

            function ddBoxOperate (ddBox) {
                if (!ddBox) return;
                var len = ddBox.selectedItems.length;

                for (var i = len - 1; i >= 0; i--) {
                    let sShell = ddBox.selectedItems[i]._shell;
                    let path = sShell.download.target.path;
                    removeSelectedFile(path);
                    sShell.doCommand("cmd_delete");
                }
            }

            let contextMenu = event.target.closest('menupopup'),
                aTriggerNode = contextMenu.triggerNode,
                ddBox = aTriggerNode.closest('#downloadsListBox');
            if (ddBox) {
                ddBoxOperate(ddBox);
            }
        },
        onDOMContentLoaded (event) {
            if (event.target.location.href.startsWith("about:downloads"))
                this.createMenu(event.target);
        },
        createMenu (doc) {
            let contextMenu = doc.getElementById("downloadsContextMenu");
            if (contextMenu.querySelector("#downloadRemoveFromHistoryEnhanceMenuItem")) return;
            addStyle(css);
            let dom = contextMenu.insertBefore(
                $C(doc, "menuitem", {
                    id: 'downloadRemoveFromHistoryEnhanceMenuItem',
                    class: 'downloadRemoveFromHistoryMenuItem downloadPlus-menuitem',
                    label: "从硬盘删除",
                    accesskey: "D"
                }),
                contextMenu.querySelector(".downloadRemoveFromHistoryMenuItem")
            );
            dom.addEventListener('command', this, false);
        }
    }
    removeFileItem.init();
})(`
.downloadDeleteFileMenuItem{ display: none }
`)