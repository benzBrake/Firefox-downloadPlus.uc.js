// ==UserScript==
// @name            saveAs.uc.js
// @long-description
// @description
/* 下载弹出页面添加【另存为】按钮

这个脚本最先是紫云飞开发的：https://files.cnblogs.com/ziyunfei/saveas.uc.js
*/
// @version         1.1.0
// @license         MIT License
// @compatibility   Firefox 136
// @charset         UTF-8
// @include         chrome://mozapps/content/downloads/unknownContentType.xhtml
// @include         chrome://mozapps/content/downloads/unknownContentType.xul
// @homepageURL     https://github.com/benzBrake/FirefoxCustomize/tree/master/userChromeJS
// ==/UserScript==
(function () {
    if (!location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) return;
    if (!Services.prefs.getBoolPref("userChromeJS.downloadPlus.enableSaveAs", true)) return;
    const { utils: Cu } = Components;
    const invalidChars = /[<>:"/\\|?*]/g;
    const $C = (doc, tag, props) => {
        const el = doc.createXULElement(tag);
        for (const [key, value] of Object.entries(props)) {
            if (key.startsWith('on') && typeof value == "function") {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                el.setAttribute(key, value);
            }
        }
        return el;
    };

    const getMainWindowSandbox = mainWindow => {
        if (mainWindow.DownloadPlus?.sb) {
            return mainWindow.DownloadPlus.sb;
        }
        if (mainWindow.__saveAsSandbox) {
            return mainWindow.__saveAsSandbox;
        }

        const sb = Cu.Sandbox(mainWindow, {
            sandboxPrototype: mainWindow,
            sameZoneAs: mainWindow,
            freezeBuiltins: false
        });
        Cu.evalInSandbox(`
            Function.prototype.toSource = window.Function.prototype.toSource;
            Object.defineProperty(Function.prototype, "toSource", { enumerable: false });
            Object.prototype.toSource = window.Object.prototype.toSource;
            Object.defineProperty(Object.prototype, "toSource", { enumerable: false });
            Array.prototype.toSource = window.Array.prototype.toSource;
            Object.defineProperty(Array.prototype, "toSource", { enumerable: false });
        `, sb);
        mainWindow.addEventListener("unload", () => {
            setTimeout(() => {
                Cu.nukeSandbox(sb);
            }, 0);
        }, { once: true });
        mainWindow.__saveAsSandbox = sb;
        return sb;
    };

    const { dialog } = window;
    const saveAs = $C(document, 'button', {
        id: 'save-as',
        label: "另存为",
        accesskey: 'E',
        oncommand: function () {
            const mainWindow = Services.wm.getMostRecentWindow("navigator:browser");
            if (!mainWindow || typeof mainWindow.internalSave !== "function") {
                return;
            }

            const fileName = document.querySelector("#locationText")?.value?.replace(invalidChars, "_")
                || dialog.mLauncher.suggestedFileName;

            // 感谢 ycls006 / alice0775
            Cu.evalInSandbox(
                "(" + mainWindow.internalSave.toString()
                    .replace("let ", "")
                    .replace("var fpParams", "fileInfo.fileExt=null;fileInfo.fileName=aDefaultFileName;var fpParams") + ")",
                getMainWindowSandbox(mainWindow)
            )(
                dialog.mLauncher.source.asciiSpec, null, null, fileName,
                null, null, false, null, null, null, null, null, false, null,
                mainWindow.PrivateBrowsingUtils.isBrowserPrivate(mainWindow.gBrowser.selectedBrowser),
                Services.scriptSecurityManager.getSystemPrincipal()
            );
            close();
        }
    });
    const ins = dialog.dialogElement('unknownContentType').getButton('cancel');
    ins.before(saveAs);
})();
